// Orbe do tutor/personagem: respira parado, anéis reagem à voz ao ouvir, gradiente gira ao pensar,
// pulsa no ritmo da fala ao responder. Só transform/opacity; respeita "reduzir movimento".
import { motion, useReducedMotion } from 'motion/react'
import type { VoiceState } from '@/hooks/useVoiceConversation'

export function VoiceOrb({ state, level, size = 120, emoji }: { state: VoiceState; level: number; size?: number; emoji?: string }) {
  const reduce = useReducedMotion()
  const listening = state === 'listening'
  const speaking = state === 'speaking'
  const thinking = state === 'thinking'
  const scale = speaking ? 1 + level * 0.12 : listening ? 1 + level * 0.06 : 1
  return (
    <div className="relative grid place-items-center" style={{ width: size * 1.6, height: size * 1.6 }} aria-hidden>
      {/* Anéis de escuta */}
      {[0, 1, 2].map(i => (
        <motion.span key={i} className="absolute rounded-full"
          style={{ width: size, height: size, border: '2px solid color-mix(in srgb, var(--theme-accent) 55%, transparent)' }}
          animate={reduce ? { opacity: listening ? 0.5 : 0 } : listening
            ? { scale: 1 + 0.18 * (i + 1) + level * 0.5 * (i + 1) / 3, opacity: Math.max(0, 0.55 - i * 0.16 + level * 0.3) }
            : { scale: 1, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18, mass: 0.6 }} />
      ))}
      {/* Halo */}
      <motion.span className="absolute rounded-full blur-2xl"
        style={{ width: size * 1.1, height: size * 1.1, background: 'radial-gradient(circle, color-mix(in srgb, var(--theme-accent) 55%, transparent), transparent 70%)' }}
        animate={reduce ? {} : { opacity: speaking ? 0.55 + level * 0.4 : listening ? 0.35 + level * 0.4 : 0.25, scale: speaking ? 1.05 + level * 0.15 : 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }} />
      {/* Orbe */}
      <motion.div className="relative rounded-full overflow-hidden grid place-items-center shadow-xl"
        style={{ width: size, height: size }}
        animate={reduce ? {} : state === 'idle' ? { scale: [1, 1.03, 1] } : { scale }}
        transition={state === 'idle' ? { duration: 4, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 300, damping: 15 }}>
        <motion.div className="absolute inset-[-25%]"
          style={{ background: 'conic-gradient(from 0deg, #8b5cf6, #ec4899, #f59e0b, #10b981, #3b82f6, #8b5cf6)' }}
          animate={reduce ? {} : { rotate: 360 }}
          transition={{ duration: thinking ? 2.2 : speaking ? 5 : 14, repeat: Infinity, ease: 'linear' }} />
        <div className="absolute inset-[3px] rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.9), rgba(255,255,255,0.15) 45%, rgba(0,0,0,0.05) 75%)' }} />
        {emoji ? <span className="relative" style={{ fontSize: size * 0.42 }}>{emoji}</span> : null}
        {thinking && (
          <span className="absolute bottom-[18%] flex gap-1">
            {[0, 1, 2].map(i => (
              <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-white/90"
                animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </span>
        )}
      </motion.div>
    </div>
  )
}

/** Botão Play ⇄ Stop: o ícone se transforma (triângulo → quadrado) com anel e compressão ao toque. */
export function PlayStopButton({ active, onClick, size = 56, label }: { active: boolean; onClick: () => void; size?: number; label: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.button type="button" onClick={() => { try { navigator.vibrate?.(12) } catch { /* sem vibração */ } onClick() }}
      aria-label={label} aria-pressed={active} whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.04 }}
      className="relative rounded-full grid place-items-center shadow-lg"
      style={{ width: size, height: size, background: active ? 'linear-gradient(135deg, #ef4444, #f97316)' : 'linear-gradient(135deg, var(--theme-accent), #8b5cf6)', color: '#fff' }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
      {active && !reduce && (
        <motion.span className="absolute inset-[-5px] rounded-full" style={{ border: '2px solid rgba(239,68,68,0.45)' }}
          animate={{ scale: [1, 1.18, 1], opacity: [0.8, 0, 0.8] }} transition={{ duration: 1.6, repeat: Infinity }} />
      )}
      <svg width={size * 0.36} height={size * 0.36} viewBox="0 0 24 24" fill="currentColor">
        <motion.path initial={false}
          animate={{ d: active ? 'M6 6 L18 6 L18 18 L6 18 Z' : 'M8 5 L19 12 L19 12 L8 19 Z' }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }} />
      </svg>
    </motion.button>
  )
}
