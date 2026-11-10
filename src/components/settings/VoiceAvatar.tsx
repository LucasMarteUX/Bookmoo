import type { KokoroVoice } from '@/lib/kokoro/voices'

// Avatar minimalista da voz: círculo pastel com a inicial (rosa = feminina, azul = masculina) e o selo do sotaque.
export function VoiceAvatar({ voice, size = 56 }: { voice: KokoroVoice; size?: number }) {
  const female = voice.gender === 'female'
  // Cores próprias do círculo: pastel claro com letra escura, no dia e na noite.
  // Não usa o pastel do tema, senão os cards de prática ficam com letra clara em fundo claro.
  const tone = female
    ? { bg: '#F8E4E1', fg: '#8A3C33', bd: '#EDCBC6' }
    : { bg: '#E4ECF7', fg: '#2F4B73', bd: '#CBD9EC' }
  return (
    <span className="relative inline-grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        width: size, height: size, fontSize: size * 0.4,
        backgroundColor: tone.bg, color: tone.fg, border: `1px solid ${tone.bd}`,
      }}
      aria-label={`${voice.name} (${voice.accent})`} role="img">
      {voice.name.charAt(0)}
      <span className="absolute -right-1 -bottom-1 grid place-items-center rounded-full font-semibold"
        style={{ minWidth: size * 0.46, height: size * 0.34, padding: '0 3px', fontSize: Math.max(7, size * 0.18),
          backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text-secondary)', border: '1px solid var(--theme-border)' }}>
        {voice.accent}
      </span>
    </span>
  )
}
