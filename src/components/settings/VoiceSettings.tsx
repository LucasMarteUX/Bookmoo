import { useEffect, useMemo, useState } from 'react'
import { Volume2, Loader2, Check, Download, Trash2, ChevronDown } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { SettingsSection } from './SettingsUI'
import { KOKORO_VOICES, type KokoroVoice } from '@/lib/kokoro/voices'
import { Link } from 'react-router-dom'
import { isMobileDevice } from '@/lib/deviceVoice'
import {
  clearKokoroCrash, downloadKokoroVoice, downloadMobilePack, getKokoroState, isKokoroSupported, KOKORO_PACKAGE_MB, kokoroCrashedHere,
  kokoroRtf, kokoroWarm, mobilePackReady, removeKokoroVoice, selectKokoroVoice, subscribeKokoro, warmUpKokoro,
} from '@/lib/kokoro/engine'
import { speak, stopSpeaking, unlockAudioOutput, VOICE_FAILED_EVENT } from '@/lib/tts'
import { VoiceAvatar } from './VoiceAvatar'

const SAMPLE = 'Hello! This is how I sound when we read a story together.'
type Filter = 'all' | 'US' | 'UK' | 'female' | 'male'
const FILTERS: { id: Filter; pt: string; en: string }[] = [
  { id: 'all', pt: 'Todas', en: 'All' },
  { id: 'US', pt: 'Americano', en: 'American' },
  { id: 'UK', pt: 'Britânico', en: 'British' },
  { id: 'female', pt: 'Feminina', en: 'Female' },
  { id: 'male', pt: 'Masculina', en: 'Male' },
]
const FIRST = 6

