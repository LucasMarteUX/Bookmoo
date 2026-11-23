// Topo do livro no celular: uma barra fina (voltar, título e página, Aa, ⋯) que some com um toque no texto, e o menu ⋯
// numa folha que sobe de baixo, ao alcance do polegar. Tudo o que antes ocupava três faixas no topo mora na folha:
// Texto/Ilustrado e as ferramentas da página (vêm do Reader, por portal), ajustes do livro e as outras atividades.
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ALargeSmall, BookOpen, ChevronLeft, ChevronRight, Mic, MoreHorizontal, Palette, PenLine, Rows3, X } from 'lucide-react'
import { haptics } from '@/lib/haptics'
import { useReaderChrome } from '@/store/useReaderChrome'

type Mode = 'read' | 'edit' | 'listen' | 'speak'

export interface MobileBookChromeProps {
  title: string
  page: number
  total: number
  mode: Mode
  pt: boolean
  styleThumb?: ReactNode
  voiceFace?: ReactNode
  onBack: () => void
  onMode: (mode: Mode) => void
  onStyle: () => void
  onVoices: () => void
  onPageSize: () => void
  onTutor?: () => void
  tutorFace?: ReactNode
  /** Recebe o elemento onde o Reader coloca Texto/Ilustrado e as ferramentas da página. */
  slotRef: (el: HTMLDivElement | null) => void
}

