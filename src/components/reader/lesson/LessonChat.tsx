// Chat flutuante da aula: a pessoa pergunta qualquer dúvida e a IA responde no contexto da página e da aula.
// 1 crédito por mensagem (cobrado no servidor). A conversa fica guardada por página no aparelho.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp, Loader2, MessageCircleQuestion, Trash2, X } from 'lucide-react'
import { grammar, type GrammarContent, type LessonChatMsg } from '@/lib/billingApi'
import { CREDIT_COST } from '@/lib/plans'
import { failMessage } from './lessonStore'
import { Cost, RichText, muted, useLessonEnv } from './ui'

function suggestions(c: GrammarContent | null, pt: boolean): string[] {
  const out: string[] = []
  if (c?.sentences[0]) out.push(pt ? `Explique palavra por palavra: “${c.sentences[0].en.slice(0, 70)}${c.sentences[0].en.length > 70 ? '…' : ''}”` : `Explain word by word: “${c.sentences[0].en.slice(0, 70)}”`)
  if (c?.units[0]) out.push(pt ? `Me dê mais exemplos de “${c.units[0].title}”` : `More examples of “${c.units[0].title}”`)
  if (c?.vocabulary[1]) out.push(pt ? `Qual a diferença entre “${c.vocabulary[0].word}” e um sinônimo?` : `How is “${c.vocabulary[0].word}” different from a synonym?`)
  out.push(pt ? 'Como eu usaria isso numa conversa hoje?' : 'How would I use this in a conversation today?')
  return out.slice(0, 4)
}

