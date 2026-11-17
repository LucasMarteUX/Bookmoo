// Personagens do tutor e das Cenas: busto ilustrado dentro de um círculo com fundo pastel, cores chapadas
// (sem gradientes), com piscada, olhar, respiração, inclinação da cabeça e boca sincronizada com a voz.
// A boca não usa estimativa: lê o relógio da fala (lib/speechClock), que segue o áudio que está tocando,
// então só abre quando há som e acompanha o atraso exato da voz.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring, type MotionValue } from 'motion/react'
import type { VoiceState } from '@/hooks/useVoiceConversation'
import { getSpeechClock } from '@/lib/speechClock'

export type AvatarKind = 'woman' | 'man' | 'girl' | 'boy'

/** Escolhe o personagem pela cena: crianças usam menino/menina; o resto, mulher/homem. */
export function avatarKindFor(persona: { gender: 'female' | 'male' }, category?: string): AvatarKind {
  if (category === 'kids') return persona.gender === 'female' ? 'girl' : 'boy'
  return persona.gender === 'female' ? 'woman' : 'man'
}

// ---------------------------------------------------------------------------
// Visemas
// ---------------------------------------------------------------------------
type Viseme = 'rest' | 'closed' | 'small' | 'wide' | 'round' | 'teeth'
// w: meia largura · up: lábio de cima (negativo abre para cima) · down: lábio de baixo
const SHAPE: Record<Viseme, { w: number; up: number; down: number }> = {
  rest: { w: 10, up: 0.6, down: 3.6 },
  closed: { w: 9, up: 0.4, down: 1.2 },
  small: { w: 9, up: -2.6, down: 5.6 },
  wide: { w: 10.5, up: -5, down: 11 },
  round: { w: 6.2, up: -5.4, down: 9 },
  teeth: { w: 9.5, up: -1.8, down: 3.4 },
}

function visemeOf(ch: string): Viseme {
  const c = ch.toLowerCase()
  if ('aáàâãä'.includes(c)) return 'wide'
  if ('eéèêëiíìîïy'.includes(c)) return 'small'
  if ('oóòôõöuúùûüw'.includes(c)) return 'round'
  if ('mbp'.includes(c)) return 'closed'
  if ('fv'.includes(c)) return 'teeth'
  if (/[a-z]/.test(c)) return 'small'
  return 'closed'
}

function mouthPath(v: Viseme, my: number) {
  const s = SHAPE[v]
  return `M${100 - s.w} ${my} Q100 ${my + s.up * 2} ${100 + s.w} ${my} Q100 ${my + s.down * 2} ${100 - s.w} ${my} Z`
}

