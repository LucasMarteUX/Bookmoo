import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { toast } from '@/components/ui/toast'

/** Pílula discreta enquanto não há rede; avisa quando a conexão volta. */
export function OfflineBanner() {
  const pt = useLanguage().locale === 'pt-BR'
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => { setOnline(true); toast(pt ? 'Conectado de novo' : 'Back online', { tone: 'info', duration: 2500 }) }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [pt])
  if (online) return null
  return (
    <div role="status" className="fixed left-1/2 -translate-x-1/2 z-[55] flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium shadow-md"
      style={{ top: 'calc(var(--safe-t) + var(--navbar-h) + 0.5rem)', backgroundColor: 'var(--theme-text)', color: 'var(--theme-bg)' }}>
      <WifiOff className="w-4 h-4" aria-hidden />
      {pt ? 'Sem conexão — o que já abriu continua disponível' : 'Offline — what you opened stays available'}
    </div>
  )
}