function Row({ icon, label, hint, onClick, end }: { icon: ReactNode; label: string; hint?: string; onClick: () => void; end?: ReactNode }) {
  return (
    <button type="button" onClick={() => { haptics.selection(); onClick() }}
      className="pressable w-full min-h-[52px] px-4 flex items-center gap-3 text-left">
      <span className="w-9 h-9 shrink-0 grid place-items-center rounded-xl" style={{ backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text)' }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-tight" style={{ color: 'var(--theme-text)' }}>{label}</span>
        {hint && <span className="block text-[12.5px] leading-snug mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>{hint}</span>}
      </span>
      {end ?? <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--theme-text-secondary)' }} />}
    </button>
  )
}

export function MobileBookChrome(p: MobileBookChromeProps) {
  const sheet = useReaderChrome(s => s.sheet)
  const setSheet = useReaderChrome(s => s.setSheet)
  const reduce = useReducedMotion()
  const moreOpen = sheet === 'more'
  const reading = p.mode === 'read' || p.mode === 'listen'
  const close = () => setSheet(null)

  // Fecha a folha ao sair do livro; Esc fecha no teclado.
  useEffect(() => () => useReaderChrome.getState().setSheet(null), [])
  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moreOpen])

  const btn = 'pressable w-10 h-10 grid place-items-center rounded-full shrink-0'
  const activity = (m: Mode) => { close(); p.onMode(m) }

  return (
    <>
      <header data-chrome="top" className="ios-bar fixed top-0 inset-x-0 z-40 border-b"
        style={{ paddingTop: 'var(--safe-t, 0px)', paddingLeft: 'var(--safe-l, 0px)', paddingRight: 'var(--safe-r, 0px)', borderColor: 'var(--theme-border)' }}>
        <div className="h-11 px-1 flex items-center gap-0.5">
          <button type="button" className={btn} onClick={() => { haptics.selection(); if (reading) p.onBack(); else p.onMode('read') }}
            aria-label={reading ? (p.pt ? 'Voltar' : 'Back') : (p.pt ? 'Voltar para a leitura' : 'Back to reading')} style={{ color: 'var(--theme-text)' }}>
            <ChevronLeft className="w-6 h-6" strokeWidth={2} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[14px] font-semibold leading-tight truncate" style={{ color: 'var(--theme-text)' }}>{p.title}</p>
            <p className="text-[11px] leading-tight tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>
              {reading
                ? (p.pt ? `Página ${p.page + 1} de ${p.total}` : `Page ${p.page + 1} of ${p.total}`)
                : p.mode === 'edit' ? (p.pt ? 'Escrever' : 'Write') : (p.pt ? 'Falar' : 'Speak')}
            </p>
          </div>
          {reading ? (
            <button type="button" className={btn} onClick={() => { haptics.selection(); setSheet('appearance') }}
              aria-label={p.pt ? 'Aparência do texto' : 'Text appearance'} style={{ color: 'var(--theme-text)' }}>
              <ALargeSmall className="w-5 h-5" />
            </button>
          ) : <span className="w-10" aria-hidden />}
          <button type="button" className={btn} onClick={() => { haptics.selection(); setSheet(moreOpen ? null : 'more') }}
            aria-label={p.pt ? 'Mais opções do livro' : 'More book options'} aria-haspopup="dialog" aria-expanded={moreOpen} style={{ color: 'var(--theme-text)' }}>
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </header>

      {typeof document !== 'undefined' && createPortal(
        <>
          <AnimatePresence>
            {moreOpen && (
              <motion.div key="scrim" className="fixed inset-0 z-[70]" style={{ backgroundColor: 'rgba(0,0,0,0.32)' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={close} aria-hidden />
            )}
          </AnimatePresence>
          {/* Sempre montada (só sai da tela): o Reader coloca as ferramentas da página aqui dentro, por portal. */}
          <motion.div role="dialog" aria-modal={moreOpen} aria-label={p.pt ? 'Opções do livro' : 'Book options'} aria-hidden={!moreOpen}
            className="fixed inset-x-0 bottom-0 z-[71] rounded-t-[28px] border-t flex flex-col max-h-[86dvh]"
            style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', paddingBottom: 'calc(var(--safe-b, 0px) + 0.75rem)', visibility: moreOpen ? 'visible' : 'hidden', pointerEvents: moreOpen ? 'auto' : 'none', boxShadow: '0 -20px 50px -20px rgba(0,0,0,0.35)' }}
            initial={false} animate={{ y: moreOpen ? 0 : '105%' }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 40 }}>
            {/* Puxar a alça para baixo fecha (só a alça arrasta: a lista continua rolando normalmente). */}
            <motion.div className="pt-2.5 pb-1 grid place-items-center touch-none cursor-grab" aria-hidden
              drag={reduce ? false : 'y'} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.4 }} dragSnapToOrigin
              onDragEnd={(_, info) => { if (info.offset.y > 40 || info.velocity.y > 400) close() }}>
              <span className="w-10 h-1.5 rounded-full" style={{ backgroundColor: 'var(--theme-border)' }} />
            </motion.div>
            <div className="flex items-center justify-between px-4 pb-2">
              <p className="text-[17px] font-semibold" style={{ color: 'var(--theme-text)' }}>{p.pt ? 'Opções' : 'Options'}</p>
              <button type="button" onClick={close} className={btn} aria-label={p.pt ? 'Fechar' : 'Close'} style={{ color: 'var(--theme-text-secondary)' }}><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto overscroll-contain pb-2">
              {reading && (
                <section className="px-4 pb-3">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{p.pt ? 'Esta página' : 'This page'}</p>
                  <div ref={p.slotRef} className="mobile-book-tools flex flex-wrap items-center gap-1 rounded-2xl p-1.5" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
                </section>
              )}
              <section className="pb-2">
                <p className="px-4 text-[12px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--theme-text-secondary)' }}>{p.pt ? 'Atividade' : 'Activity'}</p>
                {!reading && <Row icon={<BookOpen className="w-[18px] h-[18px]" />} label={p.pt ? 'Ler' : 'Read'} hint={p.pt ? 'Voltar para a leitura' : 'Back to reading'} onClick={() => activity('read')} />}
                <Row icon={<PenLine className="w-[18px] h-[18px]" />} label={p.pt ? 'Escrever' : 'Write'} hint={p.pt ? 'Ditado: ouça a página e digite' : 'Dictation: hear the page and type'} onClick={() => activity('edit')} />
                <Row icon={<Mic className="w-[18px] h-[18px]" />} label={p.pt ? 'Falar' : 'Speak'} hint={p.pt ? 'Leia em voz alta e veja sua pronúncia' : 'Read aloud and check your pronunciation'} onClick={() => activity('speak')} />
                {p.onTutor && <Row icon={p.tutorFace ?? <Mic className="w-[18px] h-[18px]" />} label={p.pt ? 'Conversar com o tutor' : 'Talk with the tutor'} hint={p.pt ? 'Tire dúvidas sobre esta página' : 'Ask about this page'} onClick={() => { close(); p.onTutor?.() }} />}
              </section>
              <section className="pb-1">
                <p className="px-4 text-[12px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--theme-text-secondary)' }}>{p.pt ? 'Livro' : 'Book'}</p>
                <Row icon={p.styleThumb ?? <Palette className="w-[18px] h-[18px]" />} label={p.pt ? 'Estilo das ilustrações' : 'Illustration style'} onClick={() => { close(); p.onStyle() }} />
                <Row icon={p.voiceFace ?? <Mic className="w-[18px] h-[18px]" />} label={p.pt ? 'Vozes da leitura' : 'Reading voices'} onClick={() => { close(); p.onVoices() }} />
                <Row icon={<Rows3 className="w-[18px] h-[18px]" />} label={p.pt ? 'Tamanho da página' : 'Page length'} onClick={() => { close(); p.onPageSize() }} />
              </section>
            </div>
          </motion.div>
        </>,
        document.body,
      )}
    </>
  )
}
