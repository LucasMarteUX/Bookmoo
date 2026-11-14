import { cn } from '@/lib/utils'

/** Tile quadrado de categoria: ilustração em linha (/categories/<id>.webp, fundo pastel) e o nome embaixo. */
export function CategoryTile({ id, label, count, active, onClick, className }: { id: string; label: string; count: number; active: boolean; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} aria-label={`${label} (${count})`}
      className={cn('group relative aspect-square overflow-hidden rounded-2xl text-left isolate outline-none cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97]', className)}
      style={{ backgroundColor: '#EFE9DD', boxShadow: active ? '0 0 0 2px var(--theme-text)' : '0 0 0 1px rgba(43,39,34,.08)' }}>
      <img src={`/categories/${id}.webp`} alt="" loading="lazy" decoding="async" onError={e => { e.currentTarget.style.display = 'none' }}
        className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      <span className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-1 px-3 pb-2.5 pt-6" style={{ color: '#2b2722' }}>
        <span className="text-[13px] font-semibold leading-tight">{label}</span>
        <span className="text-[11px] tabular-nums opacity-60">{count}</span>
      </span>
    </button>
  )
}
