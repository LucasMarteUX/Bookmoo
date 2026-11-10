// Páginas próprias de Falar e Ditado: nota por página, evolução e as palavras que o aluno
// falou/digitou certo, quase, errado ou pulou — com filtro por livro.
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, AudioLines, PenLine } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { useBookStore } from '@/store/useBookStore'
import { Button } from '@/components/ui/button'
import { PracticeStats } from '@/components/stats/PracticeStats'
import { ToolButton, ToolGroup } from '@/components/ui/toolbar'

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
    <div className="max-w-6xl mx-auto space-y-8">
      <ToolGroup label={pt ? 'Prática' : 'Practice'} className="w-fit">
        <ToolButton icon={<AudioLines className="w-4 h-4" />} label={pt ? 'Falar' : 'Speak'} active={speak} onClick={() => navigate('/practice/speak')} />
        <ToolButton icon={<PenLine className="w-4 h-4" />} label={pt ? 'Ditado' : 'Dictation'} active={!speak} onClick={() => navigate('/practice/write')} />
      </ToolGroup>
      <section className="practice-card relative overflow-hidden rounded-2xl p-6 md:p-8 min-h-[190px]" style={{ ['--card-bg' as string]: speak ? 'var(--pastel-blue-bg)' : 'var(--pastel-lavender-bg)' }}>
        <div className="relative z-10 max-w-[60%]">
          <h1 className="font-display text-[34px] md:text-[42px] leading-[1.05]" style={{ color: 'var(--theme-text)' }}>
            {speak ? (pt ? 'Falar' : 'Speak') : (pt ? 'Ditado' : 'Dictation')}
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
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
