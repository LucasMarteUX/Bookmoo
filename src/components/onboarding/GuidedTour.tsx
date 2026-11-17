// Tutorial guiado do primeiro acesso: destaca cada área do app e explica passo a passo, com diálogo.
// Aparece uma vez por pessoa (guardado no aparelho) e pode ser revisto em Configurações.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { markTourSeen, tourSeen } from '@/lib/tourSeen'
import { useLanguage } from '@/store/useLanguage'

/** enter/leave: eventos disparados ao entrar e sair do passo (ex.: abrir o painel da tutora). */
export type TourStep = { selector?: string; route?: string; pt: [string, string]; en: [string, string]; enter?: string; leave?: string }
type Step = TourStep

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

export const restartTour = () => window.dispatchEvent(new Event('bookmoo:tour'))

/** Elemento do passo, só se estiver de fato visível na tela (não escondido, fora da tela ou coberto por outro). */
export function targetRect(selector?: string) {
  if (!selector) return null
  const vw = window.innerWidth, vh = window.innerHeight
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    let r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) { el.scrollIntoView({ block: 'center', inline: 'nearest' }); r = el.getBoundingClientRect() }
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue
    const cx = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1), cy = Math.min(Math.max(r.top + r.height / 2, 1), vh - 1)
    const hit = document.elementsFromPoint(cx, cy).find(n => !n.closest('[data-tour-root]'))
    if (hit && !el.contains(hit) && !hit.contains(el)) continue
    return r
  }
  return null
}

/** Navegação comum dos tutoriais: mede o alvo e pula passos cujo elemento não aparece nesta tela (ex.: celular). */
export function useTourRect(steps: TourStep[], step: number | null, setStep: (n: number) => void, dir: React.MutableRefObject<1 | -1>) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const measure = useCallback(() => {
    if (step === null) return
    const s = steps[step]
    const r = targetRect(s.selector)
    if (s.selector && !r) {
      const next = step + dir.current
      if (next >= 0 && next < steps.length) { setStep(next); return }
      if (dir.current === -1 && step + 1 < steps.length) { dir.current = 1; setStep(step + 1); return }
    }
    setRect(r)
  }, [step, steps, setStep, dir])
  useLayoutEffect(() => { measure() }, [measure])
  useEffect(() => {
    if (step === null) return
    let raf = 0
    const again = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setRect(targetRect(steps[step].selector))) }
    window.addEventListener('resize', again); window.addEventListener('scroll', again, true)
    // Painéis que abrem com animação: mede de novo quando terminam de abrir.
    const late = window.setTimeout(again, 480)
    return () => { cancelAnimationFrame(raf); window.clearTimeout(late); window.removeEventListener('resize', again); window.removeEventListener('scroll', again, true) }
  }, [step, steps])
  return rect
}

