import { useStudyStore } from '@/store/useStudyStore'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { PracticeStats } from '@/components/stats/PracticeStats'
import { ActivityPanel } from '@/components/stats/ActivityPanel'
import { BookMarked, Check, Clock, RotateCcw, Star } from 'lucide-react'

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function Stats() {
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const pt = locale === 'pt-BR'
  const { totalStudyTime, dailyStudyTime } = useStudyStore()
  const { vocabularies } = useVocabularyStore()

  const learnedCount = vocabularies.filter(v => v.status === 'learned').length
  const reviewCount = vocabularies.filter(v => v.status === 'review').length
  const importantCount = vocabularies.filter(v => v.status === 'important').length
  const total = Math.max(1, vocabularies.length)

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d.toISOString().split('T')[0]
  }).reverse()
  const maxDailyTime = Math.max(...last7Days.map(date => dailyStudyTime[date] || 0), 1)
  const weekTotal = last7Days.reduce((sum, d) => sum + (dailyStudyTime[d] || 0), 0)

  const tiles = [
    { icon: Clock, label: t('totalStudyTimeLabel'), value: formatTime(totalStudyTime) },
    { icon: BookMarked, label: t('totalVocabularyLabel'), value: String(vocabularies.length) },
    { icon: Check, label: t('learnedCount'), value: String(learnedCount) },
    { icon: RotateCcw, label: t('toReview'), value: String(reviewCount) },
  ]
  const segments = [
    { label: t('learnedCount'), count: learnedCount, color: 'var(--pastel-green-bd)', icon: Check },
    { label: t('review'), count: reviewCount, color: 'var(--pastel-amber-bd)', icon: RotateCcw },
    { label: t('importantLabel'), count: importantCount, color: 'var(--pastel-lavender-bd)', icon: Star },
  ]
  const card = 'rounded-2xl border p-5 md:p-6'
  const cardStyle = { borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header>
        <h1 className="font-display text-[34px] md:text-[40px] leading-[1.05]" style={{ color: 'var(--theme-text)' }}>{t('statsTitle')}</h1>
        <p className="mt-2 text-[14.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Seu ritmo de estudo, palavras e prática — tudo num só lugar.' : 'Your study rhythm, words and practice — all in one place.'}
        </p>
      </header>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl border px-5 py-4" style={cardStyle}>
            <p className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}><Icon className="w-3.5 h-3.5" />{label}</p>
            <p className="mt-1.5 text-[26px] font-semibold tabular-nums leading-tight" style={{ color: 'var(--theme-text)' }}>{value}</p>
          </div>
        ))}
      </div>

      <ActivityPanel pt={pt} />

      <div className="grid gap-4 md:grid-cols-2">
        <section className={card} style={cardStyle}>
          <div className="flex items-baseline justify-between mb-6">
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--theme-text)' }}>{t('activityLast7Days')}</h3>
            <span className="text-[13px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{formatTime(weekTotal)}</span>
          </div>
          <div className="h-44 flex items-end gap-2">
            {last7Days.map(date => {
              const seconds = dailyStudyTime[date] || 0
              const pct = (seconds / maxDailyTime) * 100
              const isToday = date === last7Days[6]
              const dayName = new Date(`${date}T12:00:00`).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { weekday: 'short' })
              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full relative h-full flex items-end">
                    <div className="w-full rounded-md transition-all duration-500"
                      style={{ height: `${Math.max(pct, 3)}%`, backgroundColor: seconds ? (isToday ? 'var(--theme-text)' : 'color-mix(in srgb, var(--theme-text) 28%, transparent)') : 'var(--theme-bg-secondary)' }} />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[11.5px] py-1 px-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10"
                      style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                      {formatTime(seconds)}
                    </div>
                  </div>
                  <span className="text-[11.5px] capitalize" style={{ color: isToday ? 'var(--theme-text)' : 'var(--theme-text-secondary)', fontWeight: isToday ? 600 : 400 }}>{dayName.replace('.', '')}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className={card} style={cardStyle}>
          <h3 className="text-[15px] font-semibold mb-6" style={{ color: 'var(--theme-text)' }}>{t('vocabularyStatus')}</h3>
          {/* Barra empilhada: proporção de cada status */}
          <div className="flex h-3 rounded-full overflow-hidden mb-6" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
            {segments.map(s => s.count > 0 && (
              <div key={s.label} style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }} title={`${s.label}: ${s.count}`} />
            ))}
          </div>
          <ul className="space-y-3">
            {segments.map(({ label, count, color, icon: Icon }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg grid place-items-center" style={{ backgroundColor: color, color: 'var(--theme-text)' }}><Icon className="w-3.5 h-3.5" /></span>
                <span className="flex-1 text-[14px]" style={{ color: 'var(--theme-text)' }}>{label}</span>
                <span className="text-[14px] font-semibold tabular-nums" style={{ color: 'var(--theme-text)' }}>{count}</span>
                <span className="w-12 text-right text-[12.5px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{Math.round((count / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <PracticeStats pt={pt} />
    </div>
  )
}
