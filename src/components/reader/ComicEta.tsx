// Estimativa enquanto a página é ilustrada: barra de progresso e tempo restante, contados desde o clique.
import { useEffect, useState } from 'react'
import { COMIC_ETA_SECONDS } from '@/lib/comicJobs'

/** Segundos restantes até a estimativa (null sem início conhecido). */
export function useComicEtaLeft(startedAt?: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [startedAt])
  return startedAt ? Math.ceil(COMIC_ETA_SECONDS - Math.max(0, (now - startedAt) / 1000)) : null
}

/** Texto curto do tempo restante ("~45 s", "~1 min", "quase pronto"). */
export function etaShort(left: number | null, pt: boolean) {
  if (left == null) return pt ? '~1 min e meio' : '~1.5 min'
  if (left > 60) return pt ? `~${Math.ceil(left / 60)} min` : `~${Math.ceil(left / 60)} min`
  if (left > 5) return `~${left} s`
  return pt ? 'quase pronto' : 'almost done'
}

/** Estimativa enquanto a página é ilustrada: barra de progresso e tempo restante, contados desde o clique. */
export function ComicEta({ startedAt, pt, compact }: { startedAt?: number; pt: boolean; compact?: boolean }) {
  const total = COMIC_ETA_SECONDS
  const leftOrNull = useComicEtaLeft(startedAt)
  const left = leftOrNull ?? total
  const elapsed = total - left
  // Passou do previsto: a barra fica quase cheia e o texto avisa que falta pouco (sem número negativo).
  const progress = startedAt ? Math.min(0.95, elapsed / total) : 0.04
  const text = !startedAt
    ? (pt ? 'Leva cerca de 1 min e meio' : 'Takes about a minute and a half')
    : left > 60 ? (pt ? `Faltam cerca de ${Math.ceil(left / 60)} min` : `About ${Math.ceil(left / 60)} min left`)
    : left > 5 ? (pt ? `Faltam cerca de ${left} s` : `About ${left}s left`)
    : (pt ? 'Quase pronto…' : 'Almost done…')
  const hint = pt ? 'Pode trocar de página ou sair: a geração continua e a página aparece aqui.' : 'You can change pages or leave: it keeps going and the page shows up here.'
  return (
    <div className={compact ? 'flex flex-1 items-center gap-2 min-w-0' : 'w-full max-w-xs flex flex-col items-center gap-2'}>
      <div className={`${compact ? 'flex-1' : 'w-full'} h-1.5 rounded-full overflow-hidden`} style={{ backgroundColor: 'var(--theme-border-subtle)' }}
        role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label={text}>
        <div className="h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%`, backgroundColor: 'var(--theme-accent)' }} />
      </div>
      <span className="tabular-nums whitespace-nowrap text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{text}</span>
      {!compact && <span className="text-xs max-w-xs" style={{ color: 'var(--theme-text-secondary)' }}>{hint}</span>}
    </div>
  )
}
