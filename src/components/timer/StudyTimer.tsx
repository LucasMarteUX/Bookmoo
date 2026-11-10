import { useStudyTimer, PRESET_SECONDS } from '@/hooks/useStudyTimer'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { Pause, Play, Square, Timer } from 'lucide-react'

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/** Sessão de estudo (cronômetro) em uma linha: tempo, iniciar/pausar, parar e duração. */
export function StudyTimer() {
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const { isRunning, selectedDuration, setSelectedDuration, start, pause, stop, displaySeconds } = useStudyTimer()

  const presetOptions = [
    { value: PRESET_SECONDS['10min'], label: t('preset10min') },
    { value: PRESET_SECONDS['20min'], label: t('preset20min') },
    { value: PRESET_SECONDS['30min'], label: t('preset30min') },
    { value: PRESET_SECONDS['1h'], label: t('preset1h') },
    { value: PRESET_SECONDS['2h'], label: t('preset2h') },
    { value: null, label: t('presetUnlimited') },
  ]
  const iconBtn = 'w-7 h-7 grid place-items-center rounded-md transition-colors hover:bg-[var(--theme-nav-active)]'

  return (
    <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
      <div className="flex items-center gap-2">
        <span className={`grid place-items-center w-7 h-7 rounded-md ${isRunning ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: isRunning ? 'color-mix(in srgb, var(--theme-accent) 14%, transparent)' : 'var(--theme-bg-secondary)', color: isRunning ? 'var(--theme-accent)' : 'var(--theme-nav-text-muted)' }}>
          <Timer className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[11.5px]" style={{ color: 'var(--theme-nav-text-muted)' }}>{t('readingTime')}</p>
          <p className="text-[14px] font-semibold tabular-nums" style={{ color: 'var(--theme-text)' }}>{formatTime(displaySeconds)}</p>
        </div>
        <button type="button" onClick={isRunning ? pause : start} className={iconBtn}
          style={{ color: 'var(--theme-text)' }} title={isRunning ? t('pause') : t('listen')} aria-label={isRunning ? t('pause') : t('listen')}>
          {isRunning ? <Pause className="w-3.5 h-3.5" fill="currentColor" /> : <Play className="w-3.5 h-3.5" fill="currentColor" />}
        </button>
        <button type="button" onClick={stop} className={iconBtn} style={{ color: 'var(--theme-nav-text-muted)' }} title={t('stop')} aria-label={t('stop')}>
          <Square className="w-3 h-3" fill="currentColor" />
        </button>
      </div>
      <select value={selectedDuration ?? 'unlimited'} aria-label={t('duration')}
        onChange={(e) => { const v = e.target.value; setSelectedDuration(v === 'unlimited' ? null : Number(v)) }}
        className="mt-2 w-full h-7 text-[12px] rounded-md px-2 cursor-pointer focus:outline-none"
        style={{ backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-secondary)' }}>
        {presetOptions.map((opt) => (
          <option key={opt.value ?? 'unlimited'} value={opt.value ?? 'unlimited'}>{t('duration')}: {opt.label}</option>
        ))}
      </select>
    </div>
  )
}
