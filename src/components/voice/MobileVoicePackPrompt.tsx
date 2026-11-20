// Celular: logo ao entrar na conta, avisa que a leitura precisa do pacote de voz (modelo leve + 2 vozes) e baixa com um
// toque, mostrando tamanho e progresso. Volta a aparecer a cada nova visita até o pacote estar instalado. Enquanto isso,
// e se o pacote falhar, os tutores falam com a voz do próprio aparelho (nunca ficam mudos).
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { downloadMobilePack, KOKORO_INSTALL_FAILED, KOKORO_PACKAGE_MB, kokoroCrashedHere, mobilePackReady } from '@/lib/kokoro/engine'
import { isMobileDevice } from '@/lib/deviceVoice'

const SNOOZE_KEY = 'upoonly.voicePack.snoozed'
const snoozed = () => { try { return sessionStorage.getItem(SNOOZE_KEY) === '1' } catch { return false } }

export function MobileVoicePackPrompt({ pt }: { pt: boolean }) {
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!isMobileDevice()) return
    const need = () => !mobilePackReady() && !kokoroCrashedHere()
    // Primeira coisa ao entrar (uma vez por visita, se a pessoa disse "agora não").
    const t = window.setTimeout(() => { if (need() && !snoozed()) setOpen(true) }, 600)
    // Uma fala pediu a voz e o pacote não está aqui (respeita o "agora não" desta visita).
    const onAsk = () => { if (need() && !snoozed()) setOpen(true) }
    window.addEventListener(KOKORO_INSTALL_FAILED, onAsk)
    return () => { window.clearTimeout(t); window.removeEventListener(KOKORO_INSTALL_FAILED, onAsk) }
  }, [])

  const download = async () => {
    setFailed(false)
    setProgress(0)
    try {
      await downloadMobilePack(f => setProgress(f))
      setOpen(false)
    } catch {
      setFailed(true)
    } finally {
      setProgress(null)
    }
  }

  const later = () => {
    try { sessionStorage.setItem(SNOOZE_KEY, '1') } catch { /* ignore */ }
    setOpen(false)
  }

  const busy = progress !== null
  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) (o ? setOpen(true) : later()) }}>
      <DialogContent className="max-w-md">
        <DialogTitle className="font-display text-[22px] leading-tight">{pt ? 'Pacote de voz' : 'Voice pack'}</DialogTitle>
        <DialogDescription className="mt-2 text-[14.5px] leading-relaxed">
          {pt
            ? `Este app precisa de um pacote de voz instalado para a leitura e para os tutores falarem. Baixe o pacote (cerca de ${KOKORO_PACKAGE_MB} MB, uma vez só) e continue aproveitando.`
            : `This app needs a voice pack installed for reading and for the tutors to talk. Download it once (about ${KOKORO_PACKAGE_MB} MB) and keep enjoying.`}
        </DialogDescription>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Dica: use o Wi-Fi. Enquanto o pacote não estiver instalado, os tutores falam com a voz do seu celular.'
            : 'Tip: use Wi-Fi. Until the pack is installed, the tutors talk with your phone’s voice.'}
        </p>
        {busy && (
          <div className="mt-4">
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
              <div className="h-full transition-[width]" style={{ width: `${Math.round((progress ?? 0) * 100)}%`, backgroundColor: 'var(--theme-primary)' }} />
            </div>
            <p className="mt-1.5 text-[12.5px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>
              {Math.round((progress ?? 0) * 100)}% {pt ? `de ${KOKORO_PACKAGE_MB} MB` : `of ${KOKORO_PACKAGE_MB} MB`}
            </p>
          </div>
        )}
        {failed && <p className="mt-3 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Não deu para baixar agora. Confira a conexão e tente de novo.' : "Couldn't download. Check your connection and try again."}</p>}
        <div className="mt-5 flex justify-end gap-2">
          {!busy && <button type="button" onClick={later} className="h-10 px-4 rounded-full text-[14px] font-medium hover:bg-[var(--ui-hover)]">{pt ? 'Agora não' : 'Not now'}</button>}
          <button type="button" disabled={busy} onClick={download} className="h-10 px-5 rounded-full text-[14px] font-semibold disabled:opacity-60"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {busy ? (pt ? 'Baixando…' : 'Downloading…') : (pt ? `Baixar pacote (${KOKORO_PACKAGE_MB} MB)` : `Download (${KOKORO_PACKAGE_MB} MB)`)}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
