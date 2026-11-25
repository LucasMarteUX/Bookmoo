
// Estimativa enquanto a página é ilustrada: barra de progresso e tempo restante, contados desde o clique.
// Na fila, soma a espera estimada pelo servidor ao desenho; desenhando, conta desde que o desenho começou.
import { useEffect, useState } from 'react'
import { COMIC_ETA_SECONDS, COMIC_LAYOUT_SECONDS, type ComicJobProgress } from '@/lib/comicJobs'

/**
 * Segundos restantes até a estimativa (null sem início conhecido) e segundos desde o clique.
 * `progress` (do servidor): posição e espera na fila, ou desde quando está desenhando.
 */
export function useComicEta(startedAt?: number, progress?: ComicJobProgress) {
  const [now, setNow] = useState(() => Date.now())
  // A espera da fila chega a cada consulta (2,5–5 s); entre elas, desconta o tempo que passou.
  const [seenAt, setSeenAt] = useState(() => Date.now())
  useEffect(() => { setSeenAt(Date.now()) }, [progress?.waitSeconds, progress?.position])
  useEffect(() => {
    if (!startedAt) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [startedAt])
  if (!startedAt) return { left: null, elapsed: 0 }
  const elapsed = Math.max(0, (now - startedAt) / 1000)
  const draw = (progress?.drawSeconds ?? COMIC_ETA_SECONDS - COMIC_LAYOUT_SECONDS) + COMIC_LAYOUT_SECONDS
  const left = Math.ceil(
    progress?.position ? Math.max(0, (progress.waitSeconds ?? 0) - (now - seenAt) / 1000) + draw
    : progress?.drawStartedAt ? draw - (now - progress.drawStartedAt) / 1000
    : COMIC_ETA_SECONDS - elapsed,
  )
  return { left, elapsed }
}

/** Segundos restantes até a estimativa (null sem início conhecido). */
export function useComicEtaLeft(startedAt?: number, progress?: ComicJobProgress) {
  return useComicEta(startedAt, progress).left
}

/** Texto curto do tempo restante ("~45 s", "~1 min", "quase pronto"). */
export function etaShort(left: number | null, pt: boolean) {
  if (left == null) return pt ? '~1 min e meio' : '~1.5 min'
  if (left > 60) return pt ? `~${Math.ceil(left / 60)} min` : `~${Math.ceil(left / 60)} min`
  if (left > 5) return `~${left} s`
  return pt ? 'quase pronto' : 'almost done'
}

/** Rótulo da fase "desenhando": na fila, mostra a posição. */
export function queueLabel(progress: ComicJobProgress | undefined, pt: boolean) {
  return progress?.position ? (pt ? `Na fila, posição ${progress.position}` : `In line, position ${progress.position}`) : null
}

/** Estimativa enquanto a página é ilustrada: barra de progresso e tempo restante, contados desde o clique. */
export function ComicEta({ startedAt, progress: server, pt, compact }: { startedAt?: number; progress?: ComicJobProgress; pt: boolean; compact?: boolean }) {
  const { left: leftOrNull, elapsed } = useComicEta(startedAt, server)
  const left = leftOrNull ?? COMIC_ETA_SECONDS
  const queued = !!server?.position
  // Passou do previsto: a barra fica quase cheia e o texto avisa que falta pouco (sem número negativo).
  const progress = startedAt ? Math.min(0.95, elapsed / Math.max(1, elapsed + Math.max(0, left))) : 0.04
  const text = !startedAt
    ? (pt ? 'Leva cerca de 1 min e meio' : 'Takes about a minute and a half')
    : left > 60 ? (pt ? `Faltam cerca de ${Math.ceil(left / 60)} min` : `About ${Math.ceil(left / 60)} min left`)
    : left > 5 ? (pt ? `Faltam cerca de ${left} s` : `About ${left}s left`)
    : (pt ? 'Quase pronto…' : 'Almost done…')
  const hint = queued
    ? (pt ? 'Muita gente ilustrando agora: sua página começa assim que abrir uma vaga. Pode sair; ela aparece aqui e só é cobrada quando ficar pronta.'
      : 'Lots of people illustrating right now: your page starts as soon as a slot opens. You can leave; it shows up here and is only charged when ready.')
    : pt ? 'Pode trocar de página ou sair: a geração continua e a página aparece aqui.' : 'You can change pages or leave: it keeps going and the page shows up here.'
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
