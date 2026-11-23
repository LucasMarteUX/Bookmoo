// Celular: logo ao entrar na conta, avisa que a leitura precisa do pacote de voz (modelo leve + 2 vozes) e baixa com um
// toque, mostrando tamanho e progresso. Volta a aparecer a cada nova visita até o pacote estar instalado. Enquanto isso,
// e se o pacote falhar, os tutores falam com a voz do próprio aparelho (nunca ficam mudos).
// Também avisa o resultado: "pacote instalado" ou, se o celular não aguentou o pacote (a página reiniciou), que a voz do
// aparelho assume. Os dois têm "Testar voz", que fala na hora (o toque também libera o som no iPhone).
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { downloadMobilePack, KOKORO_INSTALL_FAILED, KOKORO_PACKAGE_MB, kokoroCrashedHere, mobilePackReady } from '@/lib/kokoro/engine'
import { deviceSpeak, isMobileDevice } from '@/lib/deviceVoice'
import { speak } from '@/lib/tts'

const SNOOZE_KEY = 'upoonly.voicePack.snoozed'
const CRASH_SEEN_KEY = 'upoonly.voicePack.crashSeen'
const snoozed = () => { try { return sessionStorage.getItem(SNOOZE_KEY) === '1' } catch { return false } }
const crashSeen = () => { try { return localStorage.getItem(CRASH_SEEN_KEY) === '1' } catch { return true } }

type View = 'offer' | 'done' | 'crashed'

export function MobileVoicePackPrompt({ pt }: { pt: boolean }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('offer')
  const [progress, setProgress] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!isMobileDevice()) return
    const need = () => !mobilePackReady() && !kokoroCrashedHere()
    const t = window.setTimeout(() => {
      // O pacote derrubou a página neste celular: explica uma vez e segue com a voz do aparelho.
      if (kokoroCrashedHere() && !crashSeen()) { setView('crashed'); setOpen(true); return }
      // Primeira coisa ao entrar (uma vez por visita, se a pessoa disse "agora não").
      if (need() && !snoozed()) { setView('offer'); setOpen(true) }
    }, 600)
    // Uma fala pediu a voz e o pacote não está aqui (respeita o "agora não" desta visita).
    const onAsk = () => { if (need() && !snoozed()) { setView('offer'); setOpen(true) } }
    window.addEventListener(KOKORO_INSTALL_FAILED, onAsk)
    return () => { window.clearTimeout(t); window.removeEventListener(KOKORO_INSTALL_FAILED, onAsk) }
  }, [])

  const download = async () => {
    setFailed(false)
    setProgress(0)
    try {
      await downloadMobilePack(f => setProgress(f))
      setView('done')
    } catch {
      setFailed(true)
    } finally {
      setProgress(null)
    }
  }

  const close = () => {
    if (view === 'offer') { try { sessionStorage.setItem(SNOOZE_KEY, '1') } catch { /* ignore */ } }
    if (view === 'crashed') { try { localStorage.setItem(CRASH_SEEN_KEY, '1') } catch { /* ignore */ } }
    setOpen(false)
  }

  const testVoice = () => {
    const line = pt ? 'Hi! I am ready to read and talk with you.' : 'Hi! I am ready to read and talk with you.'
    if (view === 'crashed') void deviceSpeak(line, { gender: 'female' })
    else void speak(line, { gender: 'female' })
  }

  const busy = progress !== null
  // Mesmo botão do sistema (ui/button): cantos rounded-lg, 44 px de altura no celular.
  const primary = 'h-11 px-4 rounded-lg text-[15px] font-medium active:scale-[0.96] transition-transform disabled:opacity-50'
  const secondary = 'h-11 px-4 rounded-lg text-[15px] font-medium active:scale-[0.96] transition-transform hover:bg-[var(--ui-hover)]'
  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) (o ? setOpen(true) : close()) }}>
      <DialogContent className="max-w-md" style={{ padding: '32px 24px 24px' }}>
        {view === 'offer' && <>
          <DialogTitle className="font-display text-[22px] leading-tight">{pt ? 'Pacote de voz' : 'Voice pack'}</DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed">
            {pt
              ? `Este app precisa de um pacote de voz instalado para a leitura e para os tutores falarem. Baixe o pacote (cerca de ${KOKORO_PACKAGE_MB} MB, uma vez só) e continue aproveitando.`
              : `This app needs a voice pack installed for reading and for the tutors to talk. Download it once (about ${KOKORO_PACKAGE_MB} MB) and keep enjoying.`}
          </DialogDescription>
          <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Dica: use o Wi-Fi. Enquanto o pacote não estiver instalado, os tutores falam com a voz do seu celular.'
              : 'Tip: use Wi-Fi. Until the pack is installed, the tutors talk with your phone’s voice.'}
          </p>
          {busy && (
            <div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                <div className="h-full transition-[width]" style={{ width: `${Math.round((progress ?? 0) * 100)}%`, backgroundColor: 'var(--theme-primary)' }} />
              </div>
              <p className="mt-1.5 text-[12.5px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>
                {Math.round((progress ?? 0) * 100)}% {pt ? `de ${KOKORO_PACKAGE_MB} MB` : `of ${KOKORO_PACKAGE_MB} MB`}
              </p>
            </div>
          )}
          {failed && <p className="text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Não deu para baixar agora. Confira a conexão e tente de novo.' : "Couldn't download. Check your connection and try again."}</p>}
          <div className="flex justify-end gap-2 pt-1">
            {!busy && <button type="button" onClick={close} className={secondary}>{pt ? 'Agora não' : 'Not now'}</button>}
            <button type="button" disabled={busy} onClick={download} className={primary} style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
              {busy ? (pt ? 'Baixando…' : 'Downloading…') : (pt ? `Baixar pacote (${KOKORO_PACKAGE_MB} MB)` : `Download (${KOKORO_PACKAGE_MB} MB)`)}
            </button>
          </div>
        </>}

        {view === 'done' && <>
          <DialogTitle className="font-display text-[22px] leading-tight">{pt ? 'Pacote de voz instalado' : 'Voice pack installed'}</DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed">
            {pt ? 'Tudo pronto. Os tutores já falam com a voz nova e a leitura em voz alta está liberada. Toque em "Testar voz" para ouvir.'
              : 'All set. The tutors now talk with the new voice and read-aloud is ready. Tap "Test voice" to hear it.'}
          </DialogDescription>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={testVoice} className={secondary}>{pt ? 'Testar voz' : 'Test voice'}</button>
            <button type="button" onClick={close} className={primary} style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Continuar' : 'Continue'}</button>
          </div>
        </>}

        {view === 'crashed' && <>
          <DialogTitle className="font-display text-[22px] leading-tight">{pt ? 'Usando a voz do celular' : 'Using your phone’s voice'}</DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed">
            {pt ? 'Seu celular não aguentou rodar o pacote de voz e reiniciou a página. Para não acontecer de novo, os tutores e a leitura vão usar a voz do próprio celular.'
              : 'Your phone could not run the voice pack and restarted the page. To avoid that, the tutors and read-aloud will use your phone’s own voice.'}
          </DialogDescription>
          <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Se não ouvir nada, confira se o celular não está no modo silencioso e se o volume de mídia está alto.'
              : 'If you hear nothing, check that silent mode is off and media volume is up.'}
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={testVoice} className={secondary}>{pt ? 'Testar voz' : 'Test voice'}</button>
            <button type="button" onClick={close} className={primary} style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Entendi' : 'Got it'}</button>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  )
}
