// Convite de assinatura. Abre de qualquer lugar com openPaywall('book' | 'import' | …).
// Tom convidativo (o que a pessoa ganha), nunca punitivo; sempre dá para fechar.
import { create } from 'zustand'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { AudioLines, BookOpen, BookText, Brain, Check, Crown, Image as ImageIcon, Images, MessageCircle, MessagesSquare, Mic, Palette, PenLine, Sparkles, Upload, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
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
  if (code === 'no_minutes') { openPaywall('credits'); return true }
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

const COPY: Record<PaywallTrigger, { icon: LucideIcon; pt: [string, string]; en: [string, string] }> = {
  book: { icon: BookOpen, pt: ['Este livro está esperando por você', 'Assine e leia toda a galeria: clássicos ilustrados, com áudio e vocabulário.'], en: ['This book is waiting for you', 'Subscribe and read the whole gallery: illustrated classics with audio and vocabulary.'] },
  import: { icon: Upload, pt: ['Traga seus próprios livros', 'Importe EPUB e PDF e estude com tudo o que o app oferece.'], en: ['Bring your own books', 'Import EPUB and PDF and study them with every feature.'] },
  credits: { icon: Sparkles, pt: ['Sua imaginação não precisa esperar', 'Seus créditos de IA deste mês acabaram. Ganhe mais créditos e continue ilustrando.'], en: ["Your imagination shouldn't wait", 'Your AI credits for this month are used up. Get more and keep illustrating.'] },
  minutes: { icon: AudioLines, pt: ['Continue conversando', 'Seus créditos de IA deste mês acabaram. Mais créditos, mais conversa e mais fluência.'], en: ['Keep talking', 'Your AI credits for this month are used up.'] },
  style: { icon: Palette, pt: ['Ilustre do seu jeito', 'Crie seu próprio estilo, edite quadros e redesenhe páginas.'], en: ['Illustrate your way', 'Create your own style, edit panels and redraw pages.'] },
  tutor: { icon: Mic, pt: ['Converse com seu tutor enquanto lê', 'Pergunte sobre a história, as palavras e os personagens, por voz, sem sair da página.'], en: ['Talk to your tutor while you read', 'Ask about the story, words and characters by voice, without leaving the page.'] },
  scenes: { icon: MessagesSquare, pt: ['Pratique em situações reais', 'Aeroporto, cafeteria, entrevista de emprego… converse por voz e receba nota e correções.'], en: ['Practise real situations', 'Airport, café, job interview… talk by voice and get a score and corrections.'] },
  scenes_create: { icon: PenLine, pt: ['Crie suas próprias Cenas', 'Invente o lugar, o personagem e o objetivo. A IA vira esse personagem para você treinar.'], en: ['Create your own Scenes', 'Invent the place, the character and the goal. The AI plays it for you.'] },
  free_talk: { icon: MessageCircle, pt: ['Um tutor que conhece você', 'Converse livremente com um tutor que puxa exatamente as suas dificuldades.'], en: ['A tutor who knows you', 'Talk freely with a tutor who works on your weak spots.'] },
  insights: { icon: Brain, pt: ['Descubra o que travar seu inglês', 'Um raio-X semanal com suas 3 maiores dificuldades e como vencê-las.'], en: ['Find what holds you back', 'A weekly report on your 3 biggest difficulties and how to beat them.'] },
  stories: { icon: BookText, pt: ['Histórias feitas para você', 'Histórias curtas com as palavras e a gramática que você mais erra.'], en: ['Stories made for you', 'Short stories with the words and grammar you miss most.'] },
  pages_cap: { icon: ImageIcon, pt: ['Gostou das ilustrações?', 'Você usou as 3 páginas ilustradas do mês. Nos planos pagos você ilustra muito mais.'], en: ['Enjoying the illustrations?', "You've used this month's 3 illustrated pages. Paid plans illustrate much more."] },
  mosaic_cap: { icon: Images, pt: ['Mais imagens para lembrar', 'Você usou os mosaicos do mês. Assine e gere quantos precisar.'], en: ['More images to remember', "You've used this month's mosaics. Subscribe to make more."] },
  generic: { icon: Crown, pt: ['Libere tudo', 'Biblioteca completa, mais IA, conversas por voz e um tutor que conhece você.'], en: ['Unlock everything', 'Full library, more AI, voice conversations and a tutor who knows you.'] },
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
      <DialogContent className="sm:max-w-3xl">
        <div className="text-center px-2 sm:px-6 pt-2">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className="mx-auto w-12 h-12 rounded-2xl grid place-items-center border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
            <copy.icon className="w-5 h-5" strokeWidth={1.7} />
          </motion.div>
          <DialogTitle className="mt-4 font-display text-[28px] sm:text-[32px] leading-tight text-center !pr-0">{(pt ? copy.pt : copy.en)[0]}</DialogTitle>
          <DialogDescription className="mt-2 text-center text-[15px] max-w-md mx-auto !pr-0">{(pt ? copy.pt : copy.en)[1]}</DialogDescription>
        </div>

        {isTop ? (
          <div className="mt-2 rounded-2xl border p-5 text-center" style={{ borderColor: 'var(--theme-border)' }}>
            <p className="text-[15px]">{pt ? `Você já está no plano mais completo. Seu saldo renova em ${renews}.` : `You're on the top plan. Your balance renews on ${renews}.`}</p>
            <button type="button" onClick={close} className="mt-4 h-11 px-6 rounded-xl text-[14.5px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Entendi' : 'Got it'}</button>
          </div>
        ) : (
          <div className="mt-3">
            <div className={`grid gap-4 pt-4 ${options.length >= 3 ? 'md:grid-cols-3' : options.length === 2 ? 'md:grid-cols-2' : ''}`}>
              {options.map(plan => {
                const best = plan.id === recommended
                return (
                  <motion.button key={plan.id} type="button" onClick={() => go(plan.id)} whileTap={{ scale: 0.98 }}
                    className="relative text-left rounded-2xl border p-5 flex flex-col"
                    style={{ borderColor: best ? 'var(--theme-text)' : 'var(--theme-border)', borderWidth: best ? 2 : 1, backgroundColor: 'var(--theme-card-bg)' }}>
                    {best && <span className="absolute -top-3 left-1/2 -translate-x-1/2 h-6 px-3 rounded-full text-[11.5px] font-semibold inline-flex items-center whitespace-nowrap" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Mais escolhido' : 'Most popular'}</span>}
                    <span className="text-[15px] font-semibold">{plan.name}</span>
                    <span className="mt-1 text-[26px] font-semibold tabular-nums leading-tight">{formatBRL(plan.priceCents)}<span className="text-[13px] font-normal" style={{ color: 'var(--theme-text-secondary)' }}>/{pt ? 'mês' : 'mo'}</span></span>
                    <span className="mt-0.5 text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{plan.credits.toLocaleString(pt ? 'pt-BR' : 'en-US')} {pt ? 'créditos de IA por mês' : 'AI credits a month'}</span>
                    <ul className="mt-4 space-y-2 flex-1">
                      {plan.benefits.filter((b, i) => i > 0 && !/créditos de IA|AI credits/.test(b.pt + b.en)).slice(0, 4).map(b => (
                        <li key={b.pt} className="flex gap-2 text-[13px] leading-snug"><Check className="w-4 h-4 shrink-0 mt-px" strokeWidth={2} />{pt ? b.pt : b.en}</li>
                      ))}
                    </ul>
                    <span className="mt-5 h-11 rounded-xl grid place-items-center text-[14px] font-semibold"
                      style={best ? { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' } : { backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text)' }}>
                      {upgrade ? (pt ? 'Fazer upgrade' : 'Upgrade') : (pt ? `Assinar ${plan.name}` : `Get ${plan.name}`)}
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
