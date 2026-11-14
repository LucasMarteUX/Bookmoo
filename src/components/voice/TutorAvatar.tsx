// Personagem do tutor e das Cenas: busto em traço minimalista (mesma linguagem das ilustrações do app,
// sem gradientes), com expressões, olhar, piscada, inclinação da cabeça e sincronia da boca com a fala.
// A boca segue uma linha do tempo de visemas montada do texto que está sendo falado, na velocidade da voz.
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { VoiceState } from '@/hooks/useVoiceConversation'

export type AvatarKind = 'woman' | 'man' | 'girl' | 'boy'

/** Escolhe o personagem pela cena: crianças usam menino/menina; o resto, mulher/homem. */
export function avatarKindFor(persona: { gender: 'female' | 'male' }, category?: string): AvatarKind {
  if (category === 'kids') return persona.gender === 'female' ? 'girl' : 'boy'
  return persona.gender === 'female' ? 'woman' : 'man'
}

// ---------------------------------------------------------------------------
// Visemas: abertura (0 fechada … 1 aberta), largura e formato
// ---------------------------------------------------------------------------
type Viseme = 'rest' | 'closed' | 'small' | 'wide' | 'round' | 'teeth'
const SHAPE: Record<Viseme, { w: number; top: number; bottom: number }> = {
  rest: { w: 15, top: 2, bottom: 11 },     // sorriso leve
  closed: { w: 13, top: 1, bottom: 3 },    // M, B, P
  small: { w: 12, top: -3, bottom: 8 },    // E, I e consoantes
  wide: { w: 14, top: -6, bottom: 17 },    // A
  round: { w: 8, top: -8, bottom: 14 },    // O, U
  teeth: { w: 13, top: -1, bottom: 5 },    // F, V
}

function visemeOf(ch: string): Viseme {
  const c = ch.toLowerCase()
  if ('aáàâãä'.includes(c)) return 'wide'
  if ('eéèêëiíìîï'.includes(c)) return 'small'
  if ('oóòôõöuúùûü'.includes(c)) return 'round'
  if ('mbp'.includes(c)) return 'closed'
  if ('fv'.includes(c)) return 'teeth'
  if ('wq'.includes(c)) return 'round'
  if (/[a-z]/.test(c)) return 'small'
  return 'rest'
}

type Frame = { at: number; v: Viseme }
/** Linha do tempo (ms) do texto: ~15 letras por segundo, pausas em pontuação. */
function timeline(text: string, rate: number): Frame[] {
  const per = 66 / Math.max(0.5, rate)
  const out: Frame[] = []
  let t = 0
  for (const ch of text) {
    if (/[.!?…]/.test(ch)) { out.push({ at: t, v: 'closed' }); t += 260 / rate; continue }
    if (/[,;:—]/.test(ch)) { out.push({ at: t, v: 'closed' }); t += 140 / rate; continue }
    if (ch === ' ') { out.push({ at: t, v: Math.random() > 0.55 ? 'closed' : 'small' }); t += per * 0.6; continue }
    out.push({ at: t, v: visemeOf(ch) })
    t += per * (/[aeiouáéíóúãõ]/i.test(ch) ? 1.25 : 0.8)
  }
  out.push({ at: t, v: 'rest' })
  return out
}

function mouthPath(v: Viseme, smile: number) {
  const s = SHAPE[v]
  const w = s.w
  const top = s.top
  const bottom = v === 'rest' ? s.bottom + smile * 2 : s.bottom
  return `M${100 - w} 140 Q100 ${140 + top} ${100 + w} 140 Q100 ${140 + bottom} ${100 - w} 140 Z`
}