/** Boca guiada pelo áudio real. Sem som (gerando a voz, pausa, fim): boca em repouso. */
function useLipSync(active: boolean): Viseme {
  const [viseme, setViseme] = useState<Viseme>('rest')
  useEffect(() => {
    if (!active) { setViseme('rest'); return }
    let raf = 0
    let last: Viseme = 'rest'
    let changedAt = 0
    const loop = () => {
      const clock = getSpeechClock()
      const pos = clock?.position() ?? null
      let next: Viseme = 'rest'
      if (clock && pos !== null) {
        const i = Math.floor(pos)
        next = visemeOf(clock.text[i] ?? ' ')
        // Consoante entre vogais abre um pouco (coarticulação), em vez de fechar a cada letra.
        if (next === 'small' && /[aeiouáéíóú]/i.test(clock.text[i + 1] ?? '')) next = visemeOf(clock.text[i + 1])
      }
      const now = performance.now()
      if (next !== last && now - changedAt > 55) { last = next; changedAt = now; setViseme(next) }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])
  return viseme
}

// ---------------------------------------------------------------------------
// Expressões
// ---------------------------------------------------------------------------
type Look = { brow: number; browTilt: number; gazeX: number; gazeY: number; tilt: number; lean: number }
const LOOK: Record<VoiceState, Look> = {
  idle: { brow: 0, browTilt: 0, gazeX: 0, gazeY: 0, tilt: 0, lean: 0 },
  listening: { brow: -1.5, browTilt: 0, gazeX: 0, gazeY: 0.5, tilt: -4, lean: 2 },
  thinking: { brow: -3, browTilt: 3, gazeX: 3.2, gazeY: -3, tilt: 3, lean: 0 },
  speaking: { brow: -0.5, browTilt: 0, gazeX: 0, gazeY: 0, tilt: 0, lean: 0 },
  error: { brow: 1, browTilt: -3, gazeX: 0, gazeY: 1.5, tilt: 2, lean: 0 },
}

const INK = '#2B2420'
const MOUTH = '#5A2626'
const TONGUE = '#D9756F'

type Palette = { bg: string; skin: string; hair: string; top: string; accent: string; blush: string }
const PALETTE: Record<AvatarKind, Palette> = {
  woman: { bg: '#F6E1D6', skin: '#F1C6A6', hair: '#3B2721', top: '#86AE95', accent: '#E9B949', blush: '#EE9E92' },
  man: { bg: '#DCE7F3', skin: '#D8A07A', hair: '#2A211C', top: '#3F5D7F', accent: '#F2F2EE', blush: '#D9836E' },
  girl: { bg: '#EEE1F6', skin: '#F6D3B9', hair: '#6B3E23', top: '#E79AA8', accent: '#F4D35E', blush: '#F09A9A' },
  boy: { bg: '#DFF0DD', skin: '#C88A62', hair: '#1F1A17', top: '#F0B456', accent: '#3F6E9E', blush: '#D27C68' },
}

type Geo = { cy: number; rx: number; ry: number; eyeY: number; eyeGap: number; eyeR: number; mouthY: number }
const GEO: Record<AvatarKind, Geo> = {
  woman: { cy: 92, rx: 37, ry: 44, eyeY: 94, eyeGap: 14.5, eyeR: 3.5, mouthY: 117 },
  man: { cy: 92, rx: 39, ry: 45, eyeY: 94, eyeGap: 15, eyeR: 3.3, mouthY: 118 },
  girl: { cy: 98, rx: 41, ry: 41, eyeY: 101, eyeGap: 15.5, eyeR: 4.4, mouthY: 120 },
  boy: { cy: 98, rx: 41, ry: 41, eyeY: 101, eyeGap: 15.5, eyeR: 4.4, mouthY: 120 },
}

/** Gira os filhos em torno de um ponto exato do desenho (rotação SVG nativa, sem depender da origem
 *  de transformação da biblioteca, que no SVG cai no centro do elemento). */
function Pivot({ angle, x, y, children }: { angle: MotionValue<number>; x: number; y: number; children: ReactNode }) {
  const ref = useRef<SVGGElement>(null)
  useEffect(() => {
    const set = (a: number) => ref.current?.setAttribute('transform', `rotate(${a.toFixed(3)} ${x} ${y})`)
    set(angle.get())
    return angle.on('change', set)
  }, [angle, x, y])
  return <g ref={ref}>{children}</g>
}

const stroke = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

/** Cabelo de trás (antes da cabeça). */
function HairBack({ kind, p }: { kind: AvatarKind; p: Palette }) {
  if (kind === 'woman') return <path d="M57 94 C52 52 76 34 101 34 C128 34 150 54 145 96 C144 124 150 148 160 166 C142 178 122 172 116 156 L84 156 C78 172 58 178 40 166 C50 148 57 124 57 94 Z" fill={p.hair} {...stroke} />
  if (kind === 'girl') return <g fill={p.hair} {...stroke}><circle cx="54" cy="74" r="15" /><circle cx="146" cy="74" r="15" /></g>
  return null
}

/** Cabelo da frente (franja e volume por cima da testa). */
function HairFront({ kind, p }: { kind: AvatarKind; p: Palette }) {
  switch (kind) {
    case 'woman':
      return <g fill={p.hair} {...stroke}>
        <path d="M59 104 C53 58 76 34 101 34 C128 34 150 56 143 104 C139 86 130 70 114 60 C106 69 82 72 60 98 Z" />
      </g>
    case 'man':
      return <g fill={p.hair} {...stroke}>
        <path d="M60 88 C55 56 76 38 103 38 C130 38 147 56 140 88 C137 74 128 64 112 62 C104 70 84 70 74 66 C66 72 62 80 60 88 Z" />
        <path d="M86 40 C96 30 118 30 126 42 C116 40 104 42 96 48 Z" />
      </g>
    case 'girl':
      return <g fill={p.hair} {...stroke}>
        <path d="M58 100 C54 66 76 52 100 52 C126 52 146 66 142 100 C136 84 124 76 112 74 C108 82 96 86 86 80 C78 88 66 92 58 100 Z" />
      </g>
    case 'boy':
      return <g fill={p.hair} {...stroke}>
        <path d="M58 98 C50 76 60 56 76 54 C80 44 94 40 104 46 C114 38 132 44 134 56 C148 62 150 82 142 98 C138 86 130 80 120 80 C116 86 106 88 98 82 C90 88 80 88 74 82 C66 86 61 92 58 98 Z" />
      </g>
  }
}

/** Corpo: pescoço sem contorno embaixo (a gola cobre), ombros e roupa. */
function Body({ kind, p }: { kind: AvatarKind; p: Palette }) {
  const kid = kind === 'girl' || kind === 'boy'
  const neckTop = kid ? 132 : 128
  const neckW = kid ? 9 : 10
  return (
    <g>
      <path d={`M${100 - neckW} ${neckTop} L${100 - neckW} 160 L${100 + neckW} 160 L${100 + neckW} ${neckTop} Z`} fill={p.skin} />
      <path d={`M${100 - neckW} ${neckTop + 4} V156 M${100 + neckW} ${neckTop + 4} V156`} fill="none" {...stroke} />
      <path d={`M${100 - neckW} ${neckTop + 14} Q100 ${neckTop + 20} ${100 + neckW} ${neckTop + 14}`} fill="none" stroke={INK} strokeWidth="1.4" strokeOpacity="0.35" strokeLinecap="round" />
      {kind === 'woman' && <>
        <path d="M24 204 C26 176 52 160 82 156 Q100 170 118 156 C148 160 174 176 176 204 Z" fill={p.top} {...stroke} />
        <circle cx="100" cy="171" r="2.6" fill={p.accent} stroke={INK} strokeWidth="1.4" />
      </>}
      {kind === 'man' && <>
        <path d="M20 204 C22 176 50 160 84 155 L100 172 L116 155 C150 160 178 176 180 204 Z" fill={p.top} {...stroke} />
        <path d="M84 155 L92 176 L100 172 L108 176 L116 155 L100 168 Z" fill={p.accent} {...stroke} />
      </>}
      {kind === 'girl' && <>
        <path d="M32 204 C34 180 56 164 84 160 Q100 172 116 160 C144 164 166 180 168 204 Z" fill={p.top} {...stroke} />
        <path d="M84 160 Q100 180 116 160" fill="none" stroke={p.accent} strokeWidth="3" strokeLinecap="round" />
      </>}
      {kind === 'boy' && <>
        <path d="M30 204 C32 180 56 164 84 160 Q100 168 116 160 C144 164 168 180 170 204 Z" fill={p.top} {...stroke} />
        <path d="M44 190 H156" stroke={p.accent} strokeWidth="5" />
      </>}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Reações (humor do rosto)
// ---------------------------------------------------------------------------
export type Mood = 'neutral' | 'happy' | 'laughing' | 'excited' | 'sad' | 'angry' | 'surprised' | 'confused' | 'wink' | 'shy'
export const MOODS: Mood[] = ['neutral', 'happy', 'laughing', 'excited', 'sad', 'angry', 'surprised', 'confused', 'wink', 'shy']

type MoodFace = {
  brow: number; browIn: number; browL?: number   // altura · inclinação (positivo = parte de dentro sobe) · só a esquerda
  eyes: 'open' | 'smile' | 'wide' | 'squint' | 'wink'
  mouth: { w: number; up: number; down: number; dy?: number }
  blush: number; gazeY?: number; gazeX?: number; bounce?: boolean
}
const FACE: Record<Mood, MoodFace> = {
  neutral: { brow: 0, browIn: 0, eyes: 'open', mouth: SHAPE.rest, blush: 0.45 },
  happy: { brow: -1.5, browIn: 2, eyes: 'open', mouth: { w: 12, up: 0.8, down: 6.2 }, blush: 0.6 },
  laughing: { brow: -3, browIn: 3, eyes: 'smile', mouth: { w: 12.5, up: -0.6, down: 11 }, blush: 0.75, bounce: true },
  excited: { brow: -4.5, browIn: 0, eyes: 'wide', mouth: { w: 11.5, up: -1, down: 10 }, blush: 0.7, bounce: true },
  sad: { brow: 0.5, browIn: 12, eyes: 'open', mouth: { w: 9, up: -3.4, down: -1.2, dy: 3 }, blush: 0.25, gazeY: 2 },
  angry: { brow: 2.5, browIn: -14, eyes: 'squint', mouth: { w: 8.5, up: -1.4, down: -0.2, dy: 2 }, blush: 0.2 },
  surprised: { brow: -6, browIn: 0, eyes: 'wide', mouth: { w: 5.2, up: -5.2, down: 6.4 }, blush: 0.45 },
  confused: { brow: 0, browIn: -4, browL: -5, eyes: 'open', mouth: { w: 7.5, up: 0.4, down: 1.6, dy: 1 }, blush: 0.35, gazeX: 2.5, gazeY: -1.5 },
  wink: { brow: -1, browIn: 1, eyes: 'wink', mouth: { w: 11.5, up: 0.6, down: 5.4 }, blush: 0.6 },
  shy: { brow: -1, browIn: 4, eyes: 'open', mouth: { w: 6.5, up: 0.2, down: 2.2, dy: 1 }, blush: 0.95, gazeX: -2.5, gazeY: 1.5 },
}
function moodMouth(m: Mood, my: number) {
  const f = FACE[m].mouth
  const y = my + (f.dy ?? 0)
  return `M${100 - f.w} ${y} Q100 ${y + f.up * 2} ${100 + f.w} ${y} Q100 ${y + f.down * 2} ${100 - f.w} ${y} Z`
}
const CLICK_MOODS: Mood[] = ['happy', 'laughing', 'surprised', 'wink', 'excited']

/** Aceno de saudação com o outro braço (lado esquerdo da imagem): o braço sobe e fica parado;
 *  só a mão abana, girando no pulso (como um "oi" de verdade). */
// Ponto de giro logo abaixo da mão (punho): a ponta dos dedos é o que mais balança para os lados.
const WRIST = { x: 36.75, y: 162 }
/** Mão aberta com a palma para frente: quatro dedos, polegar para dentro. Desenha tudo com contorno e
 *  depois só o preenchimento por cima, para sobrar apenas a silhueta e as divisões entre os dedos. */
function Hand({ skin }: { skin: string }) {
  const fingers = [{ x: 25, top: 109 }, { x: 31.2, top: 103.5 }, { x: 37.4, top: 104.5 }, { x: 43.6, top: 110 }]
  const parts = (paint: { fill: string; stroke?: string; strokeWidth?: number }) => (
    <g {...paint} strokeLinejoin="round">
      {fingers.map(f => <rect key={f.x} x={f.x} y={f.top} width="5.2" height={140 - f.top} rx="2.6" />)}
      <rect x="45.4" y="134" width="5.8" height="19" rx="2.9" transform="rotate(38 48.3 151)" />
      <path d="M24 132 Q24 127 29 127 L45 127 Q49.5 127 49.5 132 L49.5 149 Q49.5 162 37 163 Q24.5 162 24 149 Z" />
    </g>
  )
  return (
    <g>
      {parts({ fill: skin, stroke: INK, strokeWidth: 2.2 })}
      {parts({ fill: skin })}
      {/* linha da palma (as divisões dos dedos vêm do próprio contorno) */}
      <path d="M30 149 Q36.5 153 43 149" stroke={INK} strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.3" fill="none" />
    </g>
  )
}
function WaveHand({ p }: { p: Palette }) {
  const angle = useMotionValue(0)
  useEffect(() => {
    const c = animate(angle, [0, -20, 16, -20, 16, -16, 10, 0], { duration: 1.7, delay: 0.3, times: [0, 0.14, 0.3, 0.46, 0.62, 0.76, 0.9, 1], ease: 'easeInOut' })
    return () => c.stop()
  }, [angle])
  return (
    <motion.g initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 70, transition: { duration: 0.35 } }}
      transition={{ type: 'spring', stiffness: 170, damping: 18 }}>
      <g transform="matrix(-1 0 0 1 200 0)">
        <path d="M150 206 L156 158 L172 160 L170 206 Z" fill={p.top} {...stroke} />
      </g>
      {/* Só a mão gira, presa no punho (centro, logo abaixo da palma): a ponta dos dedos é o que balança */}
      <Pivot angle={angle} x={WRIST.x} y={WRIST.y}><Hand skin={p.skin} /></Pivot>
    </motion.g>
  )
}

export function TutorAvatar({ kind, state, speakingText = '', size = 220, emphasis, mood = 'neutral', wave = false, followPointer = true, onPoke }: {
  kind: AvatarKind
  state: VoiceState
  /** Frase atual (só para a expressão de pergunta/exclamação; a boca segue o áudio). */
  speakingText?: string
  rate?: number
  size?: number
  emphasis?: '?' | '!' | null
  /** Reação do rosto (escolhida pela IA a cada resposta, ou pela tela). */
  mood?: Mood
  /** Acena (saudação). */
  wave?: boolean
  /** Olhos acompanham o mouse. */
  followPointer?: boolean
  /** Clique no personagem (ele reage sozinho; isto é só um aviso). */
  onPoke?: () => void
}) {
  const reduce = useReducedMotion()
  const uid = useId().replace(/:/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const g = GEO[kind]
  const p = PALETTE[kind]
  const speaking = state === 'speaking'
  const viseme = useLipSync(speaking)
  const look = LOOK[state] ?? LOOK.idle
  const emph = speaking ? (emphasis ?? (speakingText.trim().endsWith('?') ? '?' : speakingText.trim().endsWith('!') ? '!' : null)) : null
  const browLift = emph === '?' ? -3.5 : emph === '!' ? -4 : 0

  // Clique: reage com uma expressão por um instante; cutucar demais deixa bravo (de brincadeira).
  const [poke, setPoke] = useState<{ mood: Mood; n: number } | null>(null)
  const pokes = useRef<number[]>([])
  const pokeTimer = useRef<number>(0)
  const onClick = () => {
    const now = performance.now()
    pokes.current = [...pokes.current.filter(t => now - t < 2500), now]
    const m: Mood = pokes.current.length >= 5 ? 'angry' : CLICK_MOODS[Math.floor(Math.random() * CLICK_MOODS.length)]
    setPoke(prev => ({ mood: m, n: (prev?.n ?? 0) + 1 }))
    window.clearTimeout(pokeTimer.current)
    pokeTimer.current = window.setTimeout(() => setPoke(null), m === 'angry' ? 2200 : 1500)
    onPoke?.()
  }
  useEffect(() => () => window.clearTimeout(pokeTimer.current), [])
  const face = FACE[poke?.mood ?? mood] ?? FACE.neutral
  const activeMood: Mood = poke?.mood ?? mood

  const [blink, setBlink] = useState(false)
  useEffect(() => {
    if (reduce) return
    let timer: number
    const next = () => {
      timer = window.setTimeout(() => {
        setBlink(true)
        window.setTimeout(() => setBlink(false), 120)
        // Às vezes pisca duas vezes, como gente.
        if (Math.random() < 0.18) window.setTimeout(() => { setBlink(true); window.setTimeout(() => setBlink(false), 110) }, 260)
        next()
      }, 2200 + Math.random() * 3200)
    }
    next()
    return () => window.clearTimeout(timer)
  }, [reduce])

  // Olhar: segue o mouse; parado há um tempo, passeia sozinho.
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (!followPointer || reduce || typeof window === 'undefined' || !window.matchMedia?.('(pointer: fine)').matches) return
    let raf = 0
    let idle = 0
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const r = svgRef.current?.getBoundingClientRect()
        if (!r) return
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.45)
        const d = Math.hypot(dx, dy) || 1
        const k = Math.min(1, d / 260)
        setPointer({ x: (dx / d) * 3.6 * k, y: (dy / d) * 2.6 * k })
      })
      window.clearTimeout(idle)
      idle = window.setTimeout(() => setPointer(null), 3000)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => { cancelAnimationFrame(raf); window.clearTimeout(idle); window.removeEventListener('pointermove', onMove) }
  }, [followPointer, reduce])
  const [wander, setWander] = useState({ x: 0, y: 0 })
  useEffect(() => {
    if (reduce || pointer || (state !== 'idle' && state !== 'listening')) { setWander({ x: 0, y: 0 }); return }
    const iv = window.setInterval(() => setWander(Math.random() < 0.55 ? { x: 0, y: 0 } : { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 2 }), 2600)
    return () => window.clearInterval(iv)
  }, [state, reduce, pointer])
  const gazeX = state === 'thinking' ? look.gazeX : (pointer?.x ?? wander.x) + (face.gazeX ?? 0)
  const gazeY = state === 'thinking' ? look.gazeY : (pointer?.y ?? wander.y) + (face.gazeY ?? 0) + look.gazeY

  const open = viseme === 'wide' || viseme === 'round' || viseme === 'small'
  const nod = speaking && (viseme === 'wide' || viseme === 'round') ? 1.2 : 0
  // Falando: a boca segue a voz. Calado: a boca mostra a reação.
  const mouth = speaking ? mouthPath(viseme, g.mouthY) : state === 'thinking' && activeMood === 'neutral' ? mouthPath('closed', g.mouthY) : moodMouth(activeMood, g.mouthY)
  const showTeeth = speaking ? (open || viseme === 'teeth') : ['laughing', 'excited', 'happy', 'wink'].includes(activeMood)
  const kid = kind === 'girl' || kind === 'boy'
  const headTurn = pointer ? pointer.x * 0.5 : 0
  const eyeScale = face.eyes === 'wide' ? 1.25 : face.eyes === 'squint' ? 0.7 : 1
  // Inclinação da cabeça (e do cabelo de trás, mais suave), girando no pescoço.
  const headTarget = reduce ? 0 : look.tilt + headTurn + (activeMood === 'confused' ? 6 : activeMood === 'sad' ? -3 : 0)
  const headAngle = useSpring(0, { stiffness: 170, damping: 16, mass: 0.7 })
  const hairAngle = useSpring(0, { stiffness: 120, damping: 18 })
  useEffect(() => { headAngle.set(headTarget); hairAngle.set(reduce ? 0 : (look.tilt + headTurn) * 0.4) }, [headTarget, look.tilt, headTurn, reduce, headAngle, hairAngle])

  return (
    <svg ref={svgRef} viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={kind === 'woman' ? 'Tutora' : 'Tutor'}
      className="shrink-0 block cursor-pointer select-none" onClick={onClick}>
      <defs>
        <clipPath id={`c${uid}`}><circle cx="100" cy="100" r="99" /></clipPath>
        <clipPath id={`m${uid}`}><motion.path initial={false} animate={{ d: mouth }} transition={{ duration: speaking ? 0.06 : 0.25, ease: 'easeOut' }} /></clipPath>
      </defs>
      <circle cx="100" cy="100" r="99" fill={p.bg} />
      <g clipPath={`url(#c${uid})`}>
        {/* Respiração (e pulinhos quando ri ou se anima) */}
        <motion.g key={poke?.n ?? 0} animate={reduce ? {} : face.bounce ? { y: [0, -5, 0, -3, 0] } : { y: [0, -1.2, 0] }}
          transition={face.bounce ? { duration: 0.7, ease: 'easeOut' } : { duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}>
          <Pivot angle={hairAngle} x={100} y={150}><HairBack kind={kind} p={p} /></Pivot>
          <Body kind={kind} p={p} />

          {/* Cabeça: inclina, avança, acompanha o mouse e acena com a fala */}
          <motion.g animate={reduce ? {} : { y: look.lean + nod + (activeMood === 'sad' ? 2 : 0) }}
            transition={{ type: 'spring', stiffness: 170, damping: 16, mass: 0.7 }}>
          <Pivot angle={headAngle} x={100} y={150}>
            {kind !== 'woman' && <>
              <ellipse cx={100 - g.rx + 1} cy={g.eyeY + 4} rx="6" ry="8" fill={p.skin} {...stroke} />
              <ellipse cx={100 + g.rx - 1} cy={g.eyeY + 4} rx="6" ry="8" fill={p.skin} {...stroke} />
            </>}
            <ellipse cx="100" cy={g.cy} rx={g.rx} ry={g.ry} fill={p.skin} {...stroke} />
            <HairFront kind={kind} p={p} />
            {kind === 'girl' && <path d="M128 60 l8 -6 l2 9 z M128 60 l-2 9 l9 -1 z" fill={p.accent} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />}

            {/* Bochechas */}
            {[-1, 1].map(side => <motion.circle key={`k${side}`} cx={100 + side * (g.eyeGap + 6)} cy={g.eyeY + 14} r={kid ? 6.5 : 5.5} fill={p.blush} animate={{ opacity: face.blush }} transition={{ duration: 0.3 }} />)}

            {/* Sobrancelhas */}
            {[-1, 1].map(side => (
              <motion.path key={`b${side}`} d={`M${100 + side * g.eyeGap - 7} ${g.eyeY - 10} Q${100 + side * g.eyeGap} ${g.eyeY - 14} ${100 + side * g.eyeGap + 7} ${g.eyeY - 10}`}
                fill="none" stroke={kind === 'woman' || kind === 'girl' ? p.hair : INK} strokeWidth="2.6" strokeLinecap="round"
                animate={{ y: look.brow + browLift + face.brow + (side === -1 ? face.browL ?? 0 : 0), rotate: side * look.browTilt + side * face.browIn }}
                style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }} />
            ))}

            {/* Olhos: seguem o mouse, piscam, mudam com a reação */}
            <motion.g animate={{ x: gazeX, y: gazeY }} transition={{ type: 'spring', stiffness: 140, damping: 15 }}>
              {[-1, 1].map(side => {
                const cx = 100 + side * g.eyeGap
                const arc = face.eyes === 'smile' || (face.eyes === 'wink' && side === -1)
                if (arc) return <path key={`e${side}`} d={`M${cx - g.eyeR - 0.5} ${g.eyeY + 1} Q${cx} ${g.eyeY - g.eyeR * 1.6} ${cx + g.eyeR + 0.5} ${g.eyeY + 1}`} fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
                return (
                  <motion.g key={`e${side}`} animate={{ scaleY: blink ? 0.1 : eyeScale, scaleX: face.eyes === 'wide' ? 1.15 : 1 }} transition={{ duration: blink ? 0.06 : 0.2 }} style={{ transformOrigin: 'center', transformBox: 'fill-box' }}>
                    <ellipse cx={cx} cy={g.eyeY} rx={g.eyeR} ry={g.eyeR * 1.18} fill={INK} />
                    <circle cx={cx + g.eyeR * 0.35} cy={g.eyeY - g.eyeR * 0.45} r={g.eyeR * 0.32} fill="#fff" />
                  </motion.g>
                )
              })}
            </motion.g>
            {kind === 'woman' && face.eyes !== 'smile' && [-1, 1].map(side => (face.eyes === 'wink' && side === -1) ? null : <path key={`l${side}`} d={`M${100 + side * (g.eyeGap + 3.2)} ${g.eyeY - 2.5} l${side * 3} -2.2`} stroke={INK} strokeWidth="1.6" strokeLinecap="round" />)}
            {kind === 'man' && <g fill="none" stroke={INK} strokeWidth="1.9">
              <rect x={100 - g.eyeGap - 10} y={g.eyeY - 8} width="20" height="16" rx="7" />
              <rect x={100 + g.eyeGap - 10} y={g.eyeY - 8} width="20" height="16" rx="7" />
              <path d={`M${100 - g.eyeGap + 10} ${g.eyeY - 1} Q100 ${g.eyeY - 4} ${100 + g.eyeGap - 10} ${g.eyeY - 1}`} />
            </g>}

            {/* Nariz */}
            <path d={`M${kid ? 99 : 100} ${g.eyeY + 7} q-3.6 ${kid ? 7 : 10} 1.4 ${kid ? 9 : 12}`} fill="none" stroke={INK} strokeWidth="1.9" strokeLinecap="round" strokeOpacity="0.8" />
            {kind === 'man' && <path d={`M86 ${g.mouthY + 12} Q100 ${g.mouthY + 18} 114 ${g.mouthY + 12}`} fill="none" stroke={INK} strokeWidth="1.3" strokeOpacity="0.25" strokeLinecap="round" />}

            {/* Boca: interior escuro, dentes e língua recortados no formato atual */}
            <motion.path initial={false} animate={{ d: mouth }} transition={{ duration: speaking ? 0.06 : 0.25, ease: 'easeOut' }} fill={MOUTH} />
            <g clipPath={`url(#m${uid})`}>
              {showTeeth && <rect x="86" y={g.mouthY - 12} width="28" height="10.6" fill="#fff" />}
              <ellipse cx="100" cy={g.mouthY + 14} rx="9" ry="7" fill={TONGUE} />
            </g>
            <motion.path initial={false} animate={{ d: mouth }} transition={{ duration: speaking ? 0.06 : 0.25, ease: 'easeOut' }} fill="none" stroke={INK} strokeWidth="1.9" strokeLinejoin="round" />
          </Pivot>
          </motion.g>
          <AnimatePresence>{wave && !reduce && <WaveHand key="wave" p={p} />}</AnimatePresence>
        </motion.g>
      </g>
      <circle cx="100" cy="100" r="99" fill="none" stroke={INK} strokeOpacity="0.08" strokeWidth="2" />
    </svg>
  )
}

