// Celular: logo ao entrar na conta, avisa que os tutores e a leitura precisam do pacote de voz (modelo leve + 2 vozes) e
// baixa com um toque, mostrando tamanho e progresso. Volta a aparecer a cada nova visita até o pacote estar instalado.
// Os tutores falam só com a nossa voz: sem o pacote eles não falam (nunca usam a voz do navegador).
// Também avisa o resultado: "pacote instalado" (com "Testar voz", que fala na hora pelo mesmo player do app) ou, se o
// celular reiniciou a página duas vezes gerando a voz, que ela ficou pausada um tempo, com "Reativar voz".
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { clearKokoroCrash, downloadMobilePack, KOKORO_INSTALL_FAILED, KOKORO_PACKAGE_MB, kokoroCrashedHere, mobilePackReady, warmUpKokoro } from '@/lib/kokoro/engine'
import { isMobileDevice } from '@/lib/deviceVoice'
import { speak, unlockAudioOutput, VOICE_FAILED_EVENT } from '@/lib/tts'
import { voiceLog } from '@/lib/voiceLog'

const SNOOZE_KEY = 'upoonly.voicePack.snoozed'
const CRASH_SEEN_KEY = 'upoonly.voicePack.crashSeen'
const snoozed = () => { try { return sessionStorage.getItem(SNOOZE_KEY) === '1' } catch { return false } }
const crashSeenAt = () => { try { return Number(localStorage.getItem(CRASH_SEEN_KEY) || 0) } catch { return Date.now() } }

let lastClosedAt = 0

type View = 'offer' | 'done' | 'crashed'
type TestState = 'idle' | 'loading' | 'playing' | 'ok' | 'silent'

