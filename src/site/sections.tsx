// Seções reutilizadas entre as páginas do site (planos, FAQ, CTA final, tutores).
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, useMotionValueEvent, useScroll } from 'motion/react'
import { PLANS, formatBRL, COST_TABLE } from '@/lib/plans'
import { DOCS } from '@/pages/legal/LegalPage'
import { Accordion, Btn, Check, Reveal, SectionHead, SPRING } from './ui'
import { FAQ_IDS, TUTORS, tutorImg } from './content'
import { BreathingTutor, LiveTutor } from './LiveTutor'

export function PricingCards({ compact }: { compact?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PLANS.map((p, i) => {
        const hi = !!p.highlight
        const benefits = compact ? p.benefits.slice(0, 4) : p.benefits
        return (
          <Reveal key={p.id} delay={i * 0.06} className="h-full">
            <div className="h-full rounded-[20px] p-6 flex flex-col gap-5 relative" style={hi ? { background: 'var(--site-ink)', color: '#fff' } : { background: '#fff', boxShadow: '0 0 0 1px var(--site-line)' }}>
              {hi && <span className="absolute top-5 right-5 text-[11px] s-head uppercase tracking-[.08em] px-2 py-1 rounded-md" style={{ background: '#fff', color: 'var(--site-ink)' }}>Mais escolhido</span>}
              <div>
                <p className="s-head text-[15px] font-medium">{p.name}</p>
                <p className="text-[13.5px] mt-1" style={{ color: hi ? 'rgba(255,255,255,.6)' : 'var(--site-muted)' }}>{p.tagline.pt}</p>
              </div>
              <p className="flex items-baseline gap-1">
                <span className="s-serif text-[44px]">{p.priceCents ? formatBRL(p.priceCents) : 'R$ 0'}</span>
                <span className="text-[14px]" style={{ color: hi ? 'rgba(255,255,255,.6)' : 'var(--site-muted)' }}>/mês</span>
              </p>
              <Link to={`/signup?plano=${p.id}`} className={`s-btn w-full ${hi ? 's-btn-white' : p.priceCents ? 's-btn-dark' : 's-btn-light'}`}>
                {p.priceCents ? `Assinar ${p.name}` : 'Começar grátis'}
              </Link>
              <ul className="flex flex-col gap-2.5">
                {benefits.map(b => <Check key={b.pt} dark={hi}>{b.pt}</Check>)}
              </ul>
              <p className="mt-auto pt-2 text-[12.5px]" style={{ color: hi ? 'rgba(255,255,255,.5)' : 'var(--site-faint)' }}>{p.credits.toLocaleString('pt-BR')} créditos de IA por mês</p>
            </div>
          </Reveal>
        )
      })}
    </div>
  )
}

