import { useEffect, useMemo, useState } from 'react'
import { Volume2, Loader2, Check, Mic } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { listVoices, savePreferences, speak, stopSpeaking, type TtsPreferences, type TtsVoice } from '@/lib/tts'

const SAMPLE = 'Hello! This is how I sound when we read together.'

/** Seleção de voz do aluno. Mostra apenas vozes ativas no catálogo (sincronizadas do VoiceStudio). */
export function VoiceSettings() {
  const [voices, setVoices] = useState<TtsVoice[]>([])
  const [prefs, setPrefs] = useState<TtsPreferences>({ preferred_voice_id: null, playback_speed: 1, auto_play: false })
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [filter, setFilter] = useState<string>('all')
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    listVoices()
      .then((r) => {
        setVoices(r.voices)
        if (r.preferences) setPrefs({ ...r.preferences, playback_speed: Number(r.preferences.playback_speed) })
        setStatus('ready')
      })
      .catch(() => setStatus('unavailable'))
    return () => stopSpeaking()
  }, [])

  // Filtro só aparece com metadados reais vindos do backend.
  const accents = useMemo(
    () => Array.from(new Set(voices.map((v) => v.accent ?? v.language).filter((x): x is string => !!x))),
    [voices],
  )
  const shown = filter === 'all' ? voices : voices.filter((v) => (v.accent ?? v.language) === filter)
  const selectedId = prefs.preferred_voice_id ?? voices.find((v) => v.is_default)?.id ?? null

  const persist = async (patch: Partial<TtsPreferences>) => {
    setPrefs((p) => ({ ...p, ...patch }))
    try {
      await savePreferences(patch)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      console.error('[tts] save preferences', e)
    }
  }

  const preview = async (v: TtsVoice) => {
    setPreviewing(v.id)
    try {
      const h = await speak(SAMPLE, { voiceId: v.id, context: 'preview', rate: prefs.playback_speed })
      await h.done
    } finally {
      setPreviewing(null)
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--theme-text)' }}>
        <Mic className="w-5 h-5" />
        Voz de leitura
        {saved && <Check className="w-4 h-4 text-green-600" aria-label="Salvo" />}
      </h2>
      <div className="p-6 rounded-3xl border transition-colors space-y-5" style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)' }}>
        {status === 'loading' && (
          <p className="text-sm flex items-center gap-2" style={{ color: 'var(--theme-text-secondary)' }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando vozes…
          </p>
        )}
        {status === 'unavailable' && (
          <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
            O serviço de vozes não está disponível agora. A voz do navegador será usada.
          </p>
        )}
        {status === 'ready' && voices.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
            Nenhuma voz habilitada ainda. A voz do navegador será usada.
          </p>
        )}

        {status === 'ready' && voices.length > 0 && (
          <>
            {accents.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {['all', ...accents].map((a) => (
                  <button
                    key={a}
                    onClick={() => setFilter(a)}
                    className="px-3 py-1 rounded-full text-sm border"
                    style={{
                      borderColor: 'var(--theme-border-subtle)',
                      backgroundColor: filter === a ? 'var(--theme-primary)' : 'transparent',
                      color: filter === a ? 'var(--theme-primary-text)' : 'var(--theme-text)',
                    }}
                  >
                    {a === 'all' ? 'Todas' : a}
                  </button>
                ))}
              </div>
            )}
            <ul className="space-y-2" role="radiogroup" aria-label="Voz preferida">
              {shown.map((v) => {
                const active = v.id === selectedId
                return (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl border"
                    style={{ borderColor: active ? 'var(--theme-primary)' : 'var(--theme-border-subtle)' }}
                  >
                    <button
                      role="radio"
                      aria-checked={active}
                      className="flex-1 text-left"
                      onClick={() => persist({ preferred_voice_id: v.id })}
                    >
                      <div className="font-medium" style={{ color: 'var(--theme-text)' }}>{v.name}</div>
                      {(v.language || v.accent || v.description) && (
                        <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                          {[v.language, v.accent, v.description].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => preview(v)}
                      className="p-2 rounded-full"
                      aria-label={`Ouvir prévia de ${v.name}`}
                      style={{ color: 'var(--theme-text)' }}
                    >
                      {previewing === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <div className="space-y-2">
          <Label style={{ color: 'var(--theme-text)' }}>Velocidade: {prefs.playback_speed.toFixed(2)}×</Label>
          <input
            type="range" min={0.5} max={1.5} step={0.05}
            value={prefs.playback_speed}
            onChange={(e) => setPrefs((p) => ({ ...p, playback_speed: Number(e.target.value) }))}
            onPointerUp={() => persist({ playback_speed: prefs.playback_speed })}
            onKeyUp={() => persist({ playback_speed: prefs.playback_speed })}
            className="w-full"
            disabled={status !== 'ready'}
          />
        </div>
      </div>
    </section>
  )
}
