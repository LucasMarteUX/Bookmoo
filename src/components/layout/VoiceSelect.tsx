import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Download, Loader2, Volume2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { VoiceAvatar } from '@/components/settings/VoiceAvatar'
import { KOKORO_VOICES, getKokoroVoice, type KokoroVoice } from '@/lib/kokoro/voices'
import {
  activeKokoroVoice, downloadKokoroVoice, getKokoroState, isKokoroSupported, selectKokoroVoice, subscribeKokoro,
} from '@/lib/kokoro/engine'
import { useTranslations } from '@/lib/i18n'
import { useLanguage } from '@/store/useLanguage'

/** Lista suspensa de vozes no sidebar. Escolher uma voz ainda não baixada inicia o download. */
export function VoiceSelect() {
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const [state, setState] = useState(getKokoroState())
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState<{ id: string; progress: number } | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => subscribeKokoro(setState), [])
  if (!isKokoroSupported()) return null

  const current = getKokoroVoice(activeKokoroVoice())

  const choose = async (v: KokoroVoice) => {
    setError(false)
    if (state.modelReady && state.voices.includes(v.id)) {
      selectKokoroVoice(v.id)
      setOpen(false)
      return
    }
    setDownloading({ id: v.id, progress: 0 })
    try {
      await downloadKokoroVoice(v.id, (p) => setDownloading({ id: v.id, progress: p }))
      selectKokoroVoice(v.id)
      setOpen(false)
    } catch (e) {
      console.error('[kokoro] download', e)
      setError(true)
    } finally {
      setDownloading(null)
    }
  }

  const groups: { label: string; voices: KokoroVoice[] }[] = [
    { label: locale === 'pt-BR' ? 'Americano' : 'American', voices: KOKORO_VOICES.filter((v) => v.accent === 'US') },
    { label: locale === 'pt-BR' ? 'Britânico' : 'British', voices: KOKORO_VOICES.filter((v) => v.accent === 'UK') },
  ]

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--theme-nav-text-muted)' }}>
        {t('readingVoice')}
      </p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="w-full flex items-center gap-2.5 p-2 rounded-[12px] text-left transition-colors"
            style={{ backgroundColor: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)' }}
            aria-label={t('readingVoice')}
          >
            {current ? (
              <VoiceAvatar voice={current} size={28} />
            ) : (
              <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--theme-bg)' }}>
                <Volume2 className="w-3.5 h-3.5" style={{ color: 'var(--theme-text-secondary)' }} />
              </span>
            )}
            <span className="flex-1 min-w-0 truncate text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
              {downloading ? `${Math.round(downloading.progress * 100)}%…` : current ? `${current.name} · ${current.accent}` : t('voiceBrowserDefault')}
            </span>
            {downloading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: 'var(--theme-text-secondary)' }} />
              : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--theme-text-secondary)' }} />}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={12}
          className="w-72 p-1.5 rounded-2xl shadow-2xl border z-50 max-h-[70vh] overflow-y-auto custom-scrollbar"
          style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)' }}
        >
          {error && (
            <p className="px-3 py-2 text-xs text-red-600">
              {locale === 'pt-BR' ? 'Falha no download. Tente de novo.' : 'Download failed. Try again.'}
            </p>
          )}
          {groups.map((g) => (
            <div key={g.label} className="mb-1">
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-nav-text-muted)' }}>
                {g.label}
              </p>
              {g.voices.map((v) => {
                const downloaded = state.modelReady && state.voices.includes(v.id)
                const selected = current?.id === v.id
                const isDl = downloading?.id === v.id
                return (
                  <button
                    key={v.id}
                    onClick={() => choose(v)}
                    disabled={!!downloading}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-60"
                    style={{ backgroundColor: selected ? 'var(--theme-pastel-2)' : undefined }}
                  >
                    <VoiceAvatar voice={v} size={32} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate" style={{ color: selected ? 'var(--theme-pastel-text)' : 'var(--theme-text)' }}>
                        {v.name}
                      </span>
                      <span className="block text-[11px] truncate" style={{ color: 'var(--theme-text-secondary)' }}>
                        {v.gender === 'female' ? (locale === 'pt-BR' ? 'Feminina' : 'Female') : (locale === 'pt-BR' ? 'Masculina' : 'Male')}
                        {v.basic && (locale === 'pt-BR' ? ' · qualidade básica' : ' · basic quality')}
                        {!downloaded && !isDl && ` · ${t('voiceNotDownloaded')}`}
                      </span>
                    </span>
                    {isDl ? <span className="text-xs tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{Math.round(downloading.progress * 100)}%</span>
                      : selected ? <Check className="w-4 h-4" style={{ color: 'var(--theme-pastel-text)' }} />
                      : !downloaded ? <Download className="w-4 h-4" style={{ color: 'var(--theme-text-secondary)' }} /> : null}
                  </button>
                )
              })}
            </div>
          ))}
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 mt-1 text-xs font-medium rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--theme-accent)' }}
          >
            {t('manageVoices')} →
          </Link>
        </PopoverContent>
      </Popover>
    </div>
  )
}
