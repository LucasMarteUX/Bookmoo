import { useStudyStore } from '@/store/useStudyStore'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { Card } from '@/components/ui/card'
import { Clock, BookMarked, CheckCircle, AlertCircle, Star } from 'lucide-react'

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function Stats() {
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const { totalStudyTime, dailyStudyTime } = useStudyStore()
  const { vocabularies } = useVocabularyStore()

  const learnedCount = vocabularies.filter(v => v.status === 'learned').length
  const reviewCount = vocabularies.filter(v => v.status === 'review').length
  const importantCount = vocabularies.filter(v => v.status === 'important').length

  // Get last 7 days for chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d.toISOString().split('T')[0]
  }).reverse()

  const maxDailyTime = Math.max(...last7Days.map(date => dailyStudyTime[date] || 0), 1)

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold" style={{ color: 'var(--theme-text)' }}>{t('statsTitle')}</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 border transition-colors" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-sm mb-1" style={{ color: 'var(--theme-nav-text-muted)' }}>{t('totalStudyTimeLabel')}</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>{formatTime(totalStudyTime)}</div>
        </Card>

        <Card className="p-5 border transition-colors" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-accent) 15%, transparent)' }}>
              <BookMarked className="w-5 h-5" style={{ color: 'var(--theme-accent)' }} />
            </div>
          </div>
          <div className="text-sm mb-1" style={{ color: 'var(--theme-nav-text-muted)' }}>{t('totalVocabularyLabel')}</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>{vocabularies.length}</div>
        </Card>

        <Card className="p-5 border transition-colors" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-sm mb-1" style={{ color: 'var(--theme-nav-text-muted)' }}>{t('learnedCount')}</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>{learnedCount}</div>
        </Card>

        <Card className="p-5 border transition-colors" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="text-sm mb-1" style={{ color: 'var(--theme-nav-text-muted)' }}>{t('toReview')}</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>{reviewCount}</div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6 border transition-colors" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
          <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--theme-text)' }}>{t('activityLast7Days')}</h3>
          <div className="h-48 flex items-end gap-2">
            {last7Days.map(date => {
              const seconds = dailyStudyTime[date] || 0
              const heightPercentage = (seconds / maxDailyTime) * 100
              const dayName = new Date(date).toLocaleDateString(locale === 'pt-BR' ? 'pt-BR' : 'en-US', { weekday: 'short' })
              
              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full rounded-t-md relative h-full flex items-end transition-colors" style={{ backgroundColor: 'var(--theme-bg)' }}>
                    <div 
                      className="w-full rounded-t-md transition-all duration-500"
                      style={{ height: `${Math.max(heightPercentage, 2)}%`, backgroundColor: 'var(--theme-primary)' }}
                    />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                      {formatTime(seconds)}
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--theme-nav-text-muted)' }}>{dayName}</span>
                </div>
              )
            })}
          </div>
        </Card>

        <Card className="p-6 border transition-colors" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
          <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--theme-text)' }}>{t('vocabularyStatus')}</h3>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium" style={{ color: 'var(--theme-nav-text-muted)' }}>{t('learnedCount')}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: 'var(--theme-text)' }}>{learnedCount}</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden transition-colors" style={{ backgroundColor: 'var(--theme-bg)' }}>
                <div 
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${vocabularies.length ? (learnedCount / vocabularies.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium" style={{ color: 'var(--theme-nav-text-muted)' }}>{t('review')}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: 'var(--theme-text)' }}>{reviewCount}</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden transition-colors" style={{ backgroundColor: 'var(--theme-bg)' }}>
                <div 
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${vocabularies.length ? (reviewCount / vocabularies.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium" style={{ color: 'var(--theme-nav-text-muted)' }}>{t('importantLabel')}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: 'var(--theme-text)' }}>{importantCount}</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden transition-colors" style={{ backgroundColor: 'var(--theme-bg)' }}>
                <div 
                  className="h-full bg-red-500 transition-all duration-500"
                  style={{ width: `${vocabularies.length ? (importantCount / vocabularies.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
