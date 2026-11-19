// Foto da pessoa com o anel do nível do Upoonly: anel cheio e selo de verificado quando o nível foi confirmado no teste,
// anel tracejado enquanto está pendente. O nome do nível aparece ao lado, no selo (não se repete aqui).
import { BadgeCheck } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { levelName, levelTone, type CefrId } from '@/lib/cefr'

export function LevelAvatar({ src, name, level, verified, pt, size = 112 }: { src?: string; name: string; level: CefrId; verified: boolean; pt: boolean; size?: number }) {
  const check = Math.round(size * 0.3)
  const tone = levelTone(level)
  return (
    <span className="relative inline-block" title={levelName(level, pt)}>
      <span className="block rounded-full p-[5px]" style={verified ? { boxShadow: `inset 0 0 0 3px ${tone.fg}`, backgroundColor: tone.bg } : { border: '2px dashed var(--theme-text-secondary)' }}>
        <Avatar src={src} name={name} size={size - 10} />
      </span>
      {verified && (
        <BadgeCheck aria-label={pt ? 'Nível verificado' : 'Verified level'} className="absolute rounded-full"
          style={{ width: check, height: check, right: size * 0.02, bottom: size * 0.02, padding: 3, backgroundColor: tone.fg, color: tone.bg, boxShadow: '0 0 0 3px var(--theme-card-bg)' }} />
      )}
    </span>
  )
}
