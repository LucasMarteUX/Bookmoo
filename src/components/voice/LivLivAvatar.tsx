// Tutora com personagem 2.5D (LivLiv Player): respira, pisca, olha e mexe a cabeça sozinha (idle do player);
// a boca segue a MESMA voz do app: o player de áudio do TTS toca as falas por um <audio> deste componente
// (borrowPlaybackElement), e esse elemento vai para o startLipSync do LivLiv. Nada de segunda voz.
// A voz do navegador (usada para português) não passa por <audio>: aí a boca lê o relógio da fala.
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Player } from '@livliv-dev/player'
import { startLipSync, type LipSync } from '@livliv-dev/player/voice'
import type { VoiceState } from '@/hooks/useVoiceConversation'
import type { Mood } from '@/components/voice/TutorAvatar'
import { borrowPlaybackElement } from '@/lib/tts'
import { getSpeechClock } from '@/lib/speechClock'
import { activeVisemeTrack, shapeAt, nextStress } from '@/lib/visemeTrack'
import { characterAvatarUrl, characterBaseUrl, characterById, characterModelUrl } from '@/lib/livliv/characters'
import { setupPainted, type PaintedControl } from '@/lib/livliv/painted'
import { clearSpeakerVoice, setSpeakerVoice } from '@/lib/speakerVoice'
import { installBodyGestures, type BodyGestureControl } from '@/lib/livliv/bodyGestures'
import { installBodyLanguage } from '@/lib/livliv/bodyLanguage'
import { GestureDirector } from '@/lib/livliv/performance'
import { dizzyLine, moodFromText, pickNext, POKE_ANGRY, POKES, type ReactionLine } from '@/lib/tutorReactions'

type Action = 'nod' | 'shake' | 'tilt' | 'shy'
type Reaction = { expr: string | null; act?: [Action, number]; brow?: number }
// Humor → expressão do modelo + um gesto leve + sobrancelhas. Sem pulinhos, e o gesto lateral (tilt) é raro e pequeno:
// ele sempre vai para o mesmo lado e, repetido, parecia que ela "puxava" para a direita. Os ids que o modelo não tem
// (os de exemplo do LivLiv só tinham smile, shy, angry e sad) são ignorados. A Bia e o Luck têm também surprised e x_wink.
const MOOD_REACTION: Record<Mood, Reaction> = {
  neutral: { expr: null },
  happy: { expr: 'smile', act: ['nod', 0.25] },
  laughing: { expr: 'smile', act: ['nod', 0.3], brow: 0.2 },
  excited: { expr: 'smile', act: ['nod', 0.35], brow: 0.3 },
  sad: { expr: 'sad', brow: -0.2 },
  angry: { expr: 'angry', act: ['shake', 0.3], brow: -0.5 },
  surprised: { expr: 'surprised', brow: 0.8 },
  confused: { expr: null, act: ['tilt', 0.25], brow: 0.4 },
  wink: { expr: 'x_wink' },
  shy: { expr: 'shy', act: ['shy', 0.6] },
}

// Voz do navegador: a letra que está sendo dita vira abertura e formato da boca.
function mouthForChar(ch: string): { open: number; vowel: number } {
  const c = ch.toLowerCase()
  if ('aáàâã'.includes(c)) return { open: 0.85, vowel: 0 }
  if ('eéêiíy'.includes(c)) return { open: 0.5, vowel: 0.8 }
  if ('oóôõuúw'.includes(c)) return { open: 0.6, vowel: -0.8 }
  if ('mbp'.includes(c)) return { open: 0, vowel: 0 }
  if (/[a-z]/.test(c)) return { open: 0.3, vowel: 0 }
  return { open: 0, vowel: 0 }
}

/** Duração mínima da "ligação" ao trocar de tutor. */
const CALL_MS = 3000

export type HeadBox = { x: number; top: number; width: number }

