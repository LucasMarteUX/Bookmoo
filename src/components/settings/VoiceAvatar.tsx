import type { KokoroVoice } from '@/lib/kokoro/voices'

// Avatar ilustrado gerado no próprio app (SVG determinístico a partir do id da voz):
// sem custo, sem serviço externo, nítido em qualquer tamanho e em light/dark.
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
const pick = <T,>(arr: T[], n: number) => arr[n % arr.length]

const BG = ['#FDE68A', '#BFDBFE', '#C7D2FE', '#FBCFE8', '#BBF7D0', '#FED7AA', '#DDD6FE', '#A5F3FC']
const SKIN = ['#F9D7B5', '#EDB98A', '#D08B5B', '#AE5D29', '#8D4A2B', '#F3C9A4']
const HAIR = ['#2B1B12', '#5A3825', '#A0522D', '#D9A441', '#1F2937', '#7C2D12', '#E5E7EB']
const SHIRT = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#14B8A6']

export function VoiceAvatar({ voice, size = 56 }: { voice: KokoroVoice; size?: number }) {
  const h = hash(voice.id)
  const bg = pick(BG, h)
  const skin = pick(SKIN, h >>> 3)
  const hair = pick(HAIR, h >>> 6)
  const shirt = pick(SHIRT, h >>> 9)
  const style = (h >>> 12) % 3
  const female = voice.gender === 'female'

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`Avatar de ${voice.name}`} className="shrink-0 rounded-full">
      <circle cx="32" cy="32" r="32" fill={bg} />
      {/* cabelo de trás (longo) */}
      {female && style !== 2 && <path d="M14 30c0-12 8-20 18-20s18 8 18 20v18H14z" fill={hair} />}
      {/* corpo */}
      <path d="M12 64c2-12 10-18 20-18s18 6 20 18z" fill={shirt} />
      <rect x="27" y="38" width="10" height="9" rx="3" fill={skin} />
      {/* rosto */}
      <ellipse cx="32" cy="29" rx="11" ry="12.5" fill={skin} />
      {/* cabelo da frente */}
      {female ? (
        style === 2
          ? <><circle cx="32" cy="12" r="6" fill={hair} /><path d="M21 27c0-9 5-14 11-14s11 5 11 14c-3-5-7-7-11-7s-8 2-11 7z" fill={hair} /></>
          : <path d="M20 28c0-10 5-16 12-16s12 6 12 16c-4-6-8-8-12-8-5 0-9 3-12 8z" fill={hair} />
      ) : (
        style === 0
          ? <path d="M21 25c0-8 5-12 11-12s11 4 11 12c-2-3-6-5-11-5s-9 2-11 5z" fill={hair} />
          : style === 1
            ? <path d="M20 27c0-10 6-15 12-15 7 0 12 5 12 15l-2-4c-3-2-6-3-10-3s-7 1-10 3z" fill={hair} />
            : <path d="M22 22c2-6 6-9 10-9s8 3 10 9c-3-1-6-2-10-2s-7 1-10 2z" fill={hair} />
      )}
      {/* olhos e sorriso */}
      <circle cx="28" cy="30" r="1.4" fill="#1F2937" />
      <circle cx="36" cy="30" r="1.4" fill="#1F2937" />
      <path d="M28.5 35.5c2 2 5 2 7 0" stroke="#1F2937" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* selo do sotaque */}
      <g transform="translate(44 44)">
        <circle cx="8" cy="8" r="8" fill="#fff" />
        <text x="8" y="11" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#111827" fontFamily="system-ui, sans-serif">
          {voice.accent}
        </text>
      </g>
    </svg>
  )
}
