// Convite de assinatura. Abre de qualquer lugar com openPaywall('book' | 'import' | …).
// Tom convidativo (o que a pessoa ganha), nunca punitivo; sempre dá para fechar.
import { create } from 'zustand'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { formatBRL, nextPlan, PLANS, type PlanId } from '@/lib/plans'

export type PaywallTrigger =
  | 'book' | 'import' | 'credits' | 'minutes' | 'style' | 'tutor' | 'scenes' | 'scenes_create' | 'free_talk'
  | 'insights' | 'stories' | 'pages_cap' | 'mosaic_cap' | 'generic'

const usePaywall = create<{ trigger: PaywallTrigger | null; open: (t: PaywallTrigger) => void; close: () => void }>(set => ({
  trigger: null,
  open: trigger => set({ trigger }),
  close: () => set({ trigger: null }),
}))

export function openPaywall(trigger: PaywallTrigger = 'generic') {
  usePaywall.getState().open(trigger)
}

/** Converte o código de erro do servidor no gatilho certo. Devolve true se abriu o convite. */
export function paywallForError(code: string | undefined, detail?: string): boolean {
  if (!code) return false
  if (code === 'no_credits') { openPaywall('credits'); return true }
  if (code === 'no_minutes') { openPaywall('minutes'); return true }
  if (code === 'cap_reached') { openPaywall(/mosaic/.test(detail ?? '') ? 'mosaic_cap' : /stor/.test(detail ?? '') ? 'stories' : 'pages_cap'); return true }
  if (code === 'plan_required') {
    const d = detail ?? ''
    const t: PaywallTrigger = /import|text_books/.test(d) ? 'import' : /custom_style|panel/.test(d) ? 'style' : /tutor/.test(d) ? 'tutor'
      : /scenes_create/.test(d) ? 'scenes_create' : /scenes/.test(d) ? 'scenes' : /free_talk/.test(d) ? 'free_talk'
      : /insights/.test(d) ? 'insights' : /stories/.test(d) ? 'stories' : 'book'
    openPaywall(t)
    return true
  }
  return false
}

const COPY: Record<PaywallTrigger, { emoji: string; pt: [string, string]; en: [string, string] }> = {
  book: { emoji: '📚', pt: ['Este livro está esperando por você', 'Assine e leia toda a galeria: clássicos ilustrados, com áudio e vocabulário.'], en: ['This book is waiting for you', 'Subscribe and read the whole gallery: illustrated classics with audio and vocabulary.'] },
  import: { emoji: '📥', pt: ['Traga seus próprios livros', 'Importe EPUB e PDF e estude com tudo o que o app oferece.'], en: ['Bring your own books', 'Import EPUB and PDF and study them with every feature.'] },
  credits: { emoji: '✨', pt: ['Sua imaginação não precisa esperar', 'Seus créditos de IA deste mês acabaram. Ganhe mais créditos e continue ilustrando.'], en: ["Your imagination shouldn't wait", 'Your AI credits for this month are used up. Get more and keep illustrating.'] },
  minutes: { emoji: '🗣️', pt: ['Continue conversando', 'Seus minutos de conversa deste mês acabaram. Mais minutos, mais fluência.'], en: ['Keep talking', 'Your conversation minutes for this month are used up.'] },
  style: { emoji: '🎨', pt: ['Ilustre do seu jeito', 'Crie seu próprio estilo, edite quadros e redesenhe páginas.'], en: ['Illustrate your way', 'Create your own style, edit panels and redraw pages.'] },
  tutor: { emoji: '🎙️', pt: ['Converse com seu tutor enquanto lê', 'Pergunte sobre a história, as palavras e os personagens, por voz, sem sair da página.'], en: ['Talk to your tutor while you read', 'Ask about the story, words and characters by voice, without leaving the page.'] },
  scenes: { emoji: '🎭', pt: ['Pratique em situações reais', 'Aeroporto, cafeteria, entrevista de emprego… converse por voz e receba nota e correções.'], en: ['Practise real situations', 'Airport, café, job interview… talk by voice and get a score and corrections.'] },
  scenes_create: { emoji: '🎭', pt: ['Crie suas próprias Cenas', 'Invente o lugar, o personagem e o objetivo. A IA vira esse personagem para você treinar.'], en: ['Create your own Scenes', 'Invent the place, the character and the goal. The AI plays it for you.'] },
  free_talk: { emoji: '💬', pt: ['Um tutor que conhece você', 'Converse livremente com um tutor que puxa exatamente as suas dificuldades.'], en: ['A tutor who knows you', 'Talk freely with a tutor who works on your weak spots.'] },
  insights: { emoji: '🧠', pt: ['Descubra o que travar seu inglês', 'Um raio-X semanal com suas 3 maiores dificuldades e como vencê-las.'], en: ['Find what holds you back', 'A weekly report on your 3 biggest difficulties and how to beat them.'] },
  stories: { emoji: '📖', pt: ['Histórias feitas para você', 'Histórias curtas com as palavras e a gramática que você mais erra.'], en: ['Stories made for you', 'Short stories with the words and grammar you miss most.'] },
  pages_cap: { emoji: '🖼️', pt: ['Gostou das ilustrações?', 'Você usou as 3 páginas ilustradas do mês. Nos planos pagos você ilustra muito mais.'], en: ['Enjoying the illustrations?', "You've used this month's 3 illustrated pages. Paid plans illustrate much more."] },
  mosaic_cap: { emoji: '🖼️', pt: ['Mais imagens para lembrar', 'Você usou os mosaicos do mês. Assine e gere quantos precisar.'], en: ['More images to remember', "You've used this month's mosaics. Subscribe to make more."] },
  generic: { emoji: '🚀', pt: ['Libere tudo', 'Biblioteca completa, mais IA, conversas por voz e um tutor que conhece você.'], en: ['Unlock everything', 'Full library, more AI, voice conversations and a tutor who knows you.'] },
}