/** Balão de fala do personagem (saudação, reação ou frase curta), com rabinho apontando para ele. */
export function AvatarBubble({ text, side = 'right', tone = 'card' }: { text: string; side?: 'right' | 'top'; tone?: 'card' | 'accent' }) {
  return (
    <AnimatePresence mode="wait">
      {text && (
        <motion.div key={text} initial={{ opacity: 0, scale: 0.85, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          style={{ transformOrigin: side === 'right' ? 'left center' : 'bottom center', borderColor: 'var(--theme-border)', backgroundColor: tone === 'accent' ? 'var(--theme-bg-secondary)' : 'var(--theme-card-bg)' }}
          className="relative max-w-[260px] rounded-2xl border px-3.5 py-2.5 text-[14px] leading-snug shadow-sm">
          {text}
          <span aria-hidden className={`absolute w-3 h-3 rotate-45 border ${side === 'right' ? '-left-1.5 top-1/2 -translate-y-1/2 border-r-0 border-t-0' : 'left-1/2 -bottom-1.5 -translate-x-1/2 border-l-0 border-t-0'}`}
            style={{ borderColor: 'var(--theme-border)', backgroundColor: tone === 'accent' ? 'var(--theme-bg-secondary)' : 'var(--theme-card-bg)' }} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Botão Play ⇄ Stop do tutor de leitura (cores do tema, sem gradiente). */
export function PlayStopButton({ active, onClick, size = 56, label }: { active: boolean; onClick: () => void; size?: number; label: string }) {
  return (
    <motion.button type="button" onClick={() => { try { navigator.vibrate?.(12) } catch { /* sem vibração */ } onClick() }}
      aria-label={label} aria-pressed={active} whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.04 }}
      className="relative rounded-full grid place-items-center"
      style={{ width: size, height: size, backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
      <svg width={size * 0.34} height={size * 0.34} viewBox="0 0 24 24" fill="currentColor">
        <motion.path initial={false} animate={{ d: active ? 'M6 6 L18 6 L18 18 L6 18 Z' : 'M8 5 L19 12 L19 12 L8 19 Z' }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} />
      </svg>
    </motion.button>
  )
}
