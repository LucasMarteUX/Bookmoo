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
import { characterAvatarUrl, characterById, characterModelUrl } from '@/lib/livliv/characters'
import { clearSpeakerVoice, setSpeakerVoice } from '@/lib/speakerVoice'
import { installBodyGestures, type BodyGestureControl } from '@/lib/livliv/bodyGestures'
import { installBodyLanguage } from '@/lib/livliv/bodyLanguage'
import { GestureDirector } from '@/lib/livliv/performance'
import { moodFromText, pickNext, POKE_ANGRY, POKES, type ReactionLine } from '@/lib/tutorReactions'

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
const FRAMING_KEY = 'bookmoo:stage-framing:v2'
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

export function LivLivAvatar({ characterId, state, speakingText = '', onHead, size = 220, mood = 'neutral', wave = false, followPointer = true, voice = false, stage = false, onPoke, onFail }: {
  characterId: string
  /** Frase sendo dita agora: pergunta inclina a cabeça, exclamação anima. */
  speakingText?: string
  /** Onde está a cabeça (em px do quadro), para posicionar o balão de fala junto dela. */
  onHead?: (head: HeadBox) => void
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
  // Troca de tutor no palco: uma "ligação" de uns 3 segundos ("Chamando Luck...") antes de ele aparecer.
  const [calling, setCalling] = useState(false)
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
        if (!acts.length) return
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
      if (!headRef.current || now - lastHead < 250) return
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
      removeBrows()
      removeWink()
      removeBodyLanguage()
      removeActs()
      removeRecenter()
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
    setReady(false)
    player.load(characterModelUrl(characterId), stage ? undefined : { poster: characterAvatarUrl(characterId) })
      .then(async info => {
        // Palco: da cabeça à cintura (corpo inteiro também corta na cintura). Avatar pequeno: só a cabeça.
        // Inclinação inicial própria do personagem (aplicada depois do carregamento) e corpo em neutro.
        baseZRef.current = characterById(characterId)?.baseAngleZ ?? 0
        player.params.angleZ = baseZRef.current
        fixedBase.current = !!characterById(characterId)?.bodyInHead
        basePerDeg.current = characterById(characterId)?.basePerDeg ?? 0.0013
        player.bodyMotion = fixedBase.current ? 0 : 0.5
        gestureRef.current?.set('neutro')
        player.view.head = !stage && size < 120
        if (info.fullBody) player.view.fit = 'frame'
        // Palco: ajusta o enquadramento ANTES de mostrar (o personagem só aparece já no lugar, encostado embaixo).
        if (stage) await frameStage()
        if (playerRef.current === player) setReady(true)
      })
      .catch((e: Error & { name?: string }) => {
        if (e.name === 'AbortError') return
        console.warn('[livliv] personagem não carregou:', e)
        failRef.current?.()
      })
  }, [player, characterId, size, stage])

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
    p.view.y = baseY
    // Cada personagem tem uma altura de cabeça e um volume de cabelo: com o primeiro quadro desenhado, mede o topo real
    // do desenho (pixels da imagem) e acerta o enquadramento para esse topo ficar sempre na mesma faixa, e guarda a
    // proporção para o balão ficar acima do cabelo, não da cabeça estimada.
    await frames(2)
    const q = playerRef.current, cv = canvasRef.current
    const a = q?.getAnchor('head')
    if (!q || !cv || !a) return
    const w = cv.clientWidth, h = cv.clientHeight
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
    const target = Math.min(130, Math.max(100, h * 0.16))
    q.view.y = baseY + (hairTop - target) / h
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
    const EVENTS = ['pointerdown', 'keydown', 'touchend'] as const
    const off = () => EVENTS.forEach(t => window.removeEventListener(t, attach, true))
    EVENTS.forEach(t => window.addEventListener(t, attach, true))
    return () => {
      cancelled = true
      off()
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
    else if (state === 'listening' || state === 'speaking') player.lookAt(0, 0.05)
    else player.lookAt(null)
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
      if (stateRef.current === 'speaking') q.lookAt(0, 0.05); else if (stateRef.current === 'idle') q.lookAt(null)
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
      act: (a, n) => player.act(a, n),
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
