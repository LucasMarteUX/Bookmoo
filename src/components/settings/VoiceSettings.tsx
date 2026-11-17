import { useEffect, useMemo, useState } from 'react'
import { Volume2, Loader2, Check, Download, Trash2, ChevronDown } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { SettingsSection } from './SettingsUI'
import { KOKORO_VOICES, type KokoroVoice } from '@/lib/kokoro/voices'
import { DeviceVoicePicker } from '@/components/layout/VoiceSelect'
import { hasDeviceVoice } from '@/lib/deviceVoice'
import {
  downloadKokoroVoice, getKokoroState, isKokoroSupported, removeKokoroVoice, selectKokoroVoice, subscribeKokoro,
} from '@/lib/kokoro/engine'
import { speak, stopSpeaking } from '@/lib/tts'
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

  // Celular: a voz do próprio aparelho (a baixável derrubava a página). Só a escolha feminina/masculina.
  if (!supported && hasDeviceVoice()) {
    return (
      <SettingsSection id="voices" icon={Volume2} title={pt ? 'Voz de leitura' : 'Reading voice'}
        description={pt ? 'A voz em inglês que lê seus livros e fala nas conversas. Neste aparelho é a voz dele mesmo, pronta, sem download.' : 'The English voice for your books and conversations. On this device it is its own built-in voice, no download.'}>
        <div className="px-5 py-4"><DeviceVoicePicker hideLabel pt={pt} label={pt ? 'Voz de leitura' : 'Reading voice'} /></div>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection id="voices" icon={Volume2} title={pt ? 'Voz de leitura' : 'Reading voice'}
      description={pt
        ? `A voz em inglês que narra seus livros. Roda no seu aparelho${state.modelReady ? '; o pacote de voz já está baixado.' : '; no primeiro download o pacote (cerca de 90 MB) fica salvo. Prefira Wi-Fi.'}`
        : `The English voice that narrates your books. It runs on your device${state.modelReady ? '; the voice pack is already downloaded.' : '; the first download (about 90 MB) is saved here. Wi-Fi is best.'}`}>
      <div className="px-5 py-4 space-y-4">
        {!supported && (
          <p className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Este navegador não suporta as vozes. A voz padrão do navegador continuará sendo usada.' : 'This browser does not support these voices. The browser voice will be used.'}
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
