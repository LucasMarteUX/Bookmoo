// Tutorial guiado do primeiro acesso: destaca cada área do app e explica passo a passo, com diálogo.
// Aparece uma vez por pessoa (guardado no aparelho) e pode ser revisto em Configurações.
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/store/useLanguage'

type Step = { selector?: string; route?: string; pt: [string, string]; en: [string, string] }

const STEPS: Step[] = [
  { route: '/', pt: ['Bem-vindo ao Bookmoo', 'Você aprende inglês lendo livros de verdade. Em poucos passos mostramos onde fica cada coisa. Dá para pular quando quiser.'], en: ['Welcome to Bookmoo', 'You learn English by reading real books. In a few steps we will show where everything is. You can skip anytime.'] },
  { route: '/', selector: '[data-tour="add-book"]', pt: ['Adicione seus livros', 'Envie um EPUB ou PDF com texto, ou cole um texto. Seus livros ficam só com você e nunca são compartilhados. Envie apenas conteúdo seu, em domínio público ou autorizado.'], en: ['Add your books', 'Upload an EPUB or a text PDF, or paste text. Your books stay with you and are never shared. Only upload content that is yours, public domain or authorized.'] },
  { selector: 'a[href="/gallery"]', pt: ['Galeria de livros', 'Livros de domínio público prontos para ler, por nível (A1 a C2) e por categoria. Leve um para a sua estante com um clique.'], en: ['Book gallery', 'Ready-to-read public-domain books by level (A1–C2) and category. Add one to your shelf in one click.'] },
  { selector: 'a[href="/collections"]', pt: ['Coleções', 'Séries e temas reunidos, como Sherlock Holmes, Oz e Jules Verne, em ordem de leitura.'], en: ['Collections', 'Series and themes in reading order, like Sherlock Holmes, Oz and Jules Verne.'] },
  { route: '/', pt: ['Dentro do livro', 'Toque numa palavra para ver o significado, ouvir e marcar como Aprendi, Revisar ou Importante. As marcações valem em todos os seus livros, e o olhinho na barra de ferramentas esconde o que você quiser.'], en: ['Inside a book', 'Tap a word for its meaning and audio, and mark it Learned, Review or Important. Marks follow you across all your books, and the eye in the toolbar hides whatever you want.'] },
  { route: '/', pt: ['Ilustre as páginas', 'Em cada página sem imagem você pode gerar a ilustração. No estilo padrão do livro, a imagem fica para todos os leitores. Se quiser um estilo seu, é só trocar na hora de ler.'], en: ['Illustrate pages', 'Any page without an image can be illustrated. In the book’s default style, the image is shared with every reader. For your own style, switch it while reading.'] },
  { selector: 'a[href="/vocabulary"]', pt: ['Vocabulário', 'Todas as palavras que você marca ficam aqui, com explicações, exemplos e revisão.'], en: ['Vocabulary', 'Every word you mark lives here, with explanations, examples and review.'] },
  { selector: 'a[href="/practice/speak"]', pt: ['Pratique falar e escrever', 'Leia em voz alta e receba retorno da pronúncia, ou faça ditado ouvindo e escrevendo cada palavra.'], en: ['Practice speaking and writing', 'Read aloud and get pronunciation feedback, or do dictation by listening and typing each word.'] },
  { selector: 'a[href="/stats"]', pt: ['Seu progresso', 'Pontos, sequência de dias e tempo de estudo. Seu nível sobe conforme você aprende.'], en: ['Your progress', 'Points, streak and study time. Your level rises as you learn.'] },
  { route: '/', pt: ['Tudo pronto', 'Comece abrindo um livro da galeria. Você pode rever este tutorial em Configurações, a qualquer momento.'], en: ['All set', 'Start by opening a book from the gallery. You can replay this tutorial any time in Settings.'] },
]

const keyFor = (id?: string) => `bookmoo.tour.v1.${id ?? 'anon'}`
export const restartTour = () => window.dispatchEvent(new Event('bookmoo:tour'))

function targetRect(selector?: string) {
  if (!selector) return null
  for (const el of Array.from(document.querySelectorAll(selector))) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) { el.scrollIntoView({ block: 'nearest' }); return el.getBoundingClientRect() }
  }
  return null
}