const PREFERRED: Partial<Record<PaywallTrigger, PlanId>> = {
  tutor: 'plus', scenes_create: 'plus', free_talk: 'plus', insights: 'plus', stories: 'plus',
}

export function PaywallHost() {
  const { trigger, close } = usePaywall()
  const pt = useLanguage().locale === 'pt-BR'
  const navigate = useNavigate()
  const ent = useEntitlements(s => s.data)
  if (!trigger) return null
  const copy = COPY[trigger]
  const paid = !!ent && ent.plan !== 'free'
  // Já assina e acabou o saldo: oferece o plano de cima (ou espera a renovação no Pro).
  const upgrade = paid && (trigger === 'credits' || trigger === 'minutes') ? nextPlan(ent!.plan) : null
  const isTop = paid && upgrade?.id === ent!.plan
  const renews = ent?.period?.ends_at ? new Date(ent.period.ends_at).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'long' }) : ''
  const minRank = Math.max(1, ent ? ent.plan_rank + 1 : 1)
  const options = PLANS.filter(p => p.id !== 'free' && PLANS.indexOf(p) >= minRank)
  const recommended = PREFERRED[trigger] && options.some(o => o.id === PREFERRED[trigger]) ? PREFERRED[trigger]! : options.find(o => o.highlight)?.id ?? options[0]?.id
  const go = (plan: PlanId) => { close(); navigate(`/planos?plan=${plan}&from=${trigger}`) }

  return (
    <Dialog open onOpenChange={o => { if (!o) close() }}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden"
          style={{ background: 'radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--theme-accent) 22%, transparent), transparent 70%)' }}>
          <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            className="mx-auto w-16 h-16 rounded-2xl grid place-items-center text-[34px] shadow-lg" style={{ backgroundColor: 'var(--theme-card-bg)' }}>
            {copy.emoji}
          </motion.div>
          <DialogHeader className="mt-4">
            <DialogTitle className="font-display text-[28px] leading-tight text-center">{(pt ? copy.pt : copy.en)[0]}</DialogTitle>
            <DialogDescription className="text-center text-[15px] max-w-md mx-auto">{(pt ? copy.pt : copy.en)[1]}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 pb-6 max-h-[60dvh] overflow-y-auto">
          {isTop ? (
            <div className="rounded-2xl border p-5 text-center" style={{ borderColor: 'var(--theme-border)' }}>
              <p className="text-[15px]">{pt ? `Você já está no plano mais completo. Seu saldo renova em ${renews}.` : `You're on the top plan. Your balance renews on ${renews}.`}</p>
              <button type="button" onClick={close} className="mt-4 h-11 px-5 rounded-xl text-[14.5px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Entendi' : 'Got it'}</button>
            </div>
          ) : (
            <>
              <div className={`grid gap-3 ${options.length >= 3 ? 'sm:grid-cols-3' : options.length === 2 ? 'sm:grid-cols-2' : ''}`}>
                {options.map((plan, i) => {
                  const best = plan.id === recommended
                  return (
                    <motion.button key={plan.id} type="button" onClick={() => go(plan.id)}
                      initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.06 * i, type: 'spring', stiffness: 300, damping: 24 }}
                      whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
                      className="relative text-left rounded-2xl border p-4 flex flex-col gap-1.5 transition-shadow hover:shadow-lg"
                      style={{ borderColor: best ? 'var(--theme-accent)' : 'var(--theme-border)', borderWidth: best ? 2 : 1, backgroundColor: 'var(--theme-card-bg)' }}>
                      {best && <span className="absolute -top-2.5 left-4 px-2 h-5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1" style={{ backgroundColor: 'var(--theme-accent)', color: '#fff' }}><Sparkles className="w-3 h-3" />{pt ? 'Mais escolhido' : 'Most popular'}</span>}
                      <span className="text-[15px] font-semibold">{plan.name}</span>
                      <span className="text-[22px] font-semibold tabular-nums">{formatBRL(plan.priceCents)}<span className="text-[12.5px] font-normal" style={{ color: 'var(--theme-text-secondary)' }}>/{pt ? 'mês' : 'mo'}</span></span>
                      <span className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{plan.credits} {pt ? 'créditos' : 'credits'} · {plan.minutes} min</span>
                      <ul className="mt-1 space-y-1">
                        {plan.benefits.slice(plan.id === 'essencial' ? 0 : 1, plan.id === 'essencial' ? 4 : 4).map(b => (
                          <li key={b.pt} className="flex gap-1.5 text-[12.5px] leading-snug"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--theme-accent)' }} />{pt ? b.pt : b.en}</li>
                        ))}
                      </ul>
                      <span className="mt-2 h-10 rounded-xl grid place-items-center text-[14px] font-semibold"
                        style={{ backgroundColor: best ? 'var(--theme-primary)' : 'var(--theme-bg-secondary)', color: best ? 'var(--theme-primary-text)' : 'var(--theme-text)' }}>
                        {upgrade ? (pt ? `Fazer upgrade` : 'Upgrade') : (pt ? `Assinar ${plan.name}` : `Get ${plan.name}`)}
                      </span>
                    </motion.button>
                  )
                })}
              </div>
              {paid && (trigger === 'credits' || trigger === 'minutes') && renews && (
                <p className="mt-4 text-center text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? `Ou espere a renovação em ${renews}.` : `Or wait for your renewal on ${renews}.`}</p>
              )}
              <p className="mt-4 text-center text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
                {pt ? 'Cancele quando quiser · 7 dias de garantia' : 'Cancel anytime · 7-day guarantee'}
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
