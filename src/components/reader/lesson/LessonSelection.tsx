// Selecionar (ou tocar) uma palavra em inglês dentro da aula: marcar como no leitor (Aprendi / Revisar / Importante),
// ouvir, pedir uma explicação nova no contexto da página (cobrada) ou levar a dúvida para o chat.
// Desktop: balão junto à palavra. Celular: folha que sobe da base da tela (não briga com o menu nativo de seleção).
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpenText, Check, Loader2, MessageCircleQuestion, RotateCcw, Star, X } from 'lucide-react'
import { grammar } from '@/lib/billingApi'
import { CREDIT_COST } from '@/lib/plans'
import { supabase } from '@/lib/supabase'
import { upsertVocabulary } from '@/lib/supabaseSync'
import { useAuth } from '@/contexts/AuthContext'
import { useVocabularyStore, type VocabStatus } from '@/store/useVocabularyStore'
import { toast } from '@/components/ui/toast'
import { failMessage } from './lessonStore'
import { Cost, Say, muted, useLessonEnv } from './ui'

type Sel = { text: string; context: string; rect: { top: number; bottom: number; left: number; right: number } }

const WORD = /[A-Za-z'’-]/
const cleanTerm = (s: string) => s.replace(/\s+/g, ' ').replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').trim()
const validTerm = (s: string) => s.length > 0 && s.length <= 80 && /^[A-Za-z][A-Za-z'’\- ]*$/.test(s) && s.split(' ').length <= 8

/** A palavra sob o dedo/cursor, como intervalo de texto. */
function wordRangeAt(x: number, y: number): Range | null {
  const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null }
  let node: Node | null = null
  let offset = 0
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y)
    if (p) { node = p.offsetNode; offset = p.offset }
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y)
    if (r) { node = r.startContainer; offset = r.startOffset }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null
  const t = node.textContent ?? ''
  let s = offset, e = offset
  while (s > 0 && WORD.test(t[s - 1])) s--
  while (e < t.length && WORD.test(t[e])) e++
  if (e <= s) return null
  const range = document.createRange()
  range.setStart(node, s); range.setEnd(node, e)
  return range
}

const STATUS: { id: VocabStatus; icon: typeof Check; pt: string; en: string }[] = [
  { id: 'learned', icon: Check, pt: 'Aprendi', en: 'Learned' },
  { id: 'review', icon: RotateCcw, pt: 'Revisar', en: 'Review' },
  { id: 'important', icon: Star, pt: 'Importante', en: 'Important' },
]

