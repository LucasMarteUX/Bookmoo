import { useEffect, useMemo, useState } from 'react'
import { Volume2, Loader2, Check, Mic, Download, Trash2 } from 'lucide-react'
import { KOKORO_VOICES, type KokoroVoice } from '@/lib/kokoro/voices'
import {
  downloadKokoroVoice, getKokoroState, isKokoroSupported, removeKokoroVoice, selectKokoroVoice, subscribeKokoro,
} from '@/lib/kokoro/engine'
import { speak, stopSpeaking } from '@/lib/tts'
import { VoiceAvatar } from './VoiceAvatar'

const SAMPLE = 'Hello! This is how I sound when we read a story together.'
type Filter = 'all' | 'US' | 'UK' | 'female' | 'male'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'US', label: 'Americano' },
  { id: 'UK', label: 'Britânico' },
  { id: 'female', label: 'Feminina' },
  { id: 'male', label: 'Masculina' },
]

/** Escolha e download das vozes Kokoro, que rodam no próprio navegador do aluno (grátis, sem servidor). */
export function VoiceSettings() {
  const [state, setState] = useState(getKokoroState())
  const [filter, setFilter] = useState<Filter>('all')
  const [downloading, setDownloading] = useState<{ id: string; progress: number } | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supported = isKokoroSupported()

  useEffect(() => {
    const off = subscribeKokoro(setState)
    return () => { off(); stopSpeaking() }
  }, [])

  const shown = useMemo(() => KOKORO_VOICES.filter((v) =>
    filter === 'all' ? true : filter === 'US' || filter === 'UK' ? v.accent === filter : v.gender === filter,
  ), [filter])

  const download = async (v: KokoroVoice) => {
    setError(null)
    setDownloading({ id: v.id, progress: 0 })
    try {
      await downloadKokoroVoice(v.id, (p) => setDownloading({ id: v.id, progress: p }))
      selectKokoroVoice(v.id)
    } catch (e) {
      console.error('[kokoro] download', e)
      setError('Não foi possível baixar a voz. Verifique sua conexão e tente de novo.')
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

  return (
    <section className="space-y-4">
      <h2 className="text-[15px] font-semibold flex items-center gap-2 mb-3" style={{ color: 'var(--theme-text)' }}>
        <Mic className="w-5 h-5" />
        Voz de leitura
      </h2>
      <div className="p-5 rounded-2xl border transition-colors space-y-5" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
        <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
          Escolha uma voz em inglês para narrar seus livros e quadrinhos. Livros em outros idiomas usam a voz do navegador. A voz roda no seu próprio aparelho:
          {state.modelReady
            ? ' o pacote de voz já está baixado neste dispositivo.'
            : ' no primeiro download o pacote de voz (~90 MB) fica salvo neste dispositivo. Prefira usar Wi-Fi.'}
        </p>

        {!supported && (
          <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
            Este navegador não suporta as vozes. A voz padrão do navegador continuará sendo usada.
          </p>
        )}
        {error && <p className="text-sm text-[var(--pastel-rose-fg)]">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="h-8 px-3 rounded-lg text-[13px] font-medium border transition-colors hover:bg-[var(--ui-hover)]"
              style={{
                borderColor: filter === f.id ? 'var(--theme-text-secondary)' : 'var(--theme-border)',
                backgroundColor: filter === f.id ? 'var(--theme-nav-active)' : 'transparent',
                color: filter === f.id ? 'var(--theme-text)' : 'var(--theme-text-secondary)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <ul className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Voz de leitura">
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
                    {active && <Check className="w-4 h-4" style={{ color: 'var(--pastel-green-fg)' }} aria-label="Selecionada" />}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                    {v.accent === 'US' ? 'Inglês americano' : 'Inglês britânico'} · {v.gender === 'female' ? 'Feminina' : 'Masculina'}
                    {v.basic && ' · qualidade básica'}
                  </div>
                  {isDownloading && (
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-border-subtle)' }}>
                      <div className="h-full transition-all" style={{ width: `${Math.round(downloading.progress * 100)}%`, backgroundColor: 'var(--theme-text-secondary)' }} />
                    </div>
                  )}
                </button>

                {downloaded ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => preview(v)} className="p-2 rounded-lg hover:bg-[var(--ui-hover)]" aria-label={`Ouvir ${v.name}`} style={{ color: 'var(--theme-text)' }}>
                      {previewing === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <button onClick={() => removeKokoroVoice(v.id)} className="p-2 rounded-lg hover:bg-[var(--ui-hover)]" aria-label={`Remover ${v.name}`} style={{ color: 'var(--theme-text-secondary)' }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => download(v)}
                    disabled={!supported || !!downloading}
                    className="h-8 flex items-center gap-1.5 px-3 rounded-lg border text-[13px] font-medium transition-colors hover:bg-[var(--ui-hover)] disabled:opacity-50"
                    style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
                    aria-label={`Baixar ${v.name}`}
                  >
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isDownloading ? `${Math.round(downloading.progress * 100)}%` : 'Baixar'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
          A velocidade da narração é ajustada no botão de velocidade do leitor, tanto no livro quanto no quadrinho.
        </p>
      </div>
    </section>
  )
}