function useLipSync(text: string, speaking: boolean, rate: number): Viseme {
  const [viseme, setViseme] = useState<Viseme>('rest')
  const frames = useMemo(() => timeline(text, rate), [text, rate])
  const raf = useRef<number | null>(null)
  useEffect(() => {
    if (!speaking || !text) { setViseme('rest'); return }
    const start = performance.now()
    let i = 0
    let last: Viseme = 'rest'
    const loop = () => {
      const t = performance.now() - start
      while (i < frames.length - 1 && frames[i + 1].at <= t) i++
      const f = frames[Math.min(i, frames.length - 1)]
      // Passado o fim do texto mas a voz continua: movimento leve em vez de congelar.
      const v: Viseme = t > frames[frames.length - 1].at + 200 ? (Math.floor(t / 180) % 2 ? 'small' : 'closed') : f.v
      if (v !== last) { last = v; setViseme(v) }
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [text, speaking, frames])
  return viseme
}

// ---------------------------------------------------------------------------
// Expressões
// ---------------------------------------------------------------------------
type Look = { browL: number; browR: number; browTilt: number; gazeX: number; gazeY: number; tilt: number; lean: number; smile: number }
const LOOK: Record<VoiceState, Look> = {
  idle: { browL: 0, browR: 0, browTilt: 0, gazeX: 0, gazeY: 0, tilt: 0, lean: 0, smile: 1 },
  listening: { browL: -3, browR: -3, browTilt: 0, gazeX: 0, gazeY: 1, tilt: -3, lean: 3, smile: 0.6 },
  thinking: { browL: -6, browR: -1, browTilt: 4, gazeX: 6, gazeY: -5, tilt: 4, lean: 0, smile: 0 },
  speaking: { browL: -1, browR: -1, browTilt: 0, gazeX: 0, gazeY: 0, tilt: 0, lean: 0, smile: 1 },
  error: { browL: 1, browR: 1, browTilt: -5, gazeX: 0, gazeY: 2, tilt: 2, lean: 0, smile: -1 },
}

type Spec = { rx: number; ry: number; cy: number; eyeY: number; eyeGap: number; eyeR: number; body: number }
const SPEC: Record<AvatarKind, Spec> = {
  woman: { rx: 44, ry: 54, cy: 106, eyeY: 104, eyeGap: 20, eyeR: 4.6, body: 1 },
  man: { rx: 47, ry: 55, cy: 106, eyeY: 104, eyeGap: 21, eyeR: 4.4, body: 1.06 },
  girl: { rx: 49, ry: 49, cy: 114, eyeY: 112, eyeGap: 21, eyeR: 6, body: 0.84 },
  boy: { rx: 50, ry: 49, cy: 114, eyeY: 112, eyeGap: 22, eyeR: 6, body: 0.84 },
}

const ink = 'var(--theme-text)'
const skin = 'var(--theme-card-bg)'

function Hair({ kind, back }: { kind: AvatarKind; back?: boolean }) {
  if (kind === 'woman') {
    return back
      ? <path d="M54 104 C44 62 72 36 100 36 C130 36 158 62 146 104 L154 192 C140 202 126 188 122 166 L78 166 C74 188 60 202 46 192 Z" fill={ink} />
      : <path d="M52 100 C56 64 80 50 102 52 C128 54 148 70 148 100 C130 90 114 80 104 64 C96 80 76 94 52 100 Z" fill={ink} />
  }
  if (kind === 'man') {
    return back ? null : <path d="M52 96 C48 56 74 38 102 38 C132 38 154 56 148 96 C142 78 126 68 104 68 C82 68 62 76 52 96 Z" fill={ink} />
  }
  if (kind === 'girl') {
    return back
      ? <g fill={ink}><circle cx="44" cy="100" r="15" /><circle cx="156" cy="100" r="15" /><path d="M44 112 L38 150 L52 142 Z" /><path d="M156 112 L162 150 L148 142 Z" /></g>
      : <path d="M51 108 C46 66 72 52 100 52 C130 52 154 66 149 108 C138 90 118 80 102 68 C90 84 70 98 51 108 Z" fill={ink} />
  }
  return back ? null : <path d="M52 102 C44 70 60 44 82 48 C90 36 112 38 118 48 C140 44 158 70 148 102 C140 84 126 76 108 72 C98 84 72 84 52 102 Z" fill={ink} />
}

export function TutorAvatar({ kind, state, speakingText = '', rate = 0.95, size = 220, emphasis }: {
  kind: AvatarKind
  state: VoiceState
  /** Frase que a voz está falando agora (para a boca acompanhar). */
  speakingText?: string
  rate?: number
  size?: number
  /** '?' ou '!' da frase atual: levanta as sobrancelhas. */
  emphasis?: '?' | '!' | null
}) {
  const reduce = useReducedMotion()
  const spec = SPEC[kind]
  const speaking = state === 'speaking'
  const viseme = useLipSync(speakingText, speaking, rate)
  const look = LOOK[state] ?? LOOK.idle
  const emph = speaking ? (emphasis ?? (speakingText.trim().endsWith('?') ? '?' : speakingText.trim().endsWith('!') ? '!' : null)) : null
  const browLift = emph === '?' ? -5 : emph === '!' ? -6 : 0

  const [blink, setBlink] = useState(false)
  useEffect(() => {
    if (reduce) return
    let timer: number
    const next = () => {
      timer = window.setTimeout(() => {
        setBlink(true)
        window.setTimeout(() => setBlink(false), 130)
        next()
      }, 2400 + Math.random() * 3000)
    }
    next()
    return () => window.clearTimeout(timer)
  }, [reduce])

  // Cabeça acompanha a fala: pequenos acenos nas vogais abertas.
  const nod = speaking && (viseme === 'wide' || viseme === 'round') ? 1.6 : 0
  const open = viseme !== 'rest' && viseme !== 'closed'
  const eyeX = spec.eyeGap
  const mouth = mouthPath(speaking ? viseme : state === 'listening' ? 'rest' : state === 'thinking' ? 'closed' : 'rest', look.smile)
  const moving = speaking && open

  return (
    <svg viewBox="0 0 200 240" width={size} height={size * 1.2} role="img" aria-label="Tutor" style={{ color: ink, overflow: 'visible' }}>
      {/* Corpo: respira devagar */}
      <motion.g style={{ transformOrigin: '100px 240px' }} animate={reduce ? {} : { scaleY: [1, 1.012, 1] }} transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}>
        <g transform={`translate(100 240) scale(${spec.body}) translate(-100 -240)`}>
          <path d="M22 240 C22 202 56 184 100 184 C144 184 178 202 178 240 Z" fill={skin} stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
          {kind === 'man' && <path d="M82 186 L100 212 L118 186" fill="none" stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />}
          {kind === 'woman' && <path d="M78 186 Q100 206 122 186" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />}
          {(kind === 'girl' || kind === 'boy') && <path d="M80 186 Q100 200 120 186" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />}
        </g>
      </motion.g>
      <rect x="86" y="158" width="28" height="30" fill={skin} stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />

      {/* Cabeça: inclina, avança e acena */}
      <motion.g style={{ transformOrigin: '100px 190px' }}
        animate={reduce ? {} : { rotate: look.tilt + (moving ? 0.8 : 0), y: look.lean + nod }}
        transition={{ type: 'spring', stiffness: 170, damping: 16, mass: 0.7 }}>
        <Hair kind={kind} back />
        <ellipse cx="100" cy={spec.cy} rx={spec.rx} ry={spec.ry} fill={skin} stroke={ink} strokeWidth="2.6" />
        {(kind === 'woman' || kind === 'man') && <><path d={`M${100 - spec.rx - 1} ${spec.cy - 2} q-7 8 0 16`} fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" /><path d={`M${100 + spec.rx + 1} ${spec.cy - 2} q7 8 0 16`} fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" /></>}
        <Hair kind={kind} />

        {/* Sobrancelhas */}
        <motion.path d={`M${100 - eyeX - 9} ${spec.eyeY - 14} Q${100 - eyeX} ${spec.eyeY - 18} ${100 - eyeX + 9} ${spec.eyeY - 14}`} fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round"
          animate={{ y: look.browL + browLift, rotate: -look.browTilt }} style={{ transformOrigin: `${100 - eyeX}px ${spec.eyeY - 15}px` }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} />
        <motion.path d={`M${100 + eyeX - 9} ${spec.eyeY - 14} Q${100 + eyeX} ${spec.eyeY - 18} ${100 + eyeX + 9} ${spec.eyeY - 14}`} fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round"
          animate={{ y: look.browR + browLift, rotate: look.browTilt }} style={{ transformOrigin: `${100 + eyeX}px ${spec.eyeY - 15}px` }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} />

        {/* Olhos: olham, piscam */}
        {[-1, 1].map(side => (
          <motion.g key={side} animate={{ x: look.gazeX, y: look.gazeY }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
            <motion.ellipse cx={100 + side * eyeX} cy={spec.eyeY} rx={spec.eyeR} ry={spec.eyeR} fill={ink}
              animate={{ scaleY: blink ? 0.12 : 1 }} transition={{ duration: 0.07 }} style={{ transformOrigin: `${100 + side * eyeX}px ${spec.eyeY}px` }} />
          </motion.g>
        ))}
        {kind === 'man' && <g fill="none" stroke={ink} strokeWidth="2.2"><circle cx={100 - eyeX} cy={spec.eyeY} r="13" /><circle cx={100 + eyeX} cy={spec.eyeY} r="13" /><path d={`M${100 - eyeX + 13} ${spec.eyeY} H${100 + eyeX - 13}`} /></g>}
        {(kind === 'girl' || kind === 'boy') && <g fill={ink} opacity="0.12"><circle cx={100 - eyeX - 8} cy={spec.eyeY + 18} r="7" /><circle cx={100 + eyeX + 8} cy={spec.eyeY + 18} r="7" /></g>}

        {/* Nariz */}
        <path d={`M100 ${spec.eyeY + 8} q-5 13 1 16`} fill="none" stroke={ink} strokeWidth="2.3" strokeLinecap="round" />

        {/* Boca */}
        <motion.path d={mouth} fill={open && speaking ? ink : 'none'} stroke={ink} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"
          animate={{ d: mouth }} transition={{ duration: 0.07, ease: 'easeOut' }} />
        {speaking && viseme === 'teeth' && <rect x="90" y="139" width="20" height="4" rx="1.5" fill={skin} stroke={ink} strokeWidth="1.6" />}
      </motion.g>
    </svg>
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
