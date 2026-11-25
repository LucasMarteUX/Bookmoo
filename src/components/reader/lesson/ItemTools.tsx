// Ações de IA em cada item da aula: "Explicar melhor" (com a dúvida da pessoa, opcional), "Mais exemplos" e
// "Imagem exemplo". O resultado fica guardado embaixo do item; cada clique é cobrado no servidor.
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ImagePlus, Lightbulb, Loader2, Plus, Sparkles, X } from 'lucide-react'
import { grammar } from '@/lib/billingApi'
import { CREDIT_COST } from '@/lib/plans'
import { toast } from '@/components/ui/toast'
import { failMessage, patchItem, useSignedImage } from './lessonStore'
import { Cost, En, RichText, Say, TONE, muted, tint, useLessonEnv } from './ui'

type Kind = 'expand' | 'examples' | 'image'

function LessonImage({ path, url, sentence, onRemove, pt }: { path: string; url: string | null; sentence: string; onRemove: () => void; pt: boolean }) {
  const src = useSignedImage(path, url)
  return (
    <figure className="relative group rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--theme-border)' }}>
      {src ? <img src={src} alt={sentence} loading="lazy" className="w-full aspect-square object-cover" /> : <div className="w-full aspect-square animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />}
      <figcaption className="px-3 py-2 text-[13px] font-serif italic leading-snug" style={{ backgroundColor: 'var(--theme-card-bg)' }}><En>{sentence}</En></figcaption>
      <button type="button" data-lesson-ui onClick={onRemove} aria-label={pt ? 'Remover imagem' : 'Remove image'}
        className="absolute top-2 right-2 w-8 h-8 rounded-full grid place-items-center opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity"
        style={{ backgroundColor: 'rgba(0,0,0,.55)', color: '#fff' }}><X className="w-4 h-4" /></button>
    </figure>
  )
}

/**
 * `id`: chave estável do item. `text`: o item inteiro (vai para a IA como dado).
 * `sentence`: frase em inglês que a imagem ilustra (sem ela, o botão de imagem não aparece).
 */
export function ItemTools({ id, text, sentence, topic }: { id: string; text: string; sentence?: string; topic?: string }) {
  const env = useLessonEnv()
  const { pt } = env
  const level = env.level
  const extra = env.data?.items[id] ?? {}
  const [busy, setBusy] = useState<Record<Kind, boolean>>({ expand: false, examples: false, image: false })
  const [asking, setAsking] = useState(false)
  const [doubt, setDoubt] = useState('')

  // Cada ação anda sozinha: dá para pedir a imagem e, enquanto ela pinta, pedir mais exemplos.
  const run = async (kind: Kind) => {
    if (busy[kind]) return
    setBusy(b => ({ ...b, [kind]: true }))
    try {
      if (kind === 'image' && sentence) {
        const r = await grammar.image(env.bookId, env.page, env.lang, sentence, topic ?? '')
        env.patch(d => patchItem(d, id, x => ({ ...x, images: [...(x.images ?? []), { path: r.path, url: r.url, sentence }] })))
      } else if (kind === 'examples') {
        const avoid = [...(extra.examples ?? []).map(e => e.en)]
        const r = await grammar.deepen(env.bookId, env.page, env.lang, level, 'examples', text, { avoid })
        if (r.mode === 'examples') env.patch(d => patchItem(d, id, x => ({ ...x, examples: [...(x.examples ?? []), ...r.examples] })))
      } else {
        const q = doubt.trim()
        const r = await grammar.deepen(env.bookId, env.page, env.lang, level, 'expand', text, { question: q || undefined })
        if (r.mode === 'expand') env.patch(d => patchItem(d, id, x => ({ ...x, expand: [...(x.expand ?? []), { explanation: r.explanation, steps: r.steps, examples: r.examples, remember: r.remember, question: q || undefined }] })))
        setDoubt(''); setAsking(false)
      }
    } catch (e) {
      const m = failMessage(e, pt)
      if (m) toast(m, { tone: 'error' })
    } finally { setBusy(b => ({ ...b, [kind]: false })) }
  }

  const btn = 'h-8 px-3 rounded-full border border-dashed inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--ui-hover)] hover:border-solid disabled:opacity-60'
  const spin = <Loader2 className="w-3.5 h-3.5 animate-spin" />

  return (
    <div data-lesson-ui-zone className="mt-4">
      {/* Explicações aprofundadas */}
      {(extra.expand ?? []).map((x, i) => (
        <motion.div key={`x${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-2xl border p-4 md:p-5" style={tint(TONE.violet, 6)}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] flex items-center gap-1.5" style={{ color: TONE.violet }}><Sparkles className="w-3.5 h-3.5" />{pt ? 'Explicação aprofundada' : 'Deeper explanation'}</p>
          {x.question && <p className="mt-1.5 text-[13px]" style={muted}>{pt ? 'Sua dúvida: ' : 'Your question: '}“{x.question}”</p>}
          <RichText text={x.explanation} className="mt-2.5 text-[15.5px] leading-relaxed" />
          {x.steps.length > 0 && (
            <ol className="mt-3 space-y-1.5">{x.steps.map((s, si) => (
              <li key={si} className="flex gap-2.5 text-[14.5px]"><span className="w-5 h-5 shrink-0 mt-0.5 rounded-full grid place-items-center text-[11px] font-bold" style={{ backgroundColor: `color-mix(in srgb, ${TONE.violet} 16%, transparent)`, color: TONE.violet }}>{si + 1}</span>{s}</li>
            ))}</ol>
          )}
          {x.examples.length > 0 && <ul className="mt-3 space-y-2">{x.examples.map((e, ei) => (
            <li key={ei} className="flex items-start gap-2"><div className="flex-1 min-w-0"><En as="p" className="font-serif italic text-[16px] leading-snug">{e.en}</En>{e.pt && <p className="text-[13.5px]" style={muted}>{e.pt}</p>}</div><Say text={e.en} size="sm" /></li>
          ))}</ul>}
          {x.remember && <p className="mt-3 text-[14px] flex gap-2"><Lightbulb className="w-4 h-4 mt-0.5 shrink-0" style={{ color: TONE.amber }} /><span><b>{pt ? 'Para lembrar: ' : 'Remember: '}</b>{x.remember}</span></p>}
        </motion.div>
      ))}

      {/* Exemplos extras */}
      {(extra.examples ?? []).length > 0 && (
        <div className="mt-3 rounded-2xl border p-4" style={tint(TONE.blue, 5)}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: TONE.blue }}>{pt ? 'Mais exemplos' : 'More examples'}</p>
          <ul className="mt-2 divide-y divide-[var(--theme-border)]">{(extra.examples ?? []).map((e, i) => (
            <li key={i} className="py-2 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <En as="p" className="font-serif italic text-[16px] leading-snug">{e.en}</En>
                {e.pt && <p className="text-[13.5px]" style={muted}>{e.pt}</p>}
                {e.note && <p className="mt-0.5 text-[12.5px]" style={muted}>↳ {e.note}</p>}
              </div>
              <Say text={e.en} size="sm" />
            </li>
          ))}</ul>
        </div>
      )}

      {/* Imagens exemplo */}
      {((extra.images ?? []).length > 0 || busy.image) && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(extra.images ?? []).map((im, i) => (
            <LessonImage key={im.path} path={im.path} url={im.url} sentence={im.sentence} pt={pt}
              onRemove={() => env.patch(d => patchItem(d, id, x => ({ ...x, images: (x.images ?? []).filter((_, j) => j !== i) })))} />
          ))}
          {busy.image && (
            <div className="rounded-2xl border aspect-square grid place-items-center text-center p-4" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
              <div><Loader2 className="w-5 h-5 animate-spin mx-auto" style={muted} /><p className="mt-2 text-[12.5px]" style={muted}>{pt ? 'Pintando a cena…' : 'Painting the scene…'}</p></div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {asking && (
          <motion.form key="ask" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"
            onSubmit={e => { e.preventDefault(); void run('expand') }}>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input autoFocus value={doubt} onChange={e => setDoubt(e.target.value)} maxLength={300} data-lesson-ui
                placeholder={pt ? 'O que não ficou claro? (opcional)' : 'What was unclear? (optional)'}
                className="flex-1 h-10 px-3.5 rounded-xl border text-[14px] outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/30" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)' }} />
              <button type="submit" disabled={busy.expand} data-lesson-ui className="h-10 px-4 rounded-xl text-[13.5px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                {busy.expand ? spin : <Sparkles className="w-4 h-4" />}{pt ? 'Explicar melhor' : 'Explain better'}<Cost n={CREDIT_COST.lessonDeepen} pt={pt} />
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="mt-3 flex flex-wrap gap-1.5" data-lesson-ui style={muted}>
        {!asking && (
          <button type="button" className={btn} style={{ borderColor: 'var(--theme-border)' }} onClick={() => setAsking(true)} disabled={busy.expand}>
            {busy.expand ? spin : <Sparkles className="w-3.5 h-3.5" />}{pt ? 'Não entendi, explicar melhor' : 'Explain it better'}
          </button>
        )}
        <button type="button" className={btn} style={{ borderColor: 'var(--theme-border)' }} onClick={() => void run('examples')} disabled={busy.examples}>
          {busy.examples ? spin : <Plus className="w-3.5 h-3.5" />}{pt ? 'Mais exemplos' : 'More examples'}<Cost n={CREDIT_COST.lessonDeepen} pt={pt} />
        </button>
        {sentence && (
          <button type="button" className={btn} style={{ borderColor: 'var(--theme-border)' }} onClick={() => void run('image')} disabled={busy.image}>
            {busy.image ? spin : <ImagePlus className="w-3.5 h-3.5" />}{pt ? 'Gerar imagem exemplo' : 'Example image'}<Cost n={CREDIT_COST.lessonImage} pt={pt} />
          </button>
        )}
      </div>
    </div>
  )
}