export function CostTable() {
  return (
    <div className="s-card p-6 md:p-8">
      <h3 className="s-head text-[18px] font-medium">Quanto custa cada coisa em créditos</h3>
      <p className="text-[14.5px] mt-1" style={{ color: 'var(--site-muted)' }}>O que a comunidade já gerou é grátis. Os créditos renovam todo mês e o saldo aparece sempre no app.</p>
      <div className="mt-5 grid sm:grid-cols-2 gap-x-10">
        {COST_TABLE.map(r => (
          <div key={r.pt} className="flex items-center justify-between py-3 border-b text-[15px]" style={{ borderColor: 'var(--site-line)' }}>
            <span>{r.pt}</span><span className="s-head tabular-nums font-medium">{r.credits}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FaqSection({ ids = FAQ_IDS, title = <>Dúvidas?<br />A gente responde.</> }: { ids?: string[]; title?: React.ReactNode }) {
  const blocks = DOCS.faq.pt.blocks.filter(b => b.id && ids.includes(b.id))
  return (
    <section className="s-container pt-6 pb-28 md:pt-8 md:pb-36">
      <SectionHead center eyebrow="FAQ" title={title} width={460} className="mb-14" />
      <Reveal className="max-w-[648px] mx-auto"><Accordion items={blocks.map(b => ({ q: b.h, a: b.p.map((t, i) => <p key={i} className={i ? 'mt-2' : ''}>{t}</p>) }))} /></Reveal>
      <Reveal className="mt-8 text-center s-small">Ainda tem dúvidas? <a href="/faq" className="s-link" style={{ color: 'var(--site-ink)' }}>Veja todas as perguntas</a></Reveal>
    </section>
  )
}

export function FinalCta() {
  return (
    <section className="s-container py-10">
      <div className="relative rounded-[28px] overflow-hidden px-6 py-24 md:py-32 text-center flex flex-col items-center" style={{ background: 'radial-gradient(60% 80% at 15% 20%, #F5E1D6 0%, transparent 60%), radial-gradient(60% 80% at 85% 80%, #E3ECDF 0%, transparent 62%), radial-gradient(50% 60% at 80% 10%, #E2E9F2 0%, transparent 60%), #F6EEE4' }}>
        <Reveal><h2 className="s-serif s-h2 max-w-[640px]">Comece hoje. Ganhe um livro de presente.</h2></Reveal>
        <Reveal delay={0.06}><p className="s-lead mt-5 max-w-[470px]">No plano Grátis você escolhe 1 livro da galeria e ele é seu para sempre. Sem cartão de crédito.</p></Reveal>
        <Reveal delay={0.12} className="mt-9 flex flex-wrap justify-center gap-3">
          <Btn to="/signup" arrow>Começar grátis</Btn>
          <Btn to="/planos" variant="white">Ver planos</Btn>
        </Reveal>
      </div>
    </section>
  )
}

/** Imagem fixa do tutor à esquerda enquanto os textos rolam à direita (como a seção sticky do template). */
export function TutorsSticky() {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start center', 'end center'] })
  useMotionValueEvent(scrollYProgress, 'change', v => setActive(Math.min(TUTORS.length - 1, Math.max(0, Math.floor(v * TUTORS.length)))))
  const t = TUTORS[active]
  const inView = useInView(ref, { margin: '-20% 0px' })
  const near = useInView(ref, { margin: '300px 0px' })
  return (
    <section className="s-container py-24 md:py-32">
      <SectionHead eyebrow="Tutores" title={<>Quatro tutores. <span className="italic">Um jeito de falar</span> para cada pessoa.</>}
        text="Eles leem os livros com você, conversam por voz, corrigem com calma e lembram do que vocês já falaram." />
      <div ref={ref} className="mt-14 grid gap-10 md:grid-cols-2">
        <div className="hidden md:block">
          <div className="sticky top-[110px] h-[min(78vh,640px)] rounded-[24px] overflow-hidden s-noise transition-colors duration-500" style={{ background: `radial-gradient(90% 70% at 50% 100%, #fff 0%, transparent 70%), ${t.tint}` }}>
            {near ? <LiveTutor id={t.id} playing={inView} /> : <div className="absolute inset-0 flex items-end justify-center"><BreathingTutor id={t.id} className="h-[92%]" /></div>}
          </div>
        </div>
        <div className="flex flex-col">
          {TUTORS.map((tu, i) => (
            <div key={tu.id} className="md:min-h-[min(78vh,640px)] flex flex-col justify-center py-6 md:py-0">
              <div className="md:hidden rounded-[20px] h-[300px] relative overflow-hidden mb-6" style={{ background: tu.tint }}>
                <div className="absolute inset-0 flex items-end justify-center"><BreathingTutor id={tu.id} className="h-[95%]" /></div>
              </div>
              <motion.div animate={{ opacity: active === i ? 1 : 0.35 }} transition={{ duration: 0.3 }} className="flex flex-col gap-4 max-md:!opacity-100">
                <p className="s-head text-[13px] uppercase tracking-[.08em]" style={{ color: 'var(--site-muted)' }}>{String(i + 1).padStart(2, '0')} · {tu.role}</p>
                <h3 className="s-serif text-[56px] md:text-[72px] leading-none">{tu.name}</h3>
                <p className="text-[18px] leading-relaxed max-w-[460px]">{tu.about}</p>
                <ul className="flex flex-col gap-2.5 mt-1" style={{ color: 'var(--site-muted)' }}>
                  <Check>{tu.voice}</Check>
                  <Check>{tu.when}</Check>
                </ul>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