/** Balão do tutorial com recorte no elemento destacado. Usado pelo tutorial do app e pelo do livro. */
export function TourOverlay({ steps, step, rect, pt, onStep, onClose, doneLabel }: {
  steps: TourStep[]; step: number; rect: DOMRect | null; pt: boolean
  onStep: (n: number) => void; onClose: () => void; doneLabel?: string
}) {
  const s = steps[step]
  const [title, body] = pt ? s.pt : s.en
  const last = step === steps.length - 1
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)

  // Posiciona pelo tamanho real do balão: nunca cobre o alvo e nunca sai da tela.
  useLayoutEffect(() => {
    const vw = window.innerWidth, vh = window.innerHeight, M = 12, GAP = 14
    const mobile = vw < 640
    const width = mobile ? vw - 2 * M : Math.min(360, vw - 2 * M)
    const h = cardRef.current?.offsetHeight ?? 240
    let left = (vw - width) / 2, top = (vh - h) / 2
    if (rect) {
      const below = rect.bottom + GAP, above = rect.top - GAP - h
      if (mobile) {
        // Celular: o balão vira uma folha no lado oposto ao alvo (topo ou base da tela).
        top = rect.top + rect.height / 2 > vh / 2 ? M + 4 : vh - h - M - 4
      } else if (below + h <= vh - M) {
        top = below; left = rect.left + rect.width / 2 - width / 2
      } else if (above >= M) {
        top = above; left = rect.left + rect.width / 2 - width / 2
      } else if (rect.right + GAP + width <= vw - M) {
        left = rect.right + GAP; top = rect.top + rect.height / 2 - h / 2
      } else if (rect.left - GAP - width >= M) {
        left = rect.left - GAP - width; top = rect.top + rect.height / 2 - h / 2
      }
      left = Math.min(Math.max(M, left), vw - width - M)
      top = Math.min(Math.max(M, top), vh - h - M)
    }
    setPos({ left, top, width })
  }, [rect, step])

  const vw = typeof window === 'undefined' ? 0 : window.innerWidth, vh = typeof window === 'undefined' ? 0 : window.innerHeight
  const hole = rect && { x: Math.max(4, rect.left - 6), y: Math.max(4, rect.top - 6), w: 0, h: 0 }
  if (hole && rect) { hole.w = Math.min(vw - 4, rect.right + 6) - hole.x; hole.h = Math.min(vh - 4, rect.bottom + 6) - hole.y }

  return createPortal(
    <div data-tour-root className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Tutorial">
      <svg className="absolute inset-0 h-full w-full" onClick={onClose} aria-hidden>
        <defs><mask id="tour-hole"><rect width="100%" height="100%" fill="white" />{hole && <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx="12" fill="black" />}</mask></defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.62)" mask="url(#tour-hole)" />
        {hole && <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx="12" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" />}
      </svg>
      <div ref={cardRef} className="absolute rounded-2xl border p-5 shadow-2xl transition-[left,top] duration-200"
        style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, width: pos?.width ?? 360, visibility: pos ? 'visible' : 'hidden', backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}>
        <button type="button" onClick={onClose} aria-label={pt ? 'Fechar tutorial' : 'Close tutorial'} className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-text-secondary)' }}><X className="w-4 h-4" /></button>
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Passo' : 'Step'} {step + 1} {pt ? 'de' : 'of'} {steps.length}</p>
        <div className="mt-2 mr-8 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-border)' }} aria-hidden>
          <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%`, backgroundColor: 'var(--theme-text)' }} />
        </div>
        <h2 className="mt-3 pr-6 font-display text-[21px] leading-tight">{title}</h2>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>{body}</p>
        <div className="mt-5 flex items-center justify-between gap-2">
          {!last
            ? <button type="button" onClick={onClose} className="h-9 -ml-1 px-1 text-[13px] underline-offset-2 hover:underline shrink-0" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Pular' : 'Skip'}</button>
            : <span />}
          <div className="flex items-center gap-2 min-w-0">
            {step > 0 && <button type="button" onClick={() => onStep(step - 1)} aria-label={pt ? 'Voltar' : 'Back'} className="h-9 px-3 inline-flex items-center gap-1 rounded-full border text-[13px] shrink-0" style={{ borderColor: 'var(--theme-border)' }}><ArrowLeft className="w-3.5 h-3.5" /><span className="max-[360px]:hidden">{pt ? 'Voltar' : 'Back'}</span></button>}
            <button type="button" onClick={() => (last ? onClose() : onStep(step + 1))} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium shrink-0" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
              {last ? (doneLabel ?? (pt ? 'Começar' : 'Start')) : (pt ? 'Próximo' : 'Next')}{!last && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function GuidedTour() {
  const pt = useLanguage(s => s.locale) === 'pt-BR'
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState<number | null>(null)
  const dir = useRef<1 | -1>(1)
  const go = useCallback((n: number) => { setStep(cur => { dir.current = cur !== null && n < cur ? -1 : 1; return n }) }, [])
  const rect = useTourRect(STEPS, step, go, dir)

  // Primeira visita: abre sozinho na Home.
  useEffect(() => {
    if (!user?.id || location.pathname !== '/') return
    if (tourSeen('welcome', user)) return
    const t = window.setTimeout(() => { markTourSeen('welcome', user); setStep(0) }, 1200)
    return () => window.clearTimeout(t)
  }, [user?.id, location.pathname])
  useEffect(() => {
    const open = () => { if (location.pathname !== '/') navigate('/'); dir.current = 1; setStep(0) }
    window.addEventListener('bookmoo:tour', open)
    return () => window.removeEventListener('bookmoo:tour', open)
  }, [location.pathname, navigate])

  const close = useCallback(() => {
    markTourSeen('welcome', user)
    setStep(null)
  }, [user])

  useEffect(() => {
    if (step === null) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') go(Math.min(STEPS.length - 1, step + 1))
      else if (e.key === 'ArrowLeft') go(Math.max(0, step - 1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [step, go, close])

  if (step === null) return null
  return <TourOverlay steps={STEPS} step={step} rect={rect} pt={pt} onStep={go} onClose={close} />
}