export function LessonSelection({ rootRef, scrollRef }: { rootRef: RefObject<HTMLElement | null>; scrollRef: RefObject<HTMLElement | null> }) {
  const env = useLessonEnv()
  const { pt } = env
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const vocabs = useVocabularyStore(s => s.vocabularies)
  const addVocabulary = useVocabularyStore(s => s.addVocabulary)
  const updateVocabulary = useVocabularyStore(s => s.updateVocabulary)
  const [sel, setSel] = useState<Sel | null>(null)
  const [loading, setLoading] = useState(false)
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const box = useRef<HTMLDivElement>(null)
  const pointerDown = useRef(false)

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const fromRange = useCallback((range: Range, raw: string) => {
    const text = cleanTerm(raw)
    if (!validTerm(text)) return false
    const el = (range.commonAncestorContainer.nodeType === Node.TEXT_NODE ? range.commonAncestorContainer.parentElement : range.commonAncestorContainer as HTMLElement)
    const ctxEl = el?.closest('[data-en], p, li') as HTMLElement | null
    const r = range.getBoundingClientRect()
    setSel({ text, context: (ctxEl?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 400), rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right } })
    return true
  }, [])

  // Dentro da aula ou de uma resposta do chat.
  const inside = useCallback((n: Node | null) => {
    if (!n) return false
    if (rootRef.current?.contains(n)) return true
    const el = n.nodeType === Node.TEXT_NODE ? n.parentElement : n as HTMLElement
    return !!el?.closest?.('[data-en-zone]')
  }, [rootRef])

  useEffect(() => {
    let timer = 0
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (box.current?.contains(t)) return
      pointerDown.current = true
      if (sel) setSel(null)
    }
    const onUp = (e: PointerEvent) => {
      pointerDown.current = false
      const t = e.target as HTMLElement
      if (box.current?.contains(t) || t.closest('[data-lesson-ui], button, a, input, textarea')) return
      if (!inside(t)) return
      window.setTimeout(() => {
        const s = window.getSelection()
        if (s && !s.isCollapsed && s.rangeCount && inside(s.anchorNode)) { fromRange(s.getRangeAt(0), s.toString()); return }
        // Toque/clique simples numa frase em inglês: pega a palavra inteira.
        if (!t.closest('[data-en], [data-en-zone]')) return
        const range = wordRangeAt(e.clientX, e.clientY)
        if (!range || !fromRange(range, range.toString())) return
        if (e.pointerType === 'mouse') { s?.removeAllRanges(); s?.addRange(range) }
      }, 10)
    }
    // Seleção com as alças no celular: espera a pessoa terminar de ajustar.
    const onSelChange = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (pointerDown.current) return
        const s = window.getSelection()
        if (s && !s.isCollapsed && s.rangeCount && inside(s.anchorNode)) fromRange(s.getRangeAt(0), s.toString())
      }, 450)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && sel) { e.stopPropagation(); setSel(null) } }
    const root = scrollRef.current
    const onScroll = () => { if (sel && !mobile) setSel(null) }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('pointerup', onUp, true)
    document.addEventListener('selectionchange', onSelChange)
    document.addEventListener('keydown', onKey, true)
    root?.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('pointerup', onUp, true)
      document.removeEventListener('selectionchange', onSelChange)
      document.removeEventListener('keydown', onKey, true)
      root?.removeEventListener('scroll', onScroll)
    }
  }, [sel, mobile, inside, fromRange, scrollRef])

  const key = sel?.text.toLowerCase() ?? ''
  const existing = sel ? vocabs.filter(v => v.text.trim().toLowerCase() === key).sort((a, b) => (a.bookId === env.bookId ? -1 : b.bookId === env.bookId ? 1 : b.createdAt - a.createdAt))[0] : undefined
  const explained = sel ? env.data?.explains[key] : undefined

  const setStatus = (status: VocabStatus) => {
    if (!sel) return
    let saved
    if (existing) { updateVocabulary(existing.id, { status }); saved = { ...existing, status } }
    else {
      const ex = explained
      saved = addVocabulary({
        bookId: env.bookId, text: sel.text, type: sel.text.includes(' ') ? 'phrase' : 'word', status,
        explanation: ex ? [ex.meaning, ex.in_context].filter(Boolean).join(' ') : '', examples: ex ? ex.examples.map(e => e.en) : [],
      })
    }
    if (supabase && userId) upsertVocabulary(supabase, userId, saved).catch(err => console.error('Sync vocab', err))
    toast(pt ? `“${sel.text}” marcada como ${STATUS.find(s => s.id === status)?.pt}` : `“${sel.text}” marked as ${STATUS.find(s => s.id === status)?.en}`, { tone: 'success' })
  }

  const explain = async () => {
    if (!sel || loading) return
    setLoading(true)
    try {
      const r = await grammar.explain(env.bookId, env.page, env.lang, env.level, sel.text, sel.context)
      env.patch(d => ({ ...d, explains: { ...d.explains, [key]: r } }))
    } catch (e) {
      const m = failMessage(e, pt)
      if (m) toast(m, { tone: 'error' })
    } finally { setLoading(false) }
  }

  const askChat = () => {
    if (!sel) return
    env.ask(pt ? `O que significa “${sel.text}” neste trecho e por que foi usado assim? “${sel.context.slice(0, 160)}”` : `What does “${sel.text}” mean here and why is it used this way? “${sel.context.slice(0, 160)}”`)
    setSel(null)
  }

  // Posição do balão no desktop: acima da palavra, ou abaixo se não couber.
  const W = 360
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const above = !!sel && sel.rect.top > vh * 0.45
  const left = sel ? Math.max(12, Math.min(vw - W - 12, (sel.rect.left + sel.rect.right) / 2 - W / 2)) : 0
  const pos = !sel || mobile ? undefined
    : above ? { left, bottom: vh - sel.rect.top + 10, maxHeight: sel.rect.top - 24 }
      : { left, top: sel.rect.bottom + 10, maxHeight: vh - sel.rect.bottom - 24 }

  const body = sel && (
    <>
      <div className="flex items-center gap-2">
        <span className="font-display text-[24px] leading-none tracking-tight min-w-0 flex-1 truncate" title={sel.text}>{sel.text}</span>
        <Say text={sel.text} />
        <button type="button" onClick={() => setSel(null)} aria-label={pt ? 'Fechar' : 'Close'} className="w-8 h-8 rounded-full grid place-items-center hover:bg-[var(--ui-hover)]" style={muted}><X className="w-4 h-4" /></button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5" role="group">
        {STATUS.map(({ id, icon: Icon, pt: lp, en }) => (
          <button key={id} type="button" onClick={() => setStatus(id)} aria-pressed={existing?.status === id} className={`btn-3d btn-3d--${id} !w-full !px-0`}>
            <Icon className="w-3.5 h-3.5" strokeWidth={2.4} fill={id === 'important' && existing?.status === id ? 'currentColor' : 'none'} />{pt ? lp : en}
          </button>
        ))}
      </div>
      {explained && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-2xl p-3.5 text-[14px] leading-snug" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
          <p className="text-[12.5px]" style={muted}>{[explained.ipa && (explained.ipa.startsWith('/') ? explained.ipa : `/${explained.ipa}/`), explained.pos].filter(Boolean).join(' · ')}</p>
          <p className="mt-1 font-semibold text-[15px]">{explained.meaning}</p>
          {explained.in_context && <p className="mt-1.5">{explained.in_context}</p>}
          {explained.examples.length > 0 && <ul className="mt-2.5 space-y-2">{explained.examples.map((e, i) => (
            <li key={i} className="flex gap-1.5"><div className="flex-1 min-w-0"><p className="font-serif italic text-[15px]">{e.en}</p><p className="text-[12.5px]" style={muted}>{e.pt}</p></div><Say text={e.en} size="sm" /></li>
          ))}</ul>}
          {explained.note && <p className="mt-2.5 text-[12.5px]" style={muted}>{explained.note}</p>}
        </motion.div>
      )}
      <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-1.5" style={{ borderColor: 'var(--theme-border)' }}>
        <button type="button" onClick={() => void explain()} disabled={loading} className="h-10 rounded-xl inline-flex items-center justify-center gap-1.5 text-[13px] font-medium whitespace-nowrap hover:bg-[var(--ui-hover)] disabled:opacity-60">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpenText className="w-4 h-4" />}
          {explained ? (pt ? 'De novo' : 'Again') : (pt ? 'Explicar' : 'Explain')}<Cost n={CREDIT_COST.lessonExplain} pt={pt} />
        </button>
        <button type="button" onClick={askChat} className="h-10 rounded-xl inline-flex items-center justify-center gap-1.5 text-[13px] font-medium whitespace-nowrap hover:bg-[var(--ui-hover)]">
          <MessageCircleQuestion className="w-4 h-4" />{pt ? 'Perguntar no chat' : 'Ask in chat'}
        </button>
      </div>
    </>
  )

  return (
    <AnimatePresence>
      {sel && (mobile ? (
        <motion.div key="sheet" ref={box} data-lesson-ui-zone role="dialog" aria-label={sel.text}
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="elevated fixed inset-x-0 bottom-0 z-[180] rounded-t-3xl px-4 pt-3 max-h-[70dvh] overflow-y-auto"
          style={{ color: 'var(--theme-text)', paddingBottom: 'calc(14px + var(--safe-b, 0px))' }}>
          <div className="mx-auto mb-2 w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--theme-border)' }} />
          {body}
        </motion.div>
      ) : (
        <motion.div key={`pop-${sel.text}-${sel.rect.top}`} ref={box} data-lesson-ui-zone role="dialog" aria-label={sel.text}
          initial={{ opacity: 0, scale: 0.97, y: above ? 6 : -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.14 }}
          className="elevated fixed z-[180] rounded-2xl p-3.5 overflow-y-auto" style={{ ...pos, width: W, color: 'var(--theme-text)' }}>
          {body}
        </motion.div>
      ))}
    </AnimatePresence>
  )
}