// Enquadramento do palco por personagem e formato de tela: medido uma vez e guardado, para as próximas vezes já abrirem
// no lugar certo (sem a personagem "pular" do meio para a base quando a página carrega).
type Framing = { y: number; top: number }
const FRAMING_KEY = 'bookmoo:stage-framing:v9' // v4: zoom padronizado pela altura da cabeça
const framingCache: Record<string, Framing> = (() => { try { return JSON.parse(localStorage.getItem(FRAMING_KEY) || '{}') } catch { return {} } })()
function saveFraming(key: string, f: Framing) {
  framingCache[key] = f
  try { localStorage.setItem(FRAMING_KEY, JSON.stringify(framingCache)) } catch { /* sem armazenamento */ }
}
/** Espera alguns quadros desenhados (com limite de tempo: numa aba escondida o navegador pausa os quadros). */
const frames = (n: number) => new Promise<void>(resolve => {
  let left = n
  const t = window.setTimeout(resolve, 500)
  const tick = () => { if (--left <= 0) { window.clearTimeout(t); resolve() } else requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
})

export function LivLivAvatar({ characterId, state, speakingText = '', onHead, onReady, size = 220, mood = 'neutral', wave = false, followPointer = true, voice = false, stage = false, onPoke, onFail }: {
  characterId: string
  /** Frase sendo dita agora: pergunta inclina a cabeça, exclamação anima. */
  speakingText?: string
  /** Onde está a cabeça (em px do quadro), para posicionar o balão de fala junto dela. */
  onHead?: (head: HeadBox) => void
  /** O personagem já está na tela (carregado e enquadrado); false enquanto troca de personagem. */
  onReady?: (ready: boolean) => void
  /** Palco: ocupa todo o espaço do pai, sem círculo, cortado na cintura e apoiado na base (tela de conversa). */
  stage?: boolean
  state: VoiceState
  size?: number
  mood?: Mood
  wave?: boolean
  followPointer?: boolean
  /** Esta instância fala: as falas do app tocam por ela e a boca acompanha. Só uma por tela. */
  voice?: boolean
  /** Toque no personagem: ele reage e entrega a frase que combina com a reação (o texto sai junto com o rosto). */
  onPoke?: (line: ReactionLine) => void
  /** Sem WebGL2, contexto perdido ou personagem que não carregou: quem chamou mostra o avatar vetorial. */
  onFail?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const playerRef = useRef<Player | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [ready, setReady] = useState(false)
  const readyRef = useRef(false)
  readyRef.current = ready
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  // Troca de tutor no palco: uma "ligação" de uns 3 segundos ("Chamando Luck...") antes de ele aparecer.
  const [calling, setCalling] = useState(false)
  // Visível de verdade: carregado, enquadrado e já passou o "chamando" (o balão de fala só aparece daí em diante).
  const visible = ready && !calling
  const visibleRef = useRef(false)
  visibleRef.current = visible
  useEffect(() => { onReadyRef.current?.(visible) }, [visible])
  const prevCharacter = useRef(characterId)
  useEffect(() => {
    if (!stage || prevCharacter.current === characterId) { prevCharacter.current = characterId; return }
    prevCharacter.current = characterId
    setCalling(true)
    const t = window.setTimeout(() => setCalling(false), CALL_MS)
    return () => window.clearTimeout(t)
  }, [characterId, stage])
  const speakingRef = useRef(false)
  speakingRef.current = state === 'speaking'
  const stateRef = useRef<VoiceState>(state)
  const characterIdRef = useRef(characterId)
  characterIdRef.current = characterId
  stateRef.current = state
  const browRef = useRef(0)
  const gestureRef = useRef<BodyGestureControl | null>(null)
  const baseZRef = useRef(0)
  const fixedBase = useRef(false)
  const basePerDeg = useRef(0.0013)
  const moodRef = useRef<Mood>(mood)
  moodRef.current = mood
  const textRef = useRef(speakingText)
  textRef.current = speakingText
  // Expressão desenhada agora: ela já traz as próprias sobrancelhas, então os ajustes de sobrancelha ficam de fora.
  const shownExprRef = useRef<string | null>(null)
  const moodExprRef = useRef<string | null>(null)
  const restoreTimer = useRef(0)
  // Topo do desenho (cabelo) acima do centro da cabeça, em larguras de cabeça: medido por personagem.
  const topFactor = useRef(0.72)
  const headRef = useRef(onHead)
  headRef.current = onHead
  // Bia pintada: a cabeça, a boca, o cabelo e a roupa são dos adaptadores dela; os controladores de cabeça abaixo ficam quietos.
  const paintedRef = useRef(false)
  const stageRef = useRef(stage)
  stageRef.current = stage
  // Mouse rodando em volta: tonto (o efeito do player chama isto; aqui ele vê as props e o react atuais).
  const dizzyRef = useRef<() => void>(() => {})
  const paintedCtl = useRef<PaintedControl | null>(null)
  const loadToken = useRef(0)
  const failRef = useRef(onFail)
  failRef.current = onFail

  // Um player por canvas (seguro no StrictMode: dispose com release e um novo no mesmo canvas).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!Player.isSupported()) { failRef.current?.(); return }
    let p: Player
    try {
      const coarse = window.matchMedia('(pointer: coarse)').matches
      p = new Player(canvas, {
        followPointer: followPointer ? 'page' : false,
        // Celular: menos pixels por ponto economiza bateria; avatar pequeno não precisa de mais.
        maxPixelRatio: !stage && size <= 64 ? 1 : coarse ? 1.5 : 2,
        lang: 'en',
      })
    } catch { failRef.current?.(); return }
    p.onContextLost = () => failRef.current?.()
    if (import.meta.env.DEV) (window as unknown as { __lvp?: Player }).__lvp = p
    // Movimentos automáticos mais calmos: os "olhares de lado" (glance, lookAround, sway) do player viravam a cabeça uns 11 graus
    // para um lado de vez em quando, e o sorriso espontâneo fechava os olhos sem motivo. Ficam bem menores e sem o sorriso.
    // (Campos internos do player 0.5.1, fixado em package.json; se mudarem, o ajuste simplesmente não faz nada.)
    const motion = (p as unknown as { idler?: { lv?: { moves?: number; nextMove?: number; style?: { smile?: number } } } }).idler?.lv
    if (motion) {
      if (typeof motion.moves === 'number') motion.moves = 0.35
      if (typeof motion.nextMove === 'number') motion.nextMove = Math.max(motion.nextMove, 18) // o primeiro olhar de lado só depois de um tempo
      if (motion.style && typeof motion.style.smile === 'number') motion.style.smile = 0
    }
    // Recentraliza: o idle do player deixa a cabeça inclinada ou virada para um lado por vários segundos (olhando o mouse parado,
    // um olhar de lado, uma inclinação de atenção), e isso dava a impressão de ela "pender" para a direita ou para a esquerda.
    // Passa-altas por eixo: o que dura mais que uns 3 segundos vai sumindo e ela volta ao centro; movimentos rápidos passam.
    // A inclinação (roll) da cabeça e do tronco ainda é amortecida, porque é ela que mais "entorta" o personagem.
    const slow: Record<string, number> = { angleX: 0, angleZ: 0, bodyX: 0, bodyZ: 0 }
    // Ganho final: o olhar segue o cursor, mas a cabeça acompanha só um pouco e o tronco quase não sai do lugar
    // (antes ela parecia flutuar atrás do mouse). O olho (eyeBallX/Y) não é reduzido.
    const GAIN: Record<string, number> = { angleX: 0.7, angleZ: 0.35, bodyX: 0.25, bodyZ: 0.25 }
    const STATIC_GAIN: Record<string, number> = { angleY: 0.55, breath: 0.6 }
    p.bodyMotion = 0.5
    gestureRef.current = installBodyGestures(p)
    if (import.meta.env.DEV) (window as unknown as { __gest?: BodyGestureControl }).__gest = gestureRef.current
    let leanDir = -1, leanTarget = -1, leanSwitch = performance.now() + 10000
    const removeRecenter = p.use({
      order: 5,
      update(frame) {
        if (paintedRef.current) return
        const k = Math.min(1, frame.dt / 3)
        // Às vezes o corpo inclina ao CONTRÁRIO do mouse e só os olhos acompanham (fica mais vivo que seguir sempre).
        // O modo troca sozinho a cada 8 a 16 s, e a passagem de um para o outro é suave (sem tranco).
        const now = performance.now()
        if (now > leanSwitch) { leanSwitch = now + 8000 + Math.random() * 8000; leanTarget = -1 } // sempre ao contrário do mouse (pedido): só os olhos seguem
        leanDir += (leanTarget - leanDir) * Math.min(1, frame.dt * 0.8)
        const counter = (1 - leanDir) / 2 // 0 seguindo, 1 ao contrário
        for (const key of Object.keys(slow)) {
          // A inclinação inicial do personagem (Yuno: -4 graus) é o "centro" dele: o passa-altas só age em volta dela.
          const base = key === 'angleZ' ? baseZRef.current : 0
          const v = ((frame.params as unknown as Record<string, number>)[key] ?? 0) - base
          slow[key] += (v - slow[key]) * k
          // Ao contrário: a cabeça quase não vira para o mouse (só os olhos seguem).
          const gain = (key === 'angleZ' && fixedBase.current ? 1 : GAIN[key]) * (key === 'angleX' ? 1 - 0.6 * counter : 1)
          ;(frame.params as unknown as Record<string, number>)[key] = (v - slow[key] * 0.92) * gain + base
        }
        // Corpo no grupo da cabeça (Bia, Yuno, Yuri): o desenho todo gira em volta da cabeça, então a base balançaria. A inclinação do
        // tronco (bodyZ) vira inclinação (angleZ) e o desenho é deslocado de volta na mesma medida: o giro passa a ser em volta
        // da cintura (a base, embaixo, fica parada) e o resto inclina para o lado, como no Luck.
        // Medido: 1 grau de angleZ desloca a base 0,0013 da largura.
        if (fixedBase.current) {
          const pr = frame.params as unknown as Record<string, number>
          // Mouse de um lado para o outro: além de virar a cabeça (angleX), o desenho inclina para o lado do mouse (o jeito da Yuno),
          // sempre em volta da base: o deslocamento abaixo mantém a margem de baixo no lugar.
          pr.angleZ = (pr.angleZ ?? 0) + (3 * (pr.bodyZ ?? 0) + 0.5 * (pr.angleX ?? 0) / Math.max(0.4, 1 - 0.6 * counter)) * leanDir
          frame.move.x += basePerDeg.current * (pr.angleZ - baseZRef.current)
        } else {
          // Luck (corpo em grupo próprio): o tronco inclina pelo bodyZ do player, na direção do modo atual.
          const pr = frame.params as unknown as Record<string, number>
          pr.bodyZ = ((pr.bodyZ ?? 0) + 0.2 * (pr.angleX ?? 0) / Math.max(0.4, 1 - 0.6 * counter)) * leanDir
        }
        for (const key of Object.keys(STATIC_GAIN)) {
          const v = (frame.params as unknown as Record<string, number>)[key]
          if (typeof v === 'number') (frame.params as unknown as Record<string, number>)[key] = v * STATIC_GAIN[key]
        }
      },
    })
    // Piscadinha: a cabeça inclina para o lado do olho aberto (na tela, o da direita) e desce um pouco, o olho aberto fecha um
    // pouco e tudo volta suave.
    let wink = 0
    const removeWink = p.use({
      order: 8,
      update(frame) {
        if (paintedRef.current) return
        const shown = (p as unknown as { shownExpr?: Record<string, number> }).shownExpr
        const target = Math.min(1, shown?.x_wink ?? 0)
        wink += (target - wink) * Math.min(1, frame.dt * 8)
        if (wink < 0.01) return
        const pr = frame.params as unknown as Record<string, number>
        pr.angleZ = (pr.angleZ ?? 0) - 6 * wink
        pr.angleY = (pr.angleY ?? 0) - 5 * wink
        pr.eyeLOpen = (pr.eyeLOpen ?? 1) * (1 - 0.4 * wink)
        pr.eyeROpen = (pr.eyeROpen ?? 1) * (1 - 0.4 * wink)
        if (fixedBase.current) frame.move.x -= basePerDeg.current * 6 * wink // a base continua parada
      },
    })
    // Movimentos curtos (acenar, negar, inclinar, timidez). Nos personagens com o corpo no grupo da cabeça, o `act` do player
    // (aplicado depois dos drivers) balançaria a base: aqui eles viram só cabeça e tronco para cima, com a base compensada.
    const acts: { kind: Action; amt: number; t0: number; dur: number }[] = []
    const origAct = p.act.bind(p)
    ;(p as unknown as { act: (a: Action, s?: number) => void }).act = (a, st = 1) => {
      if (!fixedBase.current) return origAct(a, st)
      acts.push({ kind: a, amt: st, t0: performance.now(), dur: a === 'shake' ? 1100 : a === 'nod' ? 800 : 1300 })
    }
    const removeActs = p.use({
      order: 9,
      update(frame) {
        if (!acts.length || paintedRef.current) return
        const now = performance.now()
        const pr = frame.params as unknown as Record<string, number>
        let dz = 0
        for (let i = acts.length - 1; i >= 0; i--) {
          const a = acts[i]
          const u = (now - a.t0) / a.dur
          if (u >= 1) { acts.splice(i, 1); continue }
          const env = Math.sin(Math.PI * u)
          if (a.kind === 'nod') pr.angleY = (pr.angleY ?? 0) - 9 * a.amt * env
          else if (a.kind === 'shake') pr.angleX = (pr.angleX ?? 0) + 10 * a.amt * env * Math.sin(u * Math.PI * 4)
          else if (a.kind === 'tilt') dz += 4.5 * a.amt * env
          else if (a.kind === 'shy') { dz += 4 * a.amt * env; pr.angleY = (pr.angleY ?? 0) - 4 * a.amt * env }
        }
        pr.angleZ = (pr.angleZ ?? 0) + dz
        frame.move.x += basePerDeg.current * dz
      },
    })
    // Linguagem corporal: a cabeça e o olhar acompanham a emoção desenhada, o gesto e o momento (ouvir, pensar, falar).
    const removeBodyLanguage = installBodyLanguage(p, {
      state: () => stateRef.current,
      mood: () => (moodRef.current === 'confused' ? 'confused' : null),
      gesture: () => gestureRef.current?.get() ?? 'neutro',
      fixedBase: () => fixedBase.current,
      basePerDeg: () => basePerDeg.current,
      off: () => paintedRef.current,
    })
    // Seguir o mouse (personagens pintados). O player quase não virava a cabeça para o cursor e a íris andava ~2 px.
    // Hierarquia de animação: o olho chega primeiro (~0,07 s), a cabeça logo depois (~0,3 s) e o corpo por último (~0,6 s).
    // O corpo vai para o lado OPOSTO ao do mouse: quem olha algo do lado se afasta um pouco para enxergar melhor.
    // Sem mexer o mouse por uns segundos, o olhar volta para a pessoa (os olhares de lado e o "pensando" voltam a valer).
    // Mouse rodando rápido em volta do personagem: ele fica tonto (surpresa, cabeça e olhos girando e a frase no balão).
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
    const look = { px: 0, py: 0, at: -1e9, hx: 0, hy: 0, w: 0, ex: 0, ey: 0, hdx: 0, hdy: 0, bx: 0 }
    const spin = { acc: 0, t: 0, last: NaN, cool: 0, t0: -1e9 }
    const onPtr = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const now = performance.now()
      look.px = e.clientX; look.py = e.clientY; look.at = now
      if (!stageRef.current || !paintedRef.current || !visibleRef.current) return
      const dx = e.clientX - look.hx, dy = e.clientY - look.hy
      if (Math.hypot(dx, dy) < 40) { spin.last = NaN; return }
      const th = Math.atan2(dy, dx)
      if (!Number.isNaN(spin.last)) {
        let d = th - spin.last
        if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI
        spin.acc = spin.acc * Math.exp(-(now - spin.t) / 2500) + d
        // ~1,3 volta acumulada no mesmo sentido, rodando rápido (uma volta lenta some antes de chegar lá)
        if (Math.abs(spin.acc) > 2.6 * Math.PI && now > spin.cool) {
          spin.acc = 0; spin.cool = now + 12000; spin.t0 = now
          dizzyRef.current()
        }
      }
      spin.last = th; spin.t = now
    }
    const onOut = (e: PointerEvent) => { if (!e.relatedTarget) look.at = -1e9 }
    window.addEventListener('pointermove', onPtr, { passive: true })
    document.addEventListener('pointerout', onOut)
    const removeFollow = p.use({
      order: 9.5,
      update(frame) {
        if (!paintedRef.current) return
        const dt = Math.max(1e-4, Math.min(0.05, frame.dt)) // quadro sem tempo (redesenho) ainda aplica a pose atual
        const now = performance.now()
        const pr = frame.params as unknown as Record<string, number>
        const rect = canvas.getBoundingClientRect()
        const a = p.getAnchor('head')
        let tx = 0, ty = 0, want = 0
        if (a && rect.width) {
          look.hx = rect.left + a.x * rect.width; look.hy = rect.top + a.y * rect.height
          if (now - look.at < 4500 && stateRef.current !== 'thinking') {
            const span = clamp(window.innerWidth * 0.45, 260, 700)
            tx = clamp((look.px - look.hx) / span, -1, 1); ty = clamp((look.py - look.hy) / span, -1, 1)
            want = 1
          }
        }
        const ease = (tau: number) => 1 - Math.exp(-dt / tau)
        look.w += (want - look.w) * ease(want ? 0.2 : 0.9)
        look.ex += (tx - look.ex) * ease(0.07)
        look.ey += (ty - look.ey) * ease(0.07)
        look.hdx += (tx * want - look.hdx) * ease(0.3)
        look.hdy += (ty * want - look.hdy) * ease(0.3)
        look.bx += (tx * want - look.bx) * ease(0.6)
        const w = look.w
        // olhos: a íris ganhou mais alcance no carregamento; aqui ela vai até a borda com o mouse longe
        pr.eyeBallX = (pr.eyeBallX ?? 0) * (1 - w) + clamp(look.ex * 1.4, -1, 1) * w
        pr.eyeBallY = (pr.eyeBallY ?? 0) * (1 - w) + clamp(-look.ey * (look.ey > 0 ? 1.7 : 1.3), -1, 1) * w
        // cabeça: vira e inclina um pouco para o lado do mouse (menos enquanto fala, para a fala mandar)
        const hk = stateRef.current === 'speaking' ? 0.6 : 1
        pr.angleX = (pr.angleX ?? 0) + look.hdx * 14 * hk
        // para baixo a cabeça abaixa mais (é para onde a pessoa costuma levar o mouse: os botões ficam embaixo)
        pr.angleY = (pr.angleY ?? 0) - look.hdy * (look.hdy > 0 ? 13 : 7) * hk
        pr.angleZ = (pr.angleZ ?? 0) - look.hdx * 3 * hk
        // olhando para baixo: a pálpebra de cima acompanha o olho e fecha um pouco, e a sobrancelha desce de leve
        // (a sobrancelha é da textura do rosto: o campo dela fica em painted/index.ts e lê `lookDown`)
        const down = clamp(look.ey, 0, 1) * w
        pr.lookDown = down
        pr.eyeLOpen = (pr.eyeLOpen ?? 1) * (1 - 0.22 * down)
        pr.eyeROpen = (pr.eyeROpen ?? 1) * (1 - 0.22 * down)
        // corpo: lido pelo movimento_natural de cada pintado (deslocamento da malha, base parada)
        pr.pointerLean = -look.bx
        // tonto: a cabeça e os olhos giram em círculo e o giro some em ~1,8 s
        const u = (now - spin.t0) / 1800
        if (u >= 0 && u < 1) {
          const env = Math.min(1, u * 5) * (1 - u) * (1 - u)
          const ph = u * 1.8 * 2 * Math.PI * 1.4 // ~1,4 volta por segundo
          pr.angleX += 5 * env * Math.sin(ph)
          pr.angleZ += 4 * env * Math.cos(ph)
          pr.eyeBallX = pr.eyeBallX * (1 - env) + Math.sin(ph * 1.3) * env
          pr.eyeBallY = pr.eyeBallY * (1 - env) + Math.cos(ph * 1.3) * env
        }
      },
    })
    // Voz do navegador (português): a boca segue o relógio da fala, suavizada.
    let open = 0, vowel = 0
    const removeBrowserVoice = p.use({
      order: 11,
      update(frame) {
        const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
        if (!speakingRef.current || !synth?.speaking) { open = 0; vowel = 0; return }
        const clock = getSpeechClock()
        const pos = clock?.position() ?? null
        const target = clock && pos !== null ? mouthForChar(clock.text[Math.floor(pos)] ?? ' ') : { open: 0, vowel: 0 }
        open += (target.open - open) * 0.45
        vowel += (target.vowel - vowel) * 0.3
        frame.params.mouthOpen = Math.max(frame.params.mouthOpen ?? 0, open)
        frame.params.vowel = vowel
      },
    })
    // Sobrancelhas das reações: sobem (ou descem) e voltam devagar; pensando, ficam um pouco franzidas.
    const removeBrows = p.use({
      update(frame) {
        browRef.current *= Math.pow(0.25, frame.dt)
        if (shownExprRef.current) return
        const b = browRef.current + (stateRef.current === 'thinking' ? -0.25 : stateRef.current === 'listening' ? 0.12 : 0)
        if (Math.abs(b) > 0.01) frame.add({ browLY: b, browRY: b })
      },
    })
    // Posição da cabeça, poucas vezes por segundo (o balão de fala segue o personagem e o enquadramento).
    let lastHead = 0
    let prevKey = ''
    p.onFrame = () => {
      const now = performance.now()
      // Só depois de o personagem aparecer: antes disso a cabeça ainda não está no lugar (o balão esperaria no ar).
      if (!headRef.current || !visibleRef.current || now - lastHead < 250) return
      lastHead = now
      const a = p.getAnchor('head')
      if (!a) return
      const w = canvas.clientWidth, h = canvas.clientHeight
      const width = a.scale * w
      const head = { x: Math.round(a.x * w), top: Math.round(a.y * h - width * topFactor.current), width: Math.round(width) }
      const key = `${Math.round(head.x / 6)}|${Math.round(head.top / 6)}|${Math.round(head.width / 6)}`
      if (key === prevKey) return
      prevKey = key
      headRef.current(head)
    }
    playerRef.current = p
    setPlayer(p)
    if (import.meta.env.DEV) ((window as unknown as { __livliv?: Player[] }).__livliv ??= []).push(p)
    return () => {
      removeFollow()
      window.removeEventListener('pointermove', onPtr)
      document.removeEventListener('pointerout', onOut)
      removeBrows()
      removeWink()
      removeBodyLanguage()
      removeActs()
      removeRecenter()
      paintedCtl.current?.dispose()
      paintedCtl.current = null
      gestureRef.current?.dispose()
      gestureRef.current = null
      removeBrowserVoice()
      p.dispose({ release: true })
      playerRef.current = null
      setPlayer(null)
      setReady(false)
    }
    // O player nasce uma vez; as opções que mudam são aplicadas nos efeitos abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Trocar de personagem só troca o modelo: o player, a voz e a conversa continuam.
  useEffect(() => {
    if (!player) return
    const token = ++loadToken.current
    setReady(false)
    paintedCtl.current?.dispose()
    paintedCtl.current = null
    const painted = !!characterById(characterId)?.painted
    paintedRef.current = painted
    player.load(characterModelUrl(characterId), stage ? undefined : { poster: characterAvatarUrl(characterId) })
      .then(async info => {
        // Palco: da cabeça à cintura (corpo inteiro também corta na cintura). Avatar pequeno: só a cabeça.
        // Inclinação inicial própria do personagem (aplicada depois do carregamento) e corpo em neutro.
        baseZRef.current = characterById(characterId)?.baseAngleZ ?? 0
        player.params.angleZ = baseZRef.current
        fixedBase.current = !!characterById(characterId)?.bodyInHead
        basePerDeg.current = characterById(characterId)?.basePerDeg ?? 0.0013
        player.bodyMotion = fixedBase.current || painted ? 0 : 0.5
        // Bia pintada: adaptadores aplicados uma vez por carregamento (queixo, boca contínua, cabeça por gesto, mechas, roupa, brincos).
        // Só o carregamento mais recente instala (no StrictMode e em trocas rápidas o efeito roda mais de uma vez; um adaptador
        // instalado no puppet de uma carga antiga deixava o atual sem reações, boca e cabeça natural).
        if (token !== loadToken.current) return
        if (painted) {
          const puppet = (player as unknown as { puppet?: object }).puppet
          const ctl = await setupPainted(characterById(characterId)?.painted ?? 'bia', player, characterBaseUrl(characterId))
          if (token !== loadToken.current || playerRef.current !== player || (player as unknown as { puppet?: object }).puppet !== puppet) { ctl.dispose(); return }
          paintedCtl.current = ctl
          // A íris dos pintados andava ~3 px (olho de ~100 px): passa a andar até ~2,2x isso; a máscara do olho continua
          // recortando, então ela nunca sai do branco do olho. Cada carregamento traz um modelo novo (não acumula).
          const byId = (player as unknown as { puppet?: { byId?: Map<string, { def?: { range?: number[]; bkIris?: boolean } }> } }).puppet?.byId
          for (const id of ['iris_L', 'iris_R']) {
            const d = byId?.get(id)?.def
            if (d?.range && d.range.length >= 2 && !d.bkIris) { d.bkIris = true; d.range = [d.range[0] * 2.2, d.range[1] * 2.2] }
          }
        }
        gestureRef.current?.set('neutro')
        player.view.head = !stage && size < 120
        if (info.fullBody) player.view.fit = 'frame'
        // Palco: ajusta o enquadramento ANTES de mostrar (o personagem só aparece já no lugar, encostado embaixo).
        if (stage) await frameStage()
        // Avatar pequeno de um pintado (painel do tutor): o modo cabeça do player mostrava o corpo inteiro nesses rigs;
        // enquadra pela cabeça medida no model.json.
        else if (painted && player.view.head) frameHead(player)
        if (playerRef.current === player) setReady(true)
      })
      .catch((e: Error & { name?: string }) => {
        if (e.name === 'AbortError') return
        console.warn('[livliv] personagem não carregou:', e)
        failRef.current?.()
      })
  }, [player, characterId, size, stage])

  // Avatar pequeno: a cabeça (anchors.head do model.json, com o cabelo) ocupa o quadro, centralizada. O deslocamento é medido
  // e conferido pelo próprio player (canvasToModel), então não depende do sentido dos eixos de view.x/view.y. A conversão só
  // é atualizada quando o player desenha: cada ajuste é seguido de um draw(0).
  function frameHead(p: Player) {
    const head = (p as unknown as { puppet?: { model?: { anchors?: { head?: { cx: number; cy: number; ry: number } } } } }).puppet?.model?.anchors?.head
    const c = canvasRef.current
    if (!head || !c || !c.clientWidth) return
    const w = c.clientWidth, h = c.clientHeight
    p.view.head = false
    p.view.fit = 'frame'
    const redraw = () => (p as unknown as { draw?: (dt: number) => void }).draw?.(0)
    p.view.x = 0; p.view.y = 0; p.view.zoom = 1
    redraw()
    const span = () => p.canvasToModel(0, h)[1] - p.canvasToModel(0, 0)[1]
    const spanX = () => p.canvasToModel(w, 0)[0] - p.canvasToModel(0, 0)[0]
    p.view.zoom = span() / (head.ry * 2 * 1.18)
    redraw()
    const center = () => p.canvasToModel(w / 2, h / 2)
    for (const axis of ['x', 'y'] as const) {
      const i = axis === 'x' ? 0 : 1, target = axis === 'x' ? head.cx : head.cy - head.ry * 0.08
      const err0 = target - center()[i]
      const step = err0 / (axis === 'x' ? spanX() : span())
      p.view[axis] = step
      redraw()
      // se o erro aumentou, o eixo anda no sentido contrário
      if (Math.abs(target - center()[i]) > Math.abs(err0)) { p.view[axis] = -step; redraw() }
    }
  }

  // Palco: enquadramento conforme o formato da tela (celular em pé, tablet, desktop).
  async function frameStage(): Promise<void> {
    const p = playerRef.current, c = canvasRef.current
    if (!p || !c || !c.clientWidth) return
    const tall = c.clientHeight / c.clientWidth
    // Um pouco maior que o enquadramento padrão e subindo (y positivo), para aparecer inteiro até a cintura.
    p.view.zoom = (tall > 1.3 ? 1.04 : tall > 1 ? 1 : 0.96) * (characterById(characterId)?.zoomK ?? 1)
    const baseY = tall > 1.3 ? 0.06 : tall > 1 ? 0.04 : 0.02
    const key = `${characterId}|${tall.toFixed(2)}`
    const known = framingCache[key]
    if (known) { p.view.y = known.y; topFactor.current = known.top; return }
    // Mede com o personagem mais abaixo: com zoom maior (Yuno, Yuri) o topo do cabelo saía da tela nessa medição e o
    // topo era achado na linha 0 (o balão ficava em cima da cabeça). Depois sobe para o lugar certo.
    const yMeasure = baseY - 0.25
    p.view.y = yMeasure
    // Cada personagem tem uma altura de cabeça e um volume de cabelo: com o primeiro quadro desenhado, mede o topo real
    // do desenho (pixels da imagem) e acerta o enquadramento para esse topo ficar sempre na mesma faixa, e guarda a
    // proporção para o balão ficar acima do cabelo, não da cabeça estimada.
    await frames(2)
    const q = playerRef.current, cv = canvasRef.current
    const a = q?.getAnchor('head')
    if (!q || !cv || !a) return
    const w = cv.clientWidth, h = cv.clientHeight
    // Desenha o quadro atual antes da foto: com a aba em segundo plano ou logo após trocar de personagem, o último quadro
    // ainda podia ser do personagem anterior (o topo do cabelo saía errado e o balão ficava em cima da cabeça).
    ;(q as unknown as { draw?: (dt: number) => void }).draw?.(0)
    const img = new Image()
    img.src = q.snapshot()
    try { await img.decode() } catch { return }
    const sw = 120, sh = Math.max(1, Math.round(sw * img.height / img.width))
    const off = document.createElement('canvas')
    off.width = sw; off.height = sh
    const g = off.getContext('2d', { willReadFrequently: true })
    if (!g) return
    g.drawImage(img, 0, 0, sw, sh)
    const data = g.getImageData(0, 0, sw, sh).data
    let row = -1
    // Só a faixa do meio: a marca fica no canto de baixo e nada do personagem passa da lateral.
    for (let y = 0; y < sh && row < 0; y++) for (let x = Math.round(sw * 0.15); x < sw * 0.85; x++) if (data[(y * sw + x) * 4 + 3] > 40) { row = y; break }
    if (row < 0) return
    const hairTop = (row / sh) * h
    topFactor.current = (a.y * h - hairTop) / Math.max(1, a.scale * w)
    // Topo do cabelo logo abaixo da área do balão (o balão fica perto do cabeçalho).
    // Mesma faixa para todos: a Bia (desenho mais curto embaixo) não sobe além disso sem abrir vão; os outros descem até ela.
    // Topo do cabelo numa faixa comum; os adolescentes ficam um pouco mais baixos que os adultos (altura de verdade).
    const target = Math.min(150, Math.max(100, h * 0.15)) + (characterById(characterId)?.young ? h * 0.035 : 0)
    // O personagem está em pé: a base tem que encostar embaixo. Com o enquadramento mais aberto (Bia e Luck mostram mais do
    // corpo) sobrava um vão embaixo no celular. Calcula pelo mesmo quadro já desenhado (sem depender de outro quadro, que
    // numa aba em segundo plano não vem): onde a borda de baixo do quadro cai no desenho do modelo, e quanto subir o
    // personagem para o cabelo ficar abaixo do balão abre de vão. Se abrir, desce o que faltar; o balão segue a cabeça.
    const candidate = yMeasure + (hairTop - target) / h
    const top = q.canvasToModel(w / 2, 0), bottom = q.canvasToModel(w / 2, h)
    const modelH = (q as unknown as { info?: { size?: [number, number] } }).info?.size?.[1] ?? 1536
    const perPx = (bottom[1] - top[1]) / Math.max(1, h) // px do modelo por px do quadro
    const gap0 = perPx > 0 ? Math.max(-h, (bottom[1] - modelH) / perPx) : 0 // >0: o desenho acaba antes da borda
    const gapFinal = gap0 + (candidate - yMeasure) * h
    q.view.y = gapFinal > 0 ? candidate - gapFinal / h : candidate
    saveFraming(key, { y: q.view.y, top: topFactor.current })
    await frames(1)
  }
  useEffect(() => {
    if (!stage) return
    const onResize = () => { void frameStage() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // A voz do app passa a tocar por este <audio>, ligado ao lip sync do LivLiv.
  useEffect(() => {
    if (!voice || !player) return
    const el = new Audio()
    el.preload = 'auto'
    let sync: LipSync | null = null
    let cancelled = false
    let attached = false
    const release = borrowPlaybackElement(el)
    // O lip sync passa o <audio> pelo Web Audio, e o navegador só libera o som dele num gesto da pessoa.
    // Por isso a ligação acontece dentro do primeiro toque ou tecla: até lá a voz toca normal, sem boca,
    // e nunca fica muda. (Na conversa, o toque em "Começar" já faz isso antes da primeira fala.)
    const attach = () => {
      if (cancelled || attached) return
      attached = true
      off()
      // Só a boca segue a voz: sem balanço de cabeça nem pulinhos por sílaba (movimentos próprios ficam por conta do idle).
      startLipSync(player, el, { motion: 0, bounce: false })
        .then(s => { if (cancelled) s.stop(); else sync = s })
        .catch(e => console.warn('[livliv] lip sync indisponível:', e))
    }
    // Fonemas reais (Kokoro): depois do lip sync por amplitude (order 10), a boca passa a seguir o fonema da vez, lido no
    // relógio deste <audio>. Antecipa o que a suavização da boca atrasa (abertura ~50 ms, formato ~80 ms). Sem trilha
    // (pausa, fim, interrupção, outra voz) não escreve nada e a boca fecha pelo próprio lip sync.
    let lastVoiced = 0
    const removePhones = player.use({
      order: 10.5,
      update(frame) {
        const t = activeVisemeTrack(el)
        if (!t) return
        const d = t.el.duration, r = t.el.playbackRate || 1
        const now = t.el.currentTime
        const a = shapeAt(t, (now + 0.062 * r) / d)
        const v = shapeAt(t, (now + 0.08 * r) / d)
        // O som de verdade manda no silêncio: com o lip sync por amplitude ligado (Web Audio), se não há voz neste instante
        // a boca não fica aberta só porque o fonema ainda "dura" (fim de frase arrastado, respiração).
        // Só fecha depois de ~120 ms sem voz: o começo da sílaba continua adiantado pelos fonemas (a amplitude chega atrasada).
        const amp = frame.params.mouthOpen ?? 0
        const nowMs = performance.now()
        if (amp > 0.06 || !sync) lastVoiced = nowMs
        const quiet = nowMs - lastVoiced
        const gate = quiet < 120 ? 1 : Math.max(0, 1 - (quiet - 120) / 80)
        // ganho por personagem: nos adolescentes a abertura máxima do rig é grande demais para conversa comum
        frame.params.mouthOpen = a.open * gate * (characterById(characterIdRef.current)?.mouthGain ?? 1)
        frame.params.vowel = v.vowel
      },
    })
    // Atuação da cabeça enquanto fala (pesquisa de gesto co-verbal + animação de diálogo):
    // - frase, não palavra: cada frase nova leva a cabeça a uma pose (vira/inclina um pouco), alternando o lado na maioria
    //   das vezes e com amplitude que varia; perguntas terminam com o queixo um pouco acima e a cabeça inclinada;
    // - acentos: o pico do aceno cai na sílaba tônica real (fonemas do Kokoro), ~100 ms adiantado como o ápice do gesto, só
    //   em parte das tônicas e com intervalo mínimo (nada de tique por sílaba);
    // - moving hold: entre uma coisa e outra a cabeça nunca congela, deriva bem pouco;
    // - riso: frase com "haha"/"kkk" balança a cabeça como numa risada, decaindo.
    // Escreve em speechYaw/Pitch/Roll (os rigs pintados somam à cabeça) e speaking (a inclinação lenta do idle diminui).
    const LAUGH = /\b(ha ?ha+|he ?he+|lol|k{3,}|(rs){2,})\b|😂|🤣/i
    const act = { text: '', side: Math.random() < 0.5 ? 1 : -1, tgt: [0, 0, 0], cur: [0, 0, 0], beat: 0, beatV: 0, lastBeat: 0, nextS: -1, laugh: 0, t: 0, prev: 0 }
    const removeActing = player.use({
      order: 10.6,
      update(frame) {
        const nowS = performance.now() / 1000
        const dt = Math.min(0.05, act.prev ? nowS - act.prev : 0.016)
        act.prev = nowS; act.t += dt
        const pr = frame.params as unknown as Record<string, number>
        const speaking = stateRef.current === 'speaking'
        const text = speaking ? textRef.current.trim() : ''
        // Frase nova: nova pose.
        if (text && text !== act.text) {
          act.text = text
          if (Math.random() < 0.72) act.side = -act.side
          const s = act.side, big = Math.random() < 0.3 ? 1.4 : 1
          act.tgt = [s * (3 + Math.random() * 4) * big, -1.5 + Math.random() * 3, s * (2.2 + Math.random() * 3) * big * (Math.random() < 0.2 ? -1 : 1)]
          if (text.endsWith('?')) { act.tgt[1] += 3; act.tgt[2] += s * 2.5 }
          act.laugh = LAUGH.test(text) ? 1 : 0
          act.nextS = -1
        }
        if (!speaking) { act.text = ''; act.tgt = [0, 0, 0]; act.laugh = 0 }
        // Pose: chega com suavidade (~0,35 s) e segura com uma deriva lenta.
        const k = 1 - Math.exp(-dt / (speaking ? 0.35 : 0.6))
        for (let i = 0; i < 3; i++) act.cur[i] += (act.tgt[i] - act.cur[i]) * k
        const drift = speaking ? [Math.sin(act.t * 0.7) * 0.9, Math.sin(act.t * 0.53 + 1) * 0.6, Math.sin(act.t * 0.41 + 2) * 0.7] : [0, 0, 0]
        // Acento: aceno curto na tônica (mola), só em parte delas.
        const t = activeVisemeTrack(el)
        if (t && speaking) {
          const f = (t.el.currentTime + 0.1 * (t.el.playbackRate || 1)) / t.el.duration
          if (act.nextS < 0 || act.nextS < f - 0.02) act.nextS = nextStress(t, f - 0.01) ?? 2
          if (act.nextS <= f && act.nextS < 2) {
            if (nowS - act.lastBeat > 0.55 && Math.random() < 0.6) { act.beatV -= 110 + Math.random() * 50; act.lastBeat = nowS }
            act.nextS = nextStress(t, act.nextS + 0.001) ?? 2
          }
        }
        act.beatV += (-140 * act.beat - 16 * act.beatV) * dt
        act.beat += act.beatV * dt
        // Riso: balanço rápido que vai diminuindo.
        if (act.laugh > 0.01) act.laugh *= Math.exp(-dt / 1.6)
        const laugh = act.laugh * Math.sin(act.t * Math.PI * 2 * 4.2) * 4
        pr.speechYaw = act.cur[0] + drift[0]
        pr.speechPitch = act.cur[1] + drift[1] + act.beat + laugh
        pr.speechRoll = act.cur[2] + drift[2] + laugh * 0.4
        pr.speaking = speaking ? 1 : 0
        // Personagens sem os adaptadores pintados recebem direto nos ângulos.
        if (!paintedRef.current) { pr.angleX = (pr.angleX ?? 0) + pr.speechYaw; pr.angleY = (pr.angleY ?? 0) + pr.speechPitch; pr.angleZ = (pr.angleZ ?? 0) + pr.speechRoll }
      },
    })
    const EVENTS = ['pointerdown', 'keydown', 'touchend'] as const
    const off = () => EVENTS.forEach(t => window.removeEventListener(t, attach, true))
    EVENTS.forEach(t => window.addEventListener(t, attach, true))
    return () => {
      cancelled = true
      off()
      removePhones()
      removeActing()
      sync?.stop()
      release()
    }
  }, [voice, player])

  useEffect(() => { if (player) player.followPointer = followPointer ? 'page' : false }, [player, followPointer])

  // Cada personagem fala com a própria voz (gênero e tom), a partir da próxima frase.
  useEffect(() => {
    if (!voice) return
    const v = characterById(characterId)?.voice
    if (!v) return
    setSpeakerVoice(v)
    return () => clearSpeakerVoice(v)
  }, [voice, characterId])

  // Pensando: olha para cima, de lado. Ouvindo e falando: olha para a pessoa.
  useEffect(() => {
    if (!player || !ready) return
    // Pensando: olha para cima, com bem pouco desvio lateral (olhar muito para o lado a deixava pendendo para a direita).
    if (state === 'thinking') player.lookAt(0.12, 0.45)
    else player.lookAt(null) // ouvindo e falando: o olhar continua seguindo o mouse, como antes da conversa
  }, [player, ready, state])

  // Expressão que existe neste modelo (ou nenhuma).
  const hasExpr = (p: Player, id: string | null) => (id && p.expressions.some(e => e.id === id) ? id : null)
  /** Reação: expressão (por um instante, ou fixa), movimento e sobrancelhas. */
  const react = (r: Reaction, hold = false, ms = 1400) => {
    const p = playerRef.current
    if (!p) return
    if (r.act) p.act(r.act[0], r.act[1])
    if (r.brow) browRef.current = r.brow
    const expr = hasExpr(p, r.expr)
    if (hold) {
      moodExprRef.current = expr; shownExprRef.current = expr; window.clearTimeout(restoreTimer.current); p.setExpression(expr)
      // Personagem com gestos: a expressão é breve (olhos fechados do sorriso, surpresa) e volta ao neutro; o corpo segue a fala.
      if (expr && characterById(characterId)?.gestures) {
        restoreTimer.current = window.setTimeout(() => { moodExprRef.current = null; shownExprRef.current = null; playerRef.current?.setExpression(null) }, expr === 'sad' || expr === 'angry' ? 3600 : 2600)
      }
      return
    }
    if (expr) {
      p.setExpression(expr)
      shownExprRef.current = expr
      window.clearTimeout(restoreTimer.current)
      restoreTimer.current = window.setTimeout(() => { shownExprRef.current = moodExprRef.current; playerRef.current?.setExpression(moodExprRef.current) }, ms)
    }
  }
  useEffect(() => () => window.clearTimeout(restoreTimer.current), [])

  // Humor escolhido pela IA a cada resposta: fica no rosto até o próximo.
  useEffect(() => {
    if (!player || !ready) return
    react(MOOD_REACTION[mood] ?? MOOD_REACTION.neutral, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, ready, mood, characterId])

  // Durante a conversa: concorda quando a pessoa termina de falar; fica triste com erro.
  const prevState = useRef<VoiceState>(state)
  useEffect(() => {
    const prev = prevState.current
    prevState.current = state
    if (!player || !ready) return
    if (prev === 'listening' && state === 'thinking') react({ expr: null, act: ['nod', 0.6], brow: 0.3 })
    else if (prev === 'thinking' && state === 'speaking') browRef.current = 0.35
    // Microfone bloqueado ou ausente: ela se assusta (o texto sai pela tela de conversa).
    else if (state === 'error') react({ expr: 'surprised', act: ['shake', 0.25], brow: 0.9 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, ready, state])

  // Cada frase: o rosto acompanha o que ela diz, só quando o texto pede (elogio, surpresa, pena, riso...). Nas demais,
  // fica neutro, com uma sobrancelha mais alta nas perguntas e um aceno leve de vez em quando: nada forçado.
  const lastTextMood = useRef(0)
  useEffect(() => {
    if (!player || !ready || state !== 'speaking' || gestures) return
    const t = speakingText.trim()
    if (!t) return
    const m = moodFromText(t)
    const now = performance.now()
    if (m && now - lastTextMood.current > 2500) { lastTextMood.current = now; react(MOOD_REACTION[m]); return }
    if (t.endsWith('?')) browRef.current = 0.45
    else if (Math.random() < 0.22) player.act('nod', 0.22)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, ready, speakingText])

  // Corpo e rosto (personagens com gestos): o diretor escolhe gestos e reações pela fala, com pose mínima de 3 s.
  const directorRef = useRef<GestureDirector | null>(null)
  // Olhar: com o mouse parado, cada troca de gesto ou de expressão leva os olhos um pouco para o lado e de volta.
  // Se o mouse estiver se mexendo, o olho segue o mouse (sem o desvio).
  const lastPointer = useRef(0)
  const glanceTimer = useRef(0)
  const glanceSide = useRef(1)
  const glanceRef = useRef<() => void>(() => {})
  glanceRef.current = () => {
    const p = playerRef.current
    if (!p || (stateRef.current !== 'speaking' && stateRef.current !== 'idle')) return
    if (performance.now() - lastPointer.current < 1500) return
    glanceSide.current = -glanceSide.current
    p.lookAt(glanceSide.current * (0.14 + Math.random() * 0.2), 0.03 + (Math.random() - 0.5) * 0.22)
    window.clearTimeout(glanceTimer.current)
    glanceTimer.current = window.setTimeout(() => {
      const q = playerRef.current
      if (!q) return
      if (stateRef.current === 'speaking' || stateRef.current === 'idle') q.lookAt(null)
    }, 1100 + Math.random() * 900)
  }
  useEffect(() => {
    const mv = () => { lastPointer.current = performance.now() }
    window.addEventListener('pointermove', mv, { passive: true })
    return () => { window.removeEventListener('pointermove', mv); window.clearTimeout(glanceTimer.current) }
  }, [])
  const gestures = !!characterById(characterId)?.gestures
  useEffect(() => {
    const g = gestureRef.current
    if (!player || !ready || !g || !gestures) { directorRef.current = null; return }
    const d = new GestureDirector({
      control: g,
      face: (m, ms) => react(MOOD_REACTION[m] ?? MOOD_REACTION.neutral, false, ms),
      act: (a, n) => { if (!paintedRef.current) player.act(a, n) }, // Bia pintada: a cabeça responde só à troca de gesto
      text: () => textRef.current,
      mood: () => moodRef.current,
      glance: () => glanceRef.current(),
    })
    directorRef.current = d
    if (import.meta.env.DEV) (window as unknown as { __dir?: GestureDirector; __txt?: { current: string } }).__dir = d
    return () => { d.stop(); directorRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, ready, characterId, gestures])

  useEffect(() => {
    const d = directorRef.current
    if (!d) return
    if (state === 'speaking') d.startSpeech()
    else if (state === 'thinking') d.think()
    else if (state === 'listening' || state === 'error') d.listen()
    // idle: não mexe (a chegada pode estar em andamento)
  }, [player, ready, state, characterId, gestures])

  useEffect(() => { if (speakingText) directorRef.current?.onSentence(speakingText) }, [speakingText])

  // Espera: as expressões dos convites podem levar a mão ao queixo; o corpo quase não troca de pose.
  useEffect(() => {
    if (!ready || !gestures || !stage || state !== 'idle') return
    directorRef.current?.wait(mood)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, ready, gestures, stage])

  // Chegada: ao aparecer (carregou e a "ligação" acabou), um gesto de acolhida com um sorriso breve.
  useEffect(() => {
    if (!ready || calling || !gestures || !stage) return
    const t = window.setTimeout(() => { if (stateRef.current === 'idle') directorRef.current?.intro() }, 500)
    return () => window.clearTimeout(t)
  }, [ready, calling, characterId, gestures, stage])

  // Saudação: um aceno de cabeça suave (nada de pulinho).
  useEffect(() => { if (player && ready && wave) player.act('nod', 0.35) }, [player, ready, wave])

  // Toque: reação diferente a cada vez, com a frase que combina; cutucar 5 vezes em 2,5 s deixa ela brava, de brincadeira.
  const pokeTimes = useRef<number[]>([])
  const lastPoke = useRef<ReactionLine | null>(null)
  const onClick = (e: MouseEvent) => {
    const p = playerRef.current
    if (!p) return
    const now = performance.now()
    pokeTimes.current = [...pokeTimes.current.filter(t => now - t < 2500), now]
    const line = pokeTimes.current.length >= 5 ? POKE_ANGRY : pickNext(POKES, lastPoke.current)
    lastPoke.current = line
    react(MOOD_REACTION[line.mood])
    // O cabelo e as partes soltas balançam onde tocou.
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const [mx, my] = p.canvasToModel(e.clientX - rect.left, e.clientY - rect.top)
    p.poke(mx, my)
    onPoke?.(line)
  }

  dizzyRef.current = () => {
    if (state !== 'idle' && state !== 'listening') return // falando ou pensando, não interrompe
    const line = dizzyLine(characterById(characterId)?.voice.gender === 'female')
    if (onPoke) onPoke(line)
    else react(MOOD_REACTION[line.mood])
  }

  if (stage) {
    const showCall = !ready || calling
    const callName = characterById(characterId)?.name.replace(/\s*\(.*\)$/, '') ?? ''
    return (
      <div className="absolute inset-0 select-none" onClick={onClick}>
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 w-full h-full"
          style={{ opacity: showCall ? 0 : 1, transition: 'opacity 0.45s ease', backgroundImage: 'none' }} />
        {/* Enquanto o personagem chega: como uma ligação. A foto num círculo, ondas saindo dela e "Chamando ..." com pontinhos. */}
        <div role="status" aria-live="polite" className="absolute inset-0 grid place-items-center pointer-events-none transition-opacity duration-300" style={{ opacity: showCall ? 1 : 0 }}>
          <div className="flex flex-col items-center gap-5">
            <div className="relative w-28 h-28 grid place-items-center">
              {[0, 0.7, 1.4].map(d => (
                <span key={d} aria-hidden className="absolute inset-0 rounded-full animate-ping" style={{ border: '1.5px solid color-mix(in srgb, var(--theme-text) 28%, transparent)', animationDuration: '2.1s', animationDelay: `${d}s` }} />
              ))}
              <img src={characterAvatarUrl(characterId)} alt="" className="relative w-24 h-24 rounded-full object-cover"
                style={{ boxShadow: '0 0 0 3px var(--theme-bg), 0 0 0 4px color-mix(in srgb, var(--theme-text) 18%, transparent)' }} />
            </div>
            <div className="text-center">
              <p className="text-[17px] font-medium leading-tight" style={{ color: 'var(--theme-text)' }}>{callName}</p>
              <p className="mt-1 text-[13px] flex items-center justify-center gap-1" style={{ color: 'var(--theme-text-secondary)' }}>
                Chamando
                <span aria-hidden className="inline-flex gap-[3px] ml-0.5">
                  {[0, 0.2, 0.4].map(d => <span key={d} className="w-1 h-1 rounded-full animate-bounce" style={{ backgroundColor: 'currentColor', animationDelay: `${d}s`, animationDuration: '1s' }} />)}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="relative shrink-0 rounded-full overflow-hidden select-none" onClick={onClick}
      style={{ width: size, height: size, backgroundColor: 'var(--theme-bg-secondary)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--theme-text) 6%, transparent)' }}>
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 w-full h-full"
        style={{ opacity: ready ? 1 : 0.85, transition: 'opacity 0.3s ease', backgroundSize: 'cover', backgroundPosition: 'center' }} />
    </div>
  )
}
