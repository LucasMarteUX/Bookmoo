// Páginas próprias de Falar e Ditado: nota por página, evolução e as palavras que o aluno
// falou/digitou certo, quase, errado ou pulou — com filtro por livro.
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Keyboard, Mic } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { PracticeStats } from '@/components/stats/PracticeStats'
import { ToolButton, ToolGroup } from '@/components/ui/toolbar'

export function PracticePage() {
  const { kind } = useParams<{ kind: string }>()
  const { locale } = useLanguage()
  const navigate = useNavigate()
  const pt = locale === 'pt-BR'
  if (kind !== 'speak' && kind !== 'write') return <Navigate to="/practice/speak" replace />
  const speak = kind === 'speak'
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--theme-text)' }}>
            {speak ? (pt ? 'Falar' : 'Speak') : (pt ? 'Ditado' : 'Dictation')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--theme-text-secondary)' }}>
            {speak
              ? (pt ? 'Suas leituras em voz alta: notas por página e as palavras que você falou certo, quase, errado ou não falou.' : 'Your read-aloud sessions: scores per page and the words you said right, close, wrong or skipped.')
              : (pt ? 'Seus ditados: notas por página e as palavras que você digitou certo, quase, errado ou pulou.' : 'Your dictations: scores per page and the words you typed right, close, wrong or skipped.')}
          </p>
        </div>
        <ToolGroup label={pt ? 'Prática' : 'Practice'}>
          <ToolButton icon={<Mic className="w-4 h-4" />} label={pt ? 'Falar' : 'Speak'} active={speak} onClick={() => navigate('/practice/speak')} />
          <ToolButton icon={<Keyboard className="w-4 h-4" />} label={pt ? 'Ditado' : 'Dictation'} active={!speak} onClick={() => navigate('/practice/write')} />
        </ToolGroup>
      </div>
      <PracticeStats pt={pt} fixedKind={speak ? 'speak' : 'write'} />
    </div>
  )
}