export function LessonChat({ open, onOpenChange, content, draft, onDraftUsed }: {
  open: boolean; onOpenChange: (o: boolean) => void; content: GrammarContent | null; draft: string; onDraftUsed: () => void
}) {
  const env = useLessonEnv()
  const { pt } = env
  const msgs: LessonChatMsg[] = env.data?.chat ?? []
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (open && draft) { setText(draft); onDraftUsed(); window.setTimeout(() => input.current?.focus(), 60) } }, [open, draft]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }) }, [msgs.length, sending, open])
  useEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(140, el.scrollHeight)}px`
  }, [text])

  const send = async (q = text) => {
    const question = q.trim()
    if (!question || sending) return
    const history = msgs.slice(-10)
    env.patch(d => ({ ...d, chat: [...d.chat, { role: 'user' as const, content: question }] }))
    setText('')
    setSending(true)
    try {
      const r = await grammar.chat(env.bookId, env.page, env.lang, env.level, question, history)
      env.patch(d => ({ ...d, chat: [...d.chat, { role: 'assistant' as const, content: r.answer }].slice(-40) }))
    } catch (e) {
      // Sem resposta: tira a pergunta da conversa e devolve para a caixa de texto.
      env.patch(d => ({ ...d, chat: d.chat.slice(0, -1) }))
      setText(question)
      const m = failMessage(e, pt)
      if (m) { setError(m); window.setTimeout(() => setError(null), 4000) }
    } finally { setSending(false) }
  }

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button key="fab" type="button" data-lesson-ui onClick={() => onOpenChange(true)}
            initial={{ opacity: 0, y: 12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.95 }}
            className="fixed z-[160] right-4 md:right-8 h-13 pl-4 pr-5 py-3 rounded-full shadow-lg inline-flex items-center gap-2 text-[14.5px] font-semibold"
            style={{ bottom: 'calc(16px + var(--safe-b, 0px))', backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)', boxShadow: '0 10px 30px -8px rgba(0,0,0,.35)' }}>
            <MessageCircleQuestion className="w-5 h-5" />{pt ? 'Tirar dúvida' : 'Ask a question'}
            {msgs.length > 0 && <span className="ml-0.5 min-w-5 h-5 px-1.5 rounded-full text-[11px] grid place-items-center" style={{ backgroundColor: 'rgba(255,255,255,.22)' }}>{Math.ceil(msgs.length / 2)}</span>}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div key="shade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => onOpenChange(false)}
            className="md:hidden fixed inset-0 z-[165]" style={{ backgroundColor: 'rgba(0,0,0,.28)' }} aria-hidden />
        )}
        {open && (
          <motion.div key="panel" data-lesson-ui-zone role="dialog" aria-label={pt ? 'Dúvidas da aula' : 'Lesson questions'}
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="elevated fixed z-[170] flex flex-col overflow-hidden inset-x-0 bottom-0 h-[78dvh] rounded-t-3xl md:inset-x-auto md:right-8 md:bottom-8 md:w-[420px] md:h-[min(620px,calc(100dvh-120px))] md:rounded-3xl"
            style={{ color: 'var(--theme-text)', paddingBottom: 'var(--safe-b, 0px)' }}>
            <header className="shrink-0 px-5 pt-4 pb-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--theme-border)' }}>
              <span className="w-9 h-9 rounded-full grid place-items-center shrink-0" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}><MessageCircleQuestion className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-tight">{pt ? 'Dúvidas da aula' : 'Lesson questions'}</p>
                <p className="text-[12px] truncate" style={muted}>{pt ? `Página ${env.page + 1} · responde no contexto da aula` : `Page ${env.page + 1} · answers in the lesson’s context`}</p>
              </div>
              {msgs.length > 0 && <button type="button" data-lesson-ui onClick={() => env.patch(d => ({ ...d, chat: [] }))} aria-label={pt ? 'Limpar conversa' : 'Clear chat'} title={pt ? 'Limpar conversa' : 'Clear chat'} className="w-9 h-9 rounded-full grid place-items-center hover:bg-[var(--ui-hover)]" style={muted}><Trash2 className="w-4 h-4" /></button>}
              <button type="button" data-lesson-ui onClick={() => onOpenChange(false)} aria-label={pt ? 'Fechar' : 'Close'} className="w-9 h-9 rounded-full grid place-items-center hover:bg-[var(--ui-hover)]"><X className="w-5 h-5" /></button>
            </header>

            <div ref={list} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 overscroll-contain">
              {msgs.length === 0 && (
                <div className="px-1">
                  <p className="font-display text-[22px] leading-tight">{pt ? 'Pergunte o que quiser sobre esta página' : 'Ask anything about this page'}</p>
                  <p className="mt-1.5 text-[13.5px]" style={muted}>{pt ? 'Gramática, palavras, por que o autor escreveu assim, como usar no dia a dia.' : 'Grammar, words, why the author wrote it this way, everyday use.'}</p>
                  <div className="mt-4 flex flex-col gap-2" data-lesson-ui>
                    {suggestions(content, pt).map(s => (
                      <button key={s} type="button" onClick={() => void send(s)} className="text-left text-[13.5px] leading-snug rounded-2xl border px-3.5 py-2.5 hover:bg-[var(--ui-hover)]" style={{ borderColor: 'var(--theme-border)' }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {msgs.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={m.role === 'user' ? 'flex justify-end' : 'flex'}>
                  {m.role === 'user'
                    ? <p className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[14.5px] leading-snug whitespace-pre-wrap" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{m.content}</p>
                    : <div data-en-zone className="max-w-[92%] rounded-2xl rounded-bl-md px-4 py-3 text-[14.5px] leading-relaxed" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}><RichText text={m.content} /></div>}
                </motion.div>
              ))}
              {sending && (
                <div className="flex"><div className="rounded-2xl rounded-bl-md px-4 py-3 inline-flex items-center gap-1.5" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                  {[0, 1, 2].map(i => <motion.span key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'currentColor', opacity: 0.5 }} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />)}
                </div></div>
              )}
            </div>

            <form className="shrink-0 border-t px-3 pt-3 pb-2" style={{ borderColor: 'var(--theme-border)' }} onSubmit={e => { e.preventDefault(); void send() }}>
              {error && <p className="px-2 pb-2 text-[12.5px]" style={{ color: '#dc2626' }}>{error}</p>}
              <div className="flex items-end gap-2 rounded-2xl border px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--theme-primary)]/25" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)' }}>
                <textarea ref={input} value={text} onChange={e => setText(e.target.value)} rows={1} maxLength={800} data-lesson-ui
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send() } }}
                  placeholder={pt ? 'Escreva sua dúvida…' : 'Type your question…'} className="flex-1 resize-none bg-transparent outline-none text-[15px] leading-snug py-1.5 max-h-[140px]" />
                <button type="submit" disabled={!text.trim() || sending} aria-label={pt ? 'Enviar' : 'Send'} className="w-9 h-9 shrink-0 rounded-full grid place-items-center disabled:opacity-40" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                </button>
              </div>
              <p className="px-2 pt-1.5 text-[11px]" style={muted}>{pt ? 'Cada pergunta' : 'Each question'}<Cost n={CREDIT_COST.lessonChat} pt={pt} /></p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
