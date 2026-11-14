import { cn } from '@/lib/utils'
import { useReaderSettings } from '@/store/useReaderSettings'

/** Fundo do tile no modo escuro (mesmos tons dos cards "Pratique hoje"); as imagens -dark.webp usam essas cores. */
const DARK_BG: Record<string, string> = {
  classic: '#2b2823', children: '#302b1c', adventure: '#1f2e2a', fantasy: '#2a2438', mystery: '#212c3b',
  romance: '#33242b', short: '#33271f', poetry: '#232a3d', nonfiction: '#28301f', biography: '#2d2a26',
}

/** Tile quadrado de categoria: ilustração em linha (/categories/<id>.webp, fundo pastel) e o nome embaixo. */
export function CategoryTile({ id, label, count, active, onClick, className }: { id: string; label: string; count: number; active: boolean; onClick: () => void; className?: string }) {
  const dark = useReaderSettings(s => s.theme) === 'dark'
  return (
    <button type="button" onClick={onClick} aria-pressed={active} aria-label={`${label} (${count})`}
      className={cn('group relative aspect-square overflow-hidden rounded-2xl text-left isolate outline-none cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97]', className)}
      style={{ backgroundColor: dark ? (DARK_BG[id] ?? '#2b2823') : '#EFE9DD', boxShadow: active ? `0 0 0 2px ${dark ? '#e8e6e3' : 'var(--theme-text)'}` : dark ? '0 0 0 1px rgba(255,255,255,.07)' : '0 0 0 1px rgba(43,39,34,.08)' }}>
      <img src={`/categories/${id}${dark ? '-dark' : ''}.webp`} alt="" loading="lazy" decoding="async" onError={e => { e.currentTarget.style.display = 'none' }}
        className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      <span className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-1 px-3 pb-2.5 pt-6" style={{ color: dark ? '#e8e6e3' : '#2b2722' }}>
        <span className="text-[13px] font-semibold leading-tight">{label}</span>
        <span className="text-[11px] tabular-nums opacity-60">{count}</span>
      </span>
    </button>
  )
}
