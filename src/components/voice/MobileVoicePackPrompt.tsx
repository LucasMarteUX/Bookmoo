// Celular: se o pacote de voz não instalou sozinho, oferece baixar com um toque (mostra o tamanho e o progresso).
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { DEFAULT_KOKORO_VOICE } from '@/lib/kokoro/voices'
import { activeKokoroVoice, downloadKokoroVoice, KOKORO_INSTALL_FAILED, KOKORO_PACKAGE_MB } from '@/lib/kokoro/engine'
import { isMobileDevice } from '@/lib/deviceVoice'

export function MobileVoicePackPrompt({ pt }: { pt: boolean }) {
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!isMobileDevice()) return
    let shown = false
    const onFail = () => { if (!shown && !activeKokoroVoice()) { shown = true; setOpen(true) } }
    window.addEventListener(KOKORO_INSTALL_FAILED, onFail)
    return () => window.removeEventListener(KOKORO_INSTALL_FAILED, onFail)
  }, [])

  const download = async () => {
    setFailed(false)
    setProgress(0)
    try {
      await downloadKokoroVoice(DEFAULT_KOKORO_VOICE, f => setProgress(f))
      setOpen(false)
    } catch {
      setFailed(true)
    } finally {
      setProgress(null)
    }
  }

  const busy = progress !== null
  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) setOpen(o) }}>
      <DialogContent className="max-w-md">
        <DialogTitle className="font-display text-[22px] leading-tight">{pt ? 'Pacote de voz' : 'Voice pack'}</DialogTitle>
        <DialogDescription className="mt-2 text-[14.5px] leading-relaxed">
          {pt
            ? `Para que a voz de narração funcione no seu celular, baixe o pacote de voz no aparelho (cerca de ${KOKORO_PACKAGE_MB} MB). Assim você terá a experiência completa de aprendizado.`
            : `For narration to work on your phone, download the voice pack to this device (about ${KOKORO_PACKAGE_MB} MB). You'll get the full learning experience.`}
        </DialogDescription>
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
          {!busy && <button type="button" onClick={() => setOpen(false)} className="h-10 px-4 rounded-full text-[14px] font-medium hover:bg-[var(--ui-hover)]">{pt ? 'Agora não' : 'Not now'}</button>}
          <button type="button" disabled={busy} onClick={download} className="h-10 px-5 rounded-full text-[14px] font-semibold disabled:opacity-60"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {busy ? (pt ? 'Baixando…' : 'Downloading…') : (pt ? `Baixar pacote (${KOKORO_PACKAGE_MB} MB)` : `Download (${KOKORO_PACKAGE_MB} MB)`)}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