export function GuidedTour() {
  const pt = useLanguage(s => s.locale) === 'pt-BR'
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  // Primeira visita: abre sozinho na Home.
  useEffect(() => {
    if (!user?.id || location.pathname !== '/') return
    try { if (localStorage.getItem(keyFor(user.id))) return } catch { return }
    const t = window.setTimeout(() => setStep(0), 1200)
    return () => window.clearTimeout(t)
  }, [user?.id, location.pathname])
  useEffect(() => {
    const open = () => { if (location.pathname !== '/') navigate('/'); setStep(0) }
    window.addEventListener('bookmoo:tour', open)
    return () => window.removeEventListener('bookmoo:tour', open)
  }, [location.pathname, navigate])

  const close = useCallback(() => {
    try { localStorage.setItem(keyFor(user?.id), String(Date.now())) } catch { /* sem armazenamento */ }
    setStep(null)
  }, [user?.id])

  const measure = useCallback(() => { if (step !== null) setRect(targetRect(STEPS[step].selector)) }, [step])
  useLayoutEffect(() => { measure() }, [measure])
  useEffect(() => {
    if (step === null) return
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') setStep(s => (s === null ? s : Math.min(STEPS.length - 1, s + 1)))
      else if (e.key === 'ArrowLeft') setStep(s => (s === null ? s : Math.max(0, s - 1)))
    }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); window.removeEventListener('keydown', key) }
  }, [step, measure, close])

  if (step === null) return null
  const s = STEPS[step]
  const [title, body] = pt ? s.pt : s.en
  const last = step === STEPS.length - 1
  const W = 340, M = 12
  const vw = window.innerWidth, vh = window.innerHeight
  let left = (vw - W) / 2, top = vh / 2 - 110
  if (rect) {
    const pad = 6
    const toRight = rect.right + W + 24 < vw && rect.left < vw * 0.5
    left = toRight ? rect.right + 16 : Math.min(Math.max(M, rect.left + rect.width / 2 - W / 2), vw - W - M)
    top = toRight ? Math.min(Math.max(M, rect.top + rect.height / 2 - 90), vh - 230) : (rect.bottom + 16 + 210 < vh ? rect.bottom + 16 : Math.max(M, rect.top - 16 - 200))
    void pad
  }
  return createPortal(
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label={pt ? 'Tutorial' : 'Tutorial'}>
      <svg className="absolute inset-0 h-full w-full" onClick={close} aria-hidden>
        <defs><mask id="tour-hole"><rect width="100%" height="100%" fill="white" />{rect && <rect x={rect.left - 6} y={rect.top - 6} width={rect.width + 12} height={rect.height + 12} rx="10" fill="black" />}</mask></defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#tour-hole)" />
        {rect && <rect x={rect.left - 6} y={rect.top - 6} width={rect.width + 12} height={rect.height + 12} rx="10" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" />}
      </svg>
      <div className="absolute rounded-2xl border p-5 shadow-2xl" style={{ left, top, width: Math.min(W, vw - 2 * M), backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}>
        <button type="button" onClick={close} aria-label={pt ? 'Pular tutorial' : 'Skip tutorial'} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-text-secondary)' }}><X className="w-4 h-4" /></button>
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Passo' : 'Step'} {step + 1}/{STEPS.length}</p>
        <h2 className="mt-1.5 pr-6 font-display text-[22px] leading-tight">{title}</h2>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>{body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex gap-1" aria-hidden>{STEPS.map((_, i) => <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === step ? 16 : 6, backgroundColor: i === step ? 'var(--theme-text)' : 'var(--theme-border)' }} />)}</div>
          <div className="flex items-center gap-2">
            {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="h-9 px-3 inline-flex items-center gap-1 rounded-full border text-[13px]" style={{ borderColor: 'var(--theme-border)' }}><ArrowLeft className="w-3.5 h-3.5" />{pt ? 'Voltar' : 'Back'}</button>}
            <button type="button" onClick={() => (last ? close() : setStep(step + 1))} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
              {last ? (pt ? 'Começar' : 'Start') : (pt ? 'Próximo' : 'Next')}{!last && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        {!last && <button type="button" onClick={close} className="mt-3 text-[12.5px] underline-offset-2 hover:underline" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Pular tutorial' : 'Skip tutorial'}</button>}
      </div>
    </div>,
    document.body,
  )
}