/** Escolha e download das vozes Kokoro, que rodam no próprio navegador do aluno (grátis, sem servidor). */
export function VoiceSettings() {
  const [state, setState] = useState(getKokoroState())
  const [filter, setFilter] = useState<Filter>('all')
  const [downloading, setDownloading] = useState<{ id: string; progress: number } | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const supported = isKokoroSupported()
  const pt = useLanguage().locale === 'pt-BR'

  useEffect(() => {
    const off = subscribeKokoro(setState)
    return () => { off(); stopSpeaking() }
  }, [])

  // Selecionada primeiro, depois as baixadas, depois o resto (ordem original).
  const filtered = useMemo(() => {
    const rank = (v: KokoroVoice) => (state.selected === v.id ? 0 : state.voices.includes(v.id) ? 1 : 2)
    return KOKORO_VOICES
      .filter(v => filter === 'all' ? true : filter === 'US' || filter === 'UK' ? v.accent === filter : v.gender === filter)
      .map((v, i) => ({ v, i })).sort((a, b) => rank(a.v) - rank(b.v) || a.i - b.i).map(x => x.v)
  }, [filter, state.selected, state.voices])
  const shown = all ? filtered : filtered.slice(0, FIRST)

  const download = async (v: KokoroVoice) => {
    setError(null)
    setDownloading({ id: v.id, progress: 0 })
    try {
      await downloadKokoroVoice(v.id, (p) => setDownloading({ id: v.id, progress: p }))
      selectKokoroVoice(v.id)
    } catch (e) {
      console.error('[kokoro] download', e)
      setError(pt ? 'Não foi possível baixar a voz. Verifique sua conexão e tente de novo.' : 'Could not download the voice. Check your connection and try again.')
    } finally {
      setDownloading(null)
    }
  }

  const preview = async (v: KokoroVoice) => {
    setPreviewing(v.id)
    try {
      const h = await speak(SAMPLE, { language: 'en', context: 'preview', kokoroVoice: v.id })
      await h.done
    } finally {
      setPreviewing(null)
    }
  }

  // Celular: um pacote só (modelo leve + 2 vozes). A tela mostra o estado e deixa testar, baixar de novo e reativar.
  if (isMobileDevice()) return <MobileVoicePack pt={pt} />

  return (
    <SettingsSection id="voices" icon={Volume2} title={pt ? 'Voz de leitura' : 'Reading voice'}
      description={pt
        ? `A voz em inglês que narra seus livros. Roda no seu aparelho${state.modelReady ? '; o pacote de voz já está baixado.' : '; no primeiro download o pacote (cerca de 90 MB) fica salvo. Prefira Wi-Fi.'}`
        : `The English voice that narrates your books. It runs on your device${state.modelReady ? '; the voice pack is already downloaded.' : '; the first download (about 90 MB) is saved here. Wi-Fi is best.'}`}>
      <div className="px-5 py-4 space-y-4">
        {!supported && (
          <p className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Este navegador não roda as vozes. Atualize o navegador ou use o Chrome, o Edge ou o Safari mais recentes.' : 'This browser cannot run the voices. Update it or use the latest Chrome, Edge or Safari.'}
          </p>
        )}
        {error && <p className="text-[13px]" style={{ color: 'var(--color-destructive)' }}>{error}</p>}

        <div className="-mx-5 px-5 flex gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap sm:overflow-visible" role="group" aria-label={pt ? 'Filtrar vozes' : 'Filter voices'}>
          {FILTERS.map((f) => {
            const on = filter === f.id
            return (
              <button key={f.id} type="button" onClick={() => { setFilter(f.id); setAll(false) }} aria-pressed={on}
                className="shrink-0 h-8 px-3.5 rounded-full text-[13px] font-medium border transition-colors"
                style={{ borderColor: on ? 'transparent' : 'var(--theme-border)', backgroundColor: on ? 'var(--theme-primary)' : 'transparent', color: on ? 'var(--theme-primary-text)' : 'var(--theme-text-secondary)' }}>
                {pt ? f.pt : f.en}
              </button>
            )
          })}
        </div>

        <ul className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label={pt ? 'Voz de leitura' : 'Reading voice'}>
          {shown.map((v) => {
            const downloaded = state.modelReady && state.voices.includes(v.id)
            const active = downloaded && state.selected === v.id
            const isDownloading = downloading?.id === v.id
            return (
              <li
                key={v.id}
                className="flex items-center gap-3 p-3 rounded-xl border transition-colors"
                style={{
                  borderColor: active ? 'var(--pastel-green-bd)' : 'var(--theme-border)',
                  backgroundColor: active ? 'var(--pastel-green-bg)' : 'var(--theme-card-bg)',
                }}
              >
                <VoiceAvatar voice={v} size={44} />
                <button
                  role="radio"
                  aria-checked={active}
                  disabled={!downloaded}
                  onClick={() => selectKokoroVoice(v.id)}
                  className="flex-1 min-w-0 text-left disabled:cursor-default"
                >
                  <div className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--theme-text)' }}>
                    {v.name}
                    {active && <Check className="w-4 h-4" style={{ color: 'var(--pastel-green-fg)' }} aria-label={pt ? 'Selecionada' : 'Selected'} />}
                  </div>
                  <div className="text-[12px] truncate" style={{ color: 'var(--theme-text-secondary)' }}>
                    {v.accent === 'US' ? (pt ? 'Americano' : 'American') : (pt ? 'Britânico' : 'British')} · {v.gender === 'female' ? (pt ? 'Feminina' : 'Female') : (pt ? 'Masculina' : 'Male')}
                    {v.basic && (pt ? ' · básica' : ' · basic')}
                  </div>
                  {isDownloading && (
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-border-subtle)' }}>
                      <div className="h-full transition-all" style={{ width: `${Math.round(downloading.progress * 100)}%`, backgroundColor: 'var(--theme-text-secondary)' }} />
                    </div>
                  )}
                </button>

                {downloaded ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => preview(v)} className="p-2 rounded-lg hover:bg-[var(--ui-hover)]" aria-label={`${pt ? 'Ouvir' : 'Play'} ${v.name}`} style={{ color: 'var(--theme-text)' }}>
                      {previewing === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <button onClick={() => removeKokoroVoice(v.id)} className="p-2 rounded-lg hover:bg-[var(--ui-hover)]" aria-label={`${pt ? 'Remover' : 'Remove'} ${v.name}`} style={{ color: 'var(--theme-text-secondary)' }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => download(v)}
                    disabled={!supported || !!downloading}
                    className="h-8 flex items-center gap-1.5 px-3 rounded-lg border text-[13px] font-medium transition-colors hover:bg-[var(--ui-hover)] disabled:opacity-50"
                    style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
                    aria-label={`${pt ? 'Baixar' : 'Download'} ${v.name}`}
                  >
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isDownloading ? `${Math.round(downloading.progress * 100)}%` : (pt ? 'Baixar' : 'Get')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {filtered.length > FIRST && (
          <button type="button" onClick={() => setAll(v => !v)} className="ui-hover w-full h-10 rounded-xl border text-[13.5px] font-medium inline-flex items-center justify-center gap-1.5" style={{ borderColor: 'var(--theme-border)' }}>
            {all ? (pt ? 'Mostrar menos' : 'Show less') : (pt ? `Ver todas as vozes (${filtered.length})` : `See all voices (${filtered.length})`)}
            <ChevronDown className={`w-4 h-4 transition-transform ${all ? 'rotate-180' : ''}`} />
          </button>
        )}

        <p className="text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'A velocidade da narração fica no botão de velocidade do leitor.' : 'Narration speed is set with the reader speed button.'}
        </p>
      </div>
    </SettingsSection>
  )
}

type Test = 'idle' | 'loading' | 'playing' | 'ok' | 'failed'

/** Ajustes › Voz no celular: o pacote de voz que faz os tutores e a leitura falarem. */
function MobileVoicePack({ pt }: { pt: boolean }) {
  const [, setTick] = useState(0)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [test, setTest] = useState<Test>('idle')
  useEffect(() => {
    const off = subscribeKokoro(() => setTick(t => t + 1))
    return () => { off(); stopSpeaking() }
  }, [])
  const ready = mobilePackReady()
  const paused = kokoroCrashedHere()
  const busy = progress !== null
  const rtf = kokoroRtf()

  const install = async () => {
    unlockAudioOutput()
    setError(null)
    setProgress(0)
    try { await downloadMobilePack(f => setProgress(f)); setTest('idle') }
    catch { setError(pt ? 'Não deu para baixar agora. Confira a conexão e tente de novo.' : "Couldn't download. Check your connection and try again.") }
    finally { setProgress(null) }
  }
  const run = async () => {
    unlockAudioOutput()
    setTest('loading')
    let failed = false
    const onFail = () => { failed = true }
    window.addEventListener(VOICE_FAILED_EVENT, onFail)
    try {
      const h = await speak(SAMPLE, { language: 'en', gender: 'female', onLoading: l => setTest(l ? 'loading' : 'playing') })
      setTest('playing')
      await h.done
      setTest(failed ? 'failed' : 'ok')
    } catch { setTest('failed') }
    finally { window.removeEventListener(VOICE_FAILED_EVENT, onFail) }
  }
  const reactivate = () => { clearKokoroCrash(); warmUpKokoro(); setTick(t => t + 1) }

  const status = paused
    ? (pt ? 'Pausado: a página reiniciou duas vezes gerando a voz' : 'Paused: the page restarted twice while generating')
    : ready
      ? (kokoroWarm() ? (pt ? 'Instalado e pronto' : 'Installed and ready') : (pt ? 'Instalado' : 'Installed'))
      : (pt ? 'Não instalado' : 'Not installed')
  const btn = 'h-10 px-3.5 rounded-lg border text-[13.5px] font-medium inline-flex items-center gap-1.5 transition-colors hover:bg-[var(--ui-hover)] disabled:opacity-50'
  return (
    <SettingsSection id="voices" icon={Volume2} title={pt ? 'Pacote de voz' : 'Voice pack'}
      description={pt
        ? `A voz em inglês dos tutores e da leitura em voz alta. Roda no seu celular (cerca de ${KOKORO_PACKAGE_MB} MB, baixados uma vez).`
        : `The English voice of the tutors and read-aloud. It runs on your phone (about ${KOKORO_PACKAGE_MB} MB, downloaded once).`}>
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 text-[14px]">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: paused ? 'var(--color-destructive)' : ready ? 'var(--pastel-green-fg)' : 'var(--theme-text-secondary)' }} aria-hidden />
          <span style={{ color: 'var(--theme-text)' }}>{status}</span>
        </div>
        {ready && rtf > 0 && (
          <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? `Velocidade deste celular: ${(rtf / 1000).toFixed(1)} s para cada segundo de fala.` : `This phone: ${(rtf / 1000).toFixed(1)} s per second of speech.`}
          </p>
        )}
        {busy && (
          <div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-border-subtle)' }}>
              <div className="h-full transition-all" style={{ width: `${Math.round((progress ?? 0) * 100)}%`, backgroundColor: 'var(--theme-text-secondary)' }} />
            </div>
            <p className="mt-1 text-[12px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{Math.round((progress ?? 0) * 100)}%</p>
          </div>
        )}
        {error && <p className="text-[13px]" style={{ color: 'var(--color-destructive)' }}>{error}</p>}
        {test === 'ok' && <p className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Se não ouviu, confira o volume de mídia e, no iPhone, a chave de silencioso.' : 'If you heard nothing, check the media volume and, on iPhone, the silent switch.'}</p>}
        {test === 'failed' && <p className="text-[13px]" style={{ color: 'var(--color-destructive)' }}>{pt ? 'A voz não respondeu. Tente de novo ou abra o diagnóstico.' : "The voice didn't respond. Try again or open diagnostics."}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {paused && <button type="button" onClick={reactivate} className={btn} style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Reativar voz' : 'Turn voice back on'}</button>}
          {ready && !paused && (
            <button type="button" onClick={() => void run()} disabled={busy || test === 'loading' || test === 'playing'} className={btn} style={{ borderColor: 'var(--theme-border)' }}>
              {test === 'loading' || test === 'playing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
              {test === 'loading' ? (pt ? 'Preparando…' : 'Preparing…') : test === 'playing' ? (pt ? 'Falando…' : 'Speaking…') : (pt ? 'Testar voz' : 'Test voice')}
            </button>
          )}
          <button type="button" onClick={() => void install()} disabled={busy} className={btn} style={{ borderColor: 'var(--theme-border)' }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {ready ? (pt ? 'Baixar de novo' : 'Download again') : (pt ? `Baixar pacote (${KOKORO_PACKAGE_MB} MB)` : `Download (${KOKORO_PACKAGE_MB} MB)`)}
          </button>
          <Link to="/diagnostico-voz" className={btn} style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}>{pt ? 'Diagnóstico' : 'Diagnostics'}</Link>
        </div>
      </div>
    </SettingsSection>
  )
}
