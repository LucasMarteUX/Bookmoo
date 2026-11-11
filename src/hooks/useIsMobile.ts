import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 767px)'

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

/** true abaixo de 768px (iPhone). iPad e desktop usam o layout com sidebar. */
export function useIsMobile() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    cb => { const mq = window.matchMedia(query); mq.addEventListener('change', cb); return () => mq.removeEventListener('change', cb) },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