export function MobileVoicePackPrompt({ pt }: { pt: boolean }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('offer')
  const [progress, setProgress] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const [slowSample, setSlowSample] = useState(false)
  const [test, setTest] = useState<TestState>('idle')

  useEffect(() => {
    if (!isMobileDevice()) return
    const need = () => !mobilePackReady() && !kokoroCrashedHere()
    const t = window.setTimeout(() => {
      // A voz derrubou a página 2 vezes há pouco: explica (uma vez a cada pausa) e oferece reativar.
      if (kokoroCrashedHere() && Date.now() - crashSeenAt() > 30 * 60_000) { setView('crashed'); setOpen(true); return }
      // Primeira coisa ao entrar (uma vez por visita, se a pessoa disse "agora não").
      if (need() && !snoozed()) { setView('offer'); setOpen(true) }
    }, 600)
    // Uma fala pediu a voz e o pacote não está aqui. Mesmo com "agora não", abre: a pessoa tocou para ouvir o tutor.
    const onAsk = () => {
      if (Date.now() - lastClosedAt < 20_000) return // acabou de fechar: as próximas frases da mesma fala não reabrem
      if (kokoroCrashedHere()) { setView('crashed'); setOpen(true); return }
      if (!mobilePackReady()) { setView('offer'); setOpen(true) }
    }
    window.addEventListener(KOKORO_INSTALL_FAILED, onAsk)
    return () => { window.clearTimeout(t); window.removeEventListener(KOKORO_INSTALL_FAILED, onAsk) }
  }, [])

  const download = async () => {
    setFailed(false)
    setProgress(0)
    unlockAudioOutput() // este toque também libera o som para o teste logo depois
    try {
      const { sampleOk } = await downloadMobilePack(f => setProgress(f))
      voiceLog('pacote.instalado', { amostra: sampleOk })
      setSlowSample(!sampleOk)
      setTest('idle')
      setView('done')
    } catch (e) {
      voiceLog('pacote.falhou', { erro: String((e as Error)?.message ?? e) })
      setFailed(true)
    } finally {
      setProgress(null)
    }
  }

  const close = () => {
    if (view === 'offer') { try { sessionStorage.setItem(SNOOZE_KEY, '1') } catch { /* ignore */ } }
    if (view === 'crashed') { try { localStorage.setItem(CRASH_SEEN_KEY, String(Date.now())) } catch { /* ignore */ } }
    lastClosedAt = Date.now()
    setOpen(false)
  }

  // Fala de verdade pela nossa voz e pelo player do app: se o tutor falar aqui, fala no resto do app.
  const testVoice = async () => {
    unlockAudioOutput()
    setTest('loading')
    let failedNow = false
    const onFail = () => { failedNow = true }
    window.addEventListener(VOICE_FAILED_EVENT, onFail)
    try {
      const h = await speak('Hi! I am ready to read and talk with you.', { gender: 'female', onLoading: l => setTest(l ? 'loading' : 'playing') })
      setTest('playing')
      await h.done
      setTest(failedNow ? 'silent' : 'ok')
      voiceLog(failedNow ? 'pacote.teste_falhou' : 'pacote.teste_ok')
    } catch (e) {
      setTest('silent')
      voiceLog('pacote.teste_falhou', { erro: String((e as Error)?.message ?? e) })
    } finally {
      window.removeEventListener(VOICE_FAILED_EVENT, onFail)
    }
  }

  const reactivate = () => {
    clearKokoroCrash()
    try { localStorage.removeItem(CRASH_SEEN_KEY) } catch { /* ignore */ }
    voiceLog('pacote.reativado')
    warmUpKokoro()
    setTest('idle')
    setView(mobilePackReady() ? 'done' : 'offer')
  }

  const busy = progress !== null
  // Mesmo botão do sistema (ui/button): cantos rounded-lg, 44 px de altura no celular.
  const primary = 'h-11 px-4 rounded-lg text-[15px] font-medium active:scale-[0.96] transition-transform disabled:opacity-50'
  const secondary = 'h-11 px-4 rounded-lg text-[15px] font-medium active:scale-[0.96] transition-transform hover:bg-[var(--ui-hover)] disabled:opacity-50'
  const testLabel = test === 'loading' ? (pt ? 'Preparando a voz…' : 'Preparing voice…')
    : test === 'playing' ? (pt ? 'Falando…' : 'Speaking…')
    : (pt ? 'Testar voz' : 'Test voice')
  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) (o ? setOpen(true) : close()) }}>
      <DialogContent className="max-w-md" style={{ padding: '32px 24px 24px' }}>
        {view === 'offer' && <>
          <DialogTitle className="font-display text-[22px] leading-tight">{pt ? 'Pacote de voz' : 'Voice pack'}</DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed">
            {pt
              ? `Os tutores e a leitura em voz alta falam com o pacote de voz, que roda no seu celular. Baixe uma vez (cerca de ${KOKORO_PACKAGE_MB} MB) e continue aproveitando.`
              : `The tutors and read-aloud speak with the voice pack, which runs on your phone. Download it once (about ${KOKORO_PACKAGE_MB} MB) and keep enjoying.`}
          </DialogDescription>
          <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Dica: use o Wi-Fi e deixe esta tela aberta até terminar.'
              : 'Tip: use Wi-Fi and keep this screen open until it finishes.'}
          </p>
          {busy && (
            <div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                <div className="h-full transition-[width]" style={{ width: `${Math.round((progress ?? 0) * 100)}%`, backgroundColor: 'var(--theme-primary)' }} />
              </div>
              <p className="mt-1.5 text-[12.5px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>
                {(progress ?? 0) >= 0.92
                  ? (pt ? 'Testando a voz no seu celular…' : 'Testing the voice on your phone…')
                  : `${Math.round((progress ?? 0) * 100)}% ${pt ? `de ${KOKORO_PACKAGE_MB} MB` : `of ${KOKORO_PACKAGE_MB} MB`}`}
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
            {pt ? 'Tudo pronto. Toque em "Testar voz" para ouvir: se a voz tocar aqui, os tutores e a leitura falam no resto do app.'
              : 'All set. Tap "Test voice" to hear it: if it plays here, the tutors and read-aloud will talk everywhere in the app.'}
          </DialogDescription>
          {slowSample && test === 'idle' && (
            <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
              {pt ? 'Seu celular demorou para gerar a primeira frase. A primeira fala pode levar alguns segundos.'
                : 'Your phone took a while to generate the first sentence. The first line may take a few seconds.'}
            </p>
          )}
          {test === 'ok' && (
            <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
              {pt ? 'Ouviu? Se não ouviu nada, confira o volume de mídia e, no iPhone, a chave de silencioso.'
                : 'Did you hear it? If not, check the media volume and, on iPhone, the silent switch.'}
            </p>
          )}
          {test === 'silent' && (
            <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
              {pt ? 'A voz não respondeu agora. Toque em "Testar voz" de novo; se continuar, abra Ajustes › Voz › Diagnóstico.'
                : "The voice didn't respond. Tap \"Test voice\" again; if it keeps failing, open Settings › Voice › Diagnostics."}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => void testVoice()} disabled={test === 'loading' || test === 'playing'} className={secondary}>{testLabel}</button>
            <button type="button" onClick={close} className={primary} style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Continuar' : 'Continue'}</button>
          </div>
        </>}

        {view === 'crashed' && <>
          <DialogTitle className="font-display text-[22px] leading-tight">{pt ? 'A voz pausou neste celular' : 'Voice paused on this phone'}</DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed">
            {pt ? 'A página reiniciou duas vezes enquanto o celular gerava a voz, por falta de memória. Pausamos a voz por alguns minutos para não travar. Você pode reativar agora.'
              : 'The page restarted twice while your phone was generating the voice (low memory). We paused the voice for a few minutes. You can turn it back on now.'}
          </DialogDescription>
          <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Ajuda fechar outros apps e abas abertas antes de conversar com o tutor.'
              : 'Closing other apps and tabs before talking to the tutor helps.'}
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className={secondary}>{pt ? 'Agora não' : 'Not now'}</button>
            <button type="button" onClick={reactivate} className={primary} style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Reativar voz' : 'Turn voice back on'}</button>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  )
}
