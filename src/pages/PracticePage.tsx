// Páginas próprias de Falar e Ditado: nota por página, evolução e as palavras que o aluno
// falou/digitou certo, quase, errado ou pulou — com filtro por livro.
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, AudioLines, PenLine } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { useBookStore } from '@/store/useBookStore'
import { Button } from '@/components/ui/button'
import { PracticeStats } from '@/components/stats/PracticeStats'
import { SegmentedTabs } from '@/components/ui/filter-controls'

export function PracticePage() {
  const { kind } = useParams<{ kind: string }>()
  const { locale } = useLanguage()
  const navigate = useNavigate()
  const pt = locale === 'pt-BR'
  if (kind !== 'speak' && kind !== 'write') return <Navigate to="/practice/speak" replace />
  const speak = kind === 'speak'
  const books = useBookStore.getState().books
  const lastBook = [...books].sort((a, b) => +new Date(b.lastRead) - +new Date(a.lastRead))[0]
  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
      <header className="space-y-3">
        <h1 className="font-display text-[30px] md:text-[40px] leading-[1.05]" style={{ color: 'var(--theme-text)' }}>{pt ? 'Praticar' : 'Practice'}</h1>
        <SegmentedTabs className="sm:w-80" stretch label={pt ? 'Prática' : 'Practice'} value={speak ? 'speak' : 'write'} onChange={v => navigate(`/practice/${v}`)}
          options={[{ id: 'speak', label: pt ? 'Falar' : 'Speak', icon: <AudioLines className="w-3.5 h-3.5" /> }, { id: 'write', label: pt ? 'Ditado' : 'Dictation', icon: <PenLine className="w-3.5 h-3.5" /> }]} />
      </header>
      <section className="practice-card relative overflow-hidden rounded-2xl p-5 md:p-8 min-h-[170px] md:min-h-[190px]" style={{ ['--card-bg' as string]: speak ? 'var(--pastel-blue-bg)' : 'var(--pastel-lavender-bg)' }}>
        <div className="relative z-10 max-w-[60%]">
          <h2 className="font-display text-[24px] md:text-[34px] leading-[1.05]" style={{ color: 'var(--theme-text)' }}>
            {speak ? (pt ? 'Falar' : 'Speak') : (pt ? 'Ditado' : 'Dictation')}
          </h2>
          <p className="mt-2 text-[13.5px] md:text-[14.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
            {speak
              ? (pt ? 'Leia em voz alta e veja, palavra por palavra, o que você falou certo, quase, errado ou pulou.' : 'Read aloud and see, word by word, what you said right, close, wrong or skipped.')
              : (pt ? 'Ouça cada palavra e digite. Acompanhe suas notas por página e as palavras que mais escapam.' : 'Listen to each word and type it. Track your scores per page and the words that slip away.')}
          </p>
          {lastBook && (
            <Button className="mt-5" onClick={() => navigate(`/book/${lastBook.id}`)}>
              {pt ? `Praticar com ${lastBook.title.length > 22 ? lastBook.title.slice(0, 22) + '…' : lastBook.title}` : `Practice with ${lastBook.title.length > 22 ? lastBook.title.slice(0, 22) + '…' : lastBook.title}`}
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
        <img src={speak ? '/illustrations/public-speaking.svg' : '/illustrations/work.svg'} alt="" className="illo absolute right-2 md:right-8 bottom-0 h-[92%] max-w-[42%] object-contain object-bottom" />
      </section>
      <PracticeStats pt={pt} fixedKind={speak ? 'speak' : 'write'} />
    </div>
  )
}
