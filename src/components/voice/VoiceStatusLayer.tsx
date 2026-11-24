// Avisos da voz dos tutores que valem no app inteiro (celular, sobretudo):
// - "Toque para ouvir": o navegador recusou tocar a fala sozinho (iPhone sem toque recente). O próximo toque em qualquer
//   lugar toca a fala; este botão só deixa claro o que fazer, em vez de o tutor ficar de boca fechada sem explicação.
// - "Não consegui gerar a voz": a nossa voz falhou duas vezes na mesma fala. Mostra o aviso com "Tentar de novo" (o toque
//   também destrava o som), em vez de trocar para a voz do navegador ou ficar mudo.
import { useEffect, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { AUDIO_BLOCKED_EVENT, AUDIO_UNBLOCKED_EVENT, VOICE_FAILED_EVENT, type VoiceFailedDetail } from '@/lib/tts'

export function VoiceStatusLayer({ pt }: { pt: boolean }) {
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const onBlocked = () => setBlocked(true)
    const onUnblocked = () => setBlocked(false)
    let lastFail = 0
    const onFailed = (e: Event) => {
      const detail = (e as CustomEvent<VoiceFailedDetail>).detail
      // Várias falas seguidas falhando viram um aviso só.
      if (Date.now() - lastFail < 4000) return
      lastFail = Date.now()
      toast(pt ? 'Não consegui gerar a voz do tutor' : "Couldn't generate the tutor's voice", {
        tone: 'warning',
        detail: pt ? 'O celular demorou para responder. Toque para tentar de novo.' : 'Your phone took too long. Tap to try again.',
        action: detail?.retry ? { label: pt ? 'Tentar de novo' : 'Try again', onClick: detail.retry } : undefined,
      })
    }
    window.addEventListener(AUDIO_BLOCKED_EVENT, onBlocked)
    window.addEventListener(AUDIO_UNBLOCKED_EVENT, onUnblocked)
    window.addEventListener(VOICE_FAILED_EVENT, onFailed)
    return () => {
      window.removeEventListener(AUDIO_BLOCKED_EVENT, onBlocked)
      window.removeEventListener(AUDIO_UNBLOCKED_EVENT, onUnblocked)
      window.removeEventListener(VOICE_FAILED_EVENT, onFailed)
    }
  }, [pt])

  if (!blocked) return null
  return (
    <div className="fixed inset-x-0 z-[90] flex justify-center pointer-events-none"
      style={{ bottom: 'calc(var(--safe-b, 0px) + var(--tabbar-h, 0px) + 1rem)' }}>
      {/* O toque neste botão já é o gesto que libera o som: o tts toca a fala no próprio evento. */}
      <button type="button" data-voice-unblock
        className="pointer-events-auto inline-flex items-center gap-2 h-11 px-4 rounded-full text-[15px] font-medium shadow-lg active:scale-[0.96] transition-transform"
        style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
        <Volume2 size={18} aria-hidden />
        {pt ? 'Toque para ouvir o tutor' : 'Tap to hear the tutor'}
      </button>
    </div>
  )
}
