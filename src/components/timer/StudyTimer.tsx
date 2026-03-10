import { useStudyTimer, PRESET_SECONDS } from '@/hooks/useStudyTimer'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { Play, Pause, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function StudyTimer() {
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const {
    isRunning,
    selectedDuration,
    setSelectedDuration,
    start,
    pause,
    stop,
    displaySeconds
  } = useStudyTimer()

  const presetOptions = [
    { value: PRESET_SECONDS['10min'], label: t('preset10min') },
    { value: PRESET_SECONDS['20min'], label: t('preset20min') },
    { value: PRESET_SECONDS['30min'], label: t('preset30min') },
    { value: PRESET_SECONDS['1h'], label: t('preset1h') },
    { value: PRESET_SECONDS['2h'], label: t('preset2h') },
    { value: null, label: t('presetUnlimited') }
  ]

  return (
    <div
      className="flex flex-col gap-3"
      style={{ color: 'var(--theme-nav-text)' }}
    >
      <span
        className="text-[10px] leading-none font-bold uppercase tracking-tighter"
        style={{ color: 'var(--theme-nav-text-muted)' }}
      >
        {t('readingTime')}
      </span>

      <div className="flex flex-col gap-2">
        <div
          className="flex items-center justify-between gap-2 rounded-xl border py-2.5 px-3 transition-colors"
          style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)' }}
        >
          <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--theme-text)' }}>
            {formatTime(displaySeconds)}
          </span>
          <div className="flex items-center gap-1">
            {!isRunning ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={start}
                className="w-8 h-8 p-0 rounded-full transition-colors hover:bg-[var(--theme-nav-hover)]"
                style={{ color: 'var(--theme-accent)' }}
                title={t('listen')}
                aria-label={t('listen')}
              >
                <Play className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={pause}
                className="w-8 h-8 p-0 rounded-full transition-colors hover:bg-[var(--theme-nav-hover)]"
                style={{ color: 'var(--theme-accent)' }}
                title={t('pause')}
                aria-label={t('pause')}
              >
                <Pause className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={stop}
              className="w-8 h-8 p-0 rounded-full transition-colors hover:bg-[var(--theme-nav-hover)]"
              style={{ color: 'var(--theme-nav-text-muted)' }}
              title={t('stop')}
              aria-label={t('stop')}
            >
              <Square className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium uppercase tracking-tighter" style={{ color: 'var(--theme-nav-text-muted)' }}>
            {t('duration')}
          </label>
          <select
            value={selectedDuration ?? 'unlimited'}
            onChange={(e) => {
              const v = e.target.value
              setSelectedDuration(v === 'unlimited' ? null : Number(v))
            }}
            className="w-full text-xs rounded-lg border py-2 px-3 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-0"
            style={{
              backgroundColor: 'var(--theme-bg-secondary)',
              borderColor: 'var(--theme-border-subtle)',
              color: 'var(--theme-text)'
            }}
          >
            {presetOptions.map((opt) => (
              <option key={opt.value ?? 'unlimited'} value={opt.value ?? 'unlimited'}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
