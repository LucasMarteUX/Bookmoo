import { registerSW } from 'virtual:pwa-register'
import { toast } from '@/components/ui/toast'
import { useLanguage } from '@/store/useLanguage'

/** Registra o service worker e oferece "Atualizar" quando sai versão nova (sem recarregar no meio da leitura). */
export function setupPwa() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  const pt = () => useLanguage.getState().locale === 'pt-BR'
  const update = registerSW({
    onNeedRefresh() {
      toast(pt() ? 'Nova versão disponível' : 'New version available', {
        tone: 'info',
        duration: 60_000,
        action: { label: pt() ? 'Atualizar' : 'Update', onClick: () => void update(true) },
      })
    },
    onOfflineReady() {
      toast(pt() ? 'Pronto para usar offline' : 'Ready to work offline', { tone: 'info' })
    },
    onRegisteredSW(_url, reg) {
      // Procura atualização a cada hora enquanto o app está aberto.
      if (reg) setInterval(() => { void reg.update() }, 60 * 60 * 1000)
    },
  })
  // Pede armazenamento persistente (o iOS apaga caches de sites pouco usados).
  void navigator.storage?.persist?.().catch(() => {})
}
