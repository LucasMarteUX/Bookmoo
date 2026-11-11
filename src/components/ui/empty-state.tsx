import type { ReactNode } from 'react'

/** Vazio com ilustração. `illustration` é o nome do arquivo em /public/illustrations, sem extensão. */
export function EmptyState({ illustration, title, action }: { illustration: string; title: string; action?: ReactNode }) {
  return (
    <div className="py-10 flex flex-col items-center text-center">
      <img src={`/illustrations/${illustration}.svg`} alt="" className="illo w-32" />
      <p className="mt-4 max-w-sm text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>{title}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
