import type { KokoroVoice } from '@/lib/kokoro/voices'

// Avatar minimalista da voz: círculo com a inicial (tom suave por gênero) e o selo do sotaque.
export function VoiceAvatar({ voice, size = 56 }: { voice: KokoroVoice; size?: number }) {
  const female = voice.gender === 'female'
  return (
    <span className="relative inline-grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        width: size, height: size, fontSize: size * 0.42,
        backgroundColor: female ? 'color-mix(in srgb, #e5679a 16%, var(--theme-bg))' : 'color-mix(in srgb, #4f7fd6 16%, var(--theme-bg))',
        color: female ? '#b83b6c' : '#2f5fb3',
        border: '1px solid var(--theme-border-subtle)',
      }}
      aria-label={`${voice.name} (${voice.accent})`} role="img">
      {voice.name.charAt(0)}
      <span className="absolute -right-1 -bottom-1 grid place-items-center rounded-full font-bold"
        style={{ minWidth: size * 0.46, height: size * 0.34, padding: '0 3px', fontSize: Math.max(7, size * 0.18),
          backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text-secondary)', border: '1px solid var(--theme-border-subtle)' }}>
        {voice.accent}
      </span>
    </span>
  )
}
