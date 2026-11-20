// Blocos grandes do site: catálogo completo de funções, palco dos tutores e planos (com Mensal/Anual) e tabela comparativa.
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Minus, Mic, BookOpen, Sparkles, Library, MessagesSquare, TrendingUp, Wand2, Dumbbell, Crown, Clock, FileUp, Gift, Brain, Award, Image as ImageIcon, Repeat } from 'lucide-react'
import { PLANS, COST_TABLE, formatBRL, annualCents, annualMonthlyCents, type PlanId } from '@/lib/plans'
import { Fit } from './vignettes2'
import { VBalloon, VGift, VGoal, VGrammar, VImport, VMemory, VMosaic, VNotes, VPhone, VQuiz, VScenes, VSpeed, VStats, VStory, VStylesGrid, VThemes } from './vignettes2'
import { VComic, VCovers, VDictation, VLevels, VPost, VProva, VRaioX, VReader, VSpeak, VTutorChat, VVocab, VWord } from './vignettes'
import { Reveal } from './ui'
import { LiveTutor } from './LiveTutor'
import { TUTORS, tutorAvatar } from './content'

const EASE = [0.2, 0.8, 0.2, 1] as const

/* ================================================================ Catálogo de funções */

export type Feature = { t: string; d: string; v: ReactNode }
export const CATALOG: { id: string; label: string; icon: typeof BookOpen; title: string; items: Feature[] }[] = [
  { id: 'ler', label: 'Ler', icon: BookOpen, title: 'Um leitor feito para aprender', items: [
    { t: 'Áudio com karaokê', d: 'Vozes naturais leem a página e a palavra acende no momento em que é dita.', v: <VReader /> },
    { t: 'Quatro vozes e a sua velocidade', d: 'Escolha quem lê e diminua a velocidade sem mudar o tom.', v: <VSpeed /> },
    { t: 'Leitura confortável', d: 'Temas Dia, Tarde e Noite, fontes de livro e sons de lareira ou chuva.', v: <VThemes /> },
    { t: 'Notas e destaques', d: 'Marque trechos e escreva suas notas direto no livro.', v: <VNotes /> },
  ] },
  { id: 'entender', label: 'Entender', icon: Sparkles, title: 'Cada palavra explicada no contexto', items: [
    { t: 'Toque em qualquer palavra', d: 'Pronúncia, significado na frase e exemplos nas formas afirmativa, negativa e pergunta.', v: <div className="pb-20"><VWord /></div> },
    { t: 'Decifrar a página', d: 'A gramática da página explicada em português, trecho por trecho.', v: <VGrammar /> },
    { t: 'Mosaico da comunidade', d: 'Imagens criadas pelos leitores para você memorizar cada palavra.', v: <VMosaic /> },
    { t: 'Histórias de reforço', d: 'Pequenas histórias escritas para as suas dificuldades.', v: <VStory /> },
  ] },
  { id: 'ilustrar', label: 'Ilustrar', icon: Wand2, title: 'Páginas que viram ilustração', items: [
    { t: 'Cada página, uma ilustração', d: 'A página vira imagem ou quadrinho. O que a comunidade já gerou é grátis para todos.', v: <VComic /> },
    { t: '16 estilos ou o seu', d: 'Aquarela, mangá, HQ americana e europeia, noir, fantasia e mais.', v: <VStylesGrid /> },
    { t: 'Balões e narrador', d: 'As falas ganham balão, nome do personagem e voz.', v: <VBalloon /> },
  ] },
  { id: 'praticar', label: 'Praticar', icon: Dumbbell, title: 'Prática com o livro que você lê', items: [
    { t: 'Falar', d: 'Leia em voz alta e veja o que saiu certo, quase, errado ou ficou de fora.', v: <VSpeak /> },
    { t: 'Ditado', d: 'Ouça, escreva e veja na hora o que errou, com nota por página.', v: <VDictation /> },
    { t: 'Questionário e Desafio', d: 'Perguntas sobre o capítulo para conferir o que você entendeu.', v: <VQuiz /> },
    { t: 'Vocabulário e revisão', d: 'Revisar, Importante e Aprendido. As palavras voltam na hora certa.', v: <VVocab /> },
  ] },
  { id: 'conversar', label: 'Conversar', icon: MessagesSquare, title: 'Tutores que conversam com você', items: [
    { t: 'Conversa por voz', d: 'Fale em voz alta com Bia, Luck, Yuno ou Yuri. Correção frase a frase, com calma.', v: <VTutorChat /> },
    { t: 'Cenas do dia a dia', d: 'No café, no aeroporto, numa entrevista. Ou crie a sua.', v: <VScenes /> },
    { t: 'Eles lembram de você', d: 'Os tutores guardam o que vocês conversaram e continuam de onde pararam.', v: <VMemory /> },
  ] },
  { id: 'evoluir', label: 'Evoluir', icon: TrendingUp, title: 'Sua evolução, com números', items: [
    { t: 'Raio-X do seu inglês', d: 'Nota por habilidade e um diagnóstico em português do que treinar.', v: <VRaioX /> },
    { t: 'Meta, sequência e pontos', d: 'Minutos por dia, dias seguidos e pontos por tudo o que você faz.', v: <VGoal /> },
    { t: 'Estatísticas', d: 'Um ano de estudo num calendário, com palavras, tempo e recordes.', v: <VStats /> },
    { t: 'Teste de nível e Prova', d: 'Do A1 ao C2, e uma prova completa das 4 habilidades com relatório.', v: <VLevels /> },
  ] },
  { id: 'biblioteca', label: 'Biblioteca', icon: Library, title: 'Clássicos, os seus livros e a comunidade', items: [
    { t: 'Galeria de clássicos', d: 'Mais de 100 obras em domínio público, com capa nova e nível indicado.', v: <VCovers /> },
    { t: 'Importe EPUB e PDF', d: 'Leia os seus próprios livros com todas as ferramentas. Eles ficam só na sua conta.', v: <VImport /> },
    { t: 'Um livro de presente', d: 'No plano Grátis você escolhe 1 livro da galeria e ele é seu para sempre.', v: <VGift /> },
    { t: 'Comunidade de leitores', d: 'Momentos de leitura, perfis, seguidores e menções.', v: <VPost /> },
    { t: 'No celular e no computador', d: 'Instale como app e continue de onde parou, em qualquer tela.', v: <VPhone /> },
  ] },
]

function FeatureCard({ f }: { f: Feature }) {
  return (
    <article className="catalog-feature">
      <div className="catalog-sample"><Fit>{f.v}</Fit></div>
      <h3>{f.t}</h3>
      <p>{f.d}</p>
    </article>
  )
}

export function FeatureCatalog({ mode = 'tabs' }: { mode?: 'tabs' | 'all' }) {
  const [index, setIndex] = useState(0)
  const current = CATALOG[index]
  if (mode === 'all') {
    return (
      <div className="catalog-groups">{CATALOG.map(category => (
        <section key={category.id} id={category.id}>
          <h2 className="s-serif s-h3">{category.title}</h2>
          <div className="catalog-features">{category.items.map(f => <FeatureCard key={f.t} f={f} />)}</div>
        </section>
      ))}</div>
    )
  }
  return (
    <div className="catalog-explorer">
      <div className="catalog-nav" role="group" aria-label="Escolher atividade">
        {CATALOG.map((category, i) => (
          <button type="button" key={category.id} aria-pressed={i === index} onClick={() => setIndex(i)}>
            <category.icon size={16} aria-hidden />{category.label}
          </button>
        ))}
      </div>
      <div className="catalog-features" key={current.id}>
        {current.items.map(f => <FeatureCard key={f.t} f={f} />)}
      </div>
    </div>
  )
}

/* ================================================================ Palco dos tutores */

const TALK: Record<string, [string, string]> = {
  bia: ['What did you think of Peter going into the garden?', 'He was brave, but he don’t listen his mother.'],
  luck: ['Tell me about your day. What did you read?', 'I readed two chapters of Sherlock.'],
  yuno: ['Okay, quick game: describe your favorite series!', 'Is about a girl who travel in time.'],
  yuri: ['Want to learn some slang from the book?', 'Yes! What means “I’m knackered”?'],
}
const FIX: Record<string, [string, string]> = { bia: ['he don’t listen his mother', 'he didn’t listen to his mother'], luck: ['I readed', 'I read'], yuno: ['Is about … who travel', 'It’s about … who travels'], yuri: ['What means…?', 'What does … mean?'] }

export function TutorStage() {
  const [sel, setSel] = useState(0)
  const t = TUTORS[sel]
  const talk = TALK[t.id]
  return (
    <div className="tutor-studio">
      <div className="tutor-select" role="group" aria-label="Escolher tutor">
        {TUTORS.map((tutor, index) => (
          <button key={tutor.id} type="button" aria-pressed={sel === index} onClick={() => setSel(index)}>
            <img src={tutorAvatar(tutor.id)} alt="" width="40" height="40" />
            {tutor.name}
          </button>
        ))}
      </div>
      <div className="tutor-spread">
        <div className="tutor-portrait"><LiveTutor id={t.id} bubble="head" /></div>
        <div className="tutor-dialogue" key={t.id}>
          <header><p>{t.role}</p><h3>{t.name}</h3><p>{t.about}</p></header>
          <div className="tutor-transcript">
            <h4>Uma conversa com {t.name}</h4>
            <p lang="en">{talk[0]}</p>
            <p lang="en" className="tutor-reply">{talk[1]}</p>
          </div>
          <div className="tutor-feedback">
            <h4>Correção da frase</h4>
            <p><del lang="en">{FIX[t.id][0]}</del></p>
            <p><Check size={15} aria-hidden /><strong lang="en">{FIX[t.id][1]}</strong></p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================================================================ Planos */

type Cycle = 'mensal' | 'anual'

export function CycleToggle({ cycle, onChange }: { cycle: Cycle; onChange: (c: Cycle) => void }) {
  return (
    <div role="radiogroup" aria-label="Ciclo de cobrança" className="inline-flex items-center p-1 rounded-full" style={{ background: 'var(--site-surface)' }}>
      {(['mensal', 'anual'] as Cycle[]).map(c => (
        <button key={c} type="button" role="radio" aria-checked={cycle === c} onClick={() => onChange(c)} className="relative min-h-11 px-4 rounded-full text-[14px] flex items-center gap-2">
          {cycle === c && <motion.span layoutId="cycle-pill" className="absolute inset-0 rounded-full" style={{ background: 'var(--site-card)', boxShadow: '0 1px 3px rgba(25,25,25,.1)' }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          <span className="relative">{c === 'mensal' ? 'Mensal' : 'Anual'}</span>
          {c === 'anual' && <span className="relative text-[11.5px] px-1.5 py-0.5 rounded-full" style={{ background: '#E3F1E7', color: '#2D6040' }}>−20%</span>}
        </button>
      ))}
    </div>
  )
}

export function PricingGrid({ cycle, compact }: { cycle: Cycle; compact?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {PLANS.map((p, i) => {
        const hi = !!p.highlight
        const annual = cycle === 'anual' && p.priceCents > 0
        const monthly = annual ? annualMonthlyCents(p.priceCents) : p.priceCents
        const items = compact ? p.benefits.slice(0, 4) : p.benefits
        return (
          <Reveal key={p.id} delay={i * 0.05} className="h-full">
            <article className="site-plan" data-highlighted={hi}>
              <div className="flex items-center justify-between"><p className="s-card-title">{p.name}</p>{hi && <span className="text-[11.5px] px-2 py-0.5 rounded-full" style={{ background: 'var(--site-ink)', color: '#fff' }}>Destaque</span>}</div>
              <p className="s-small">{p.tagline.pt}</p>
              <div className="mt-6 min-h-[82px]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={`${cycle}-${p.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                    <p className="flex items-baseline gap-1.5"><span className="s-head text-[38px] tracking-[-0.03em]">{monthly ? formatBRL(monthly) : 'R$ 0'}</span><span className="s-small">/mês</span></p>
                    <p className="s-small text-[13px]">{!p.priceCents ? 'Para sempre, sem cartão' : annual ? `${formatBRL(annualCents(p.priceCents))} por ano · economize ${formatBRL(p.priceCents * 12 - annualCents(p.priceCents))}` : 'Cobrado todo mês, cancele quando quiser'}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="h-px my-6" style={{ background: 'var(--site-line)' }} />
              <p className="text-[13px] font-light" style={{ color: 'var(--site-muted)' }}>Incluído no plano</p>
              <ul className="mt-3 flex flex-col gap-2.5 mb-8">
                {items.map(b => <li key={b.pt} className="flex gap-2.5 text-[14px] leading-snug"><Check size={15} className="shrink-0 mt-0.5" />{b.pt}</li>)}
              </ul>
              <Link to={`/signup?plano=${p.id}${p.priceCents ? `&ciclo=${cycle}` : ''}`} className={`s-btn w-full mt-auto ${hi ? 's-btn-dark' : 's-btn-white'}`}>
                {p.priceCents ? `Assinar ${p.name}${annual ? ' anual' : ''}` : 'Começar grátis'}
              </Link>
            </article>
          </Reveal>
        )
      })}
    </div>
  )
}

export function Pricing({ compact }: { compact?: boolean }) {
  const [cycle, setCycle] = useState<Cycle>('anual')
  return (
    <div>
      <div className="flex justify-center mb-10"><CycleToggle cycle={cycle} onChange={setCycle} /></div>
      <PricingGrid cycle={cycle} compact={compact} />
    </div>
  )
}

type Cell = string | boolean
const ROWS: { icon: typeof Check; label: string; v: [Cell, Cell, Cell, Cell] }[] = [
  { icon: BookOpen, label: 'Leitura com áudio, vocabulário e prática', v: [true, true, true, true] },
  { icon: Library, label: 'Biblioteca da galeria', v: ['1 livro de presente', 'Completa', 'Completa', 'Completa'] },
  { icon: FileUp, label: 'Importar EPUB e PDF', v: [false, 'Até 20', 'Até 100', 'Ilimitado'] },
  { icon: Sparkles, label: 'Créditos de IA por mês', v: ['40', '230', '550', '1.100'] },
  { icon: ImageIcon, label: 'Estilo de ilustração próprio', v: [false, true, true, true] },
  { icon: MessagesSquare, label: 'Conversa por voz nas Cenas', v: ['1 Cena de teste', 'Todas', 'Todas', 'Todas'] },
  { icon: Clock, label: 'Duração de cada Cena', v: ['3 min', '5 min', '5 min', '10 min'] },
  { icon: Mic, label: 'Tutor de leitura por voz', v: [false, false, true, true] },
  { icon: MessagesSquare, label: 'Criar Cenas e conversa livre', v: [false, false, true, true] },
  { icon: Check, label: 'Correção frase a frase', v: [false, false, true, true] },
  { icon: Brain, label: 'Raio-X do seu inglês', v: [false, false, 'Semanal', 'Sob demanda'] },
  { icon: Repeat, label: 'Histórias de reforço', v: [false, false, '12 por mês', 'Sem limite'] },
  { icon: Award, label: 'Prova de proficiência', v: [false, false, false, true] },
  { icon: Crown, label: 'Relatório mensal e novidades antes', v: [false, false, false, true] },
  { icon: Gift, label: 'Livro de presente para sempre', v: [true, true, true, true] },
]

export function CompareTable() {
  const head: { id: PlanId; name: string }[] = PLANS.map(p => ({ id: p.id, name: p.name }))
  const cell = (c: Cell) => c === true ? <Check size={17} className="mx-auto" /> : c === false ? <Minus size={17} className="mx-auto" style={{ color: 'var(--site-faint)' }} /> : <span className="text-[13.5px] font-light">{c}</span>
  return (
    <div className="rounded-[20px] overflow-hidden" style={{ background: 'var(--site-card)', boxShadow: '0 0 0 1px var(--site-line)' }}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr><th className="px-6 md:px-8 py-6 s-card-title font-normal">Funções</th>{head.map(h => <th key={h.id} className="py-6 px-3 text-center s-card-title font-normal w-[16%]">{h.name}</th>)}</tr>
          </thead>
          <tbody>
            {ROWS.map(r => (
              <tr key={r.label} style={{ borderTop: '1px solid var(--site-line)' }}>
                <td className="px-6 md:px-8 py-4 text-[15px]"><span className="flex items-center gap-3"><r.icon size={16} style={{ color: 'var(--site-muted)' }} />{r.label}</span></td>
                {r.v.map((c, i) => <td key={i} className="py-4 px-3 text-center">{cell(c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function CreditsTable() {
  return (
    <div className="rounded-[20px] p-6 md:p-8" style={{ background: 'var(--site-card)', boxShadow: '0 0 0 1px var(--site-line)' }}>
      <div className="grid md:grid-cols-2 gap-x-12">
        {COST_TABLE.map(r => (
          <div key={r.pt} className="flex items-center justify-between py-3.5 text-[15px]" style={{ borderBottom: '1px solid var(--site-line)' }}>
            <span>{r.pt}</span><span className="s-head tabular-nums">{r.credits} {r.credits === '1' ? 'crédito' : 'créditos'}</span>
          </div>
        ))}
      </div>
      <p className="s-small mt-5">O que a comunidade já gerou não gasta crédito. Os créditos renovam todo mês, inclusive no plano anual, e o saldo fica sempre visível no app.</p>
    </div>
  )
}

/* ================================================================ Mosaico de funções (2ª seção da Home) */

type Tile = { t: string; d: string; v: ReactNode; span: string; h: string; tone?: 'warm' | 'soft' | 'card' }

const TILES: Tile[] = [
  { t: 'A página lê para você', d: 'Vozes naturais com karaokê, palavra por palavra.', v: <VReader />, span: 'md:col-span-7', h: 'h-[440px] md:h-[500px]', tone: 'warm' },
  { t: 'Toque em qualquer palavra', d: 'Pronúncia, significado e exemplos no contexto.', v: <div className="pb-20"><VWord /></div>, span: 'md:col-span-5', h: 'h-[440px] md:h-[500px]' },
  { t: 'Cada página vira ilustração', d: '16 estilos, balões e narrador.', v: <VComic />, span: 'md:col-span-5', h: 'h-[460px] md:h-[520px]' },
  { t: 'Converse com um tutor', d: 'Bia, Luck, Yuno e Yuri escutam e corrigem.', v: <VTutorChat />, span: 'md:col-span-4', h: 'h-[460px] md:h-[520px]', tone: 'warm' },
  { t: 'Seu nível, do A1 ao C2', d: 'Teste de nível e livros na medida.', v: <VLevels />, span: 'md:col-span-3', h: 'h-[360px] md:h-[520px]', tone: 'card' },
  { t: 'Leia em voz alta', d: 'Veja o que saiu certo, quase ou errado.', v: <VSpeak />, span: 'md:col-span-4', h: 'h-[420px] md:h-[460px]' },
  { t: 'Vocabulário que volta', d: 'Revisar, Importante e Aprendido.', v: <VVocab />, span: 'md:col-span-4', h: 'h-[420px] md:h-[460px]', tone: 'card' },
  { t: 'Ditado com correção', d: 'Ouça, escreva e receba a nota.', v: <VDictation />, span: 'md:col-span-4', h: 'h-[420px] md:h-[460px]' },
  { t: 'Raio-X do seu inglês', d: 'Nota por habilidade e diagnóstico.', v: <VRaioX />, span: 'md:col-span-4', h: 'h-[420px] md:h-[460px]', tone: 'warm' },
  { t: 'Meta e sequência', d: 'Um pouco por dia, todos os dias.', v: <VGoal />, span: 'md:col-span-4', h: 'h-[420px] md:h-[460px]' },
  { t: 'Estatísticas', d: 'Um ano de estudo num calendário.', v: <VStats />, span: 'md:col-span-4', h: 'h-[420px] md:h-[460px]', tone: 'card' },
  { t: 'Mais de 100 clássicos', d: 'Com capa nova e nível indicado.', v: <VCovers />, span: 'md:col-span-6', h: 'h-[400px] md:h-[440px]', tone: 'warm' },
  { t: 'Seus EPUBs e PDFs', d: 'Importe e leia com todas as ferramentas.', v: <VImport />, span: 'md:col-span-3', h: 'h-[400px] md:h-[440px]' },
  { t: 'Um livro de presente', d: 'No Grátis, ele é seu para sempre.', v: <VGift />, span: 'md:col-span-3', h: 'h-[400px] md:h-[440px]', tone: 'card' },
  { t: 'Leitura confortável', d: 'Dia, Tarde, Noite e sons ambientes.', v: <VThemes />, span: 'md:col-span-4', h: 'h-[400px] md:h-[440px]', tone: 'card' },
  { t: 'Cenas do dia a dia', d: 'Café, aeroporto, entrevista.', v: <VScenes />, span: 'md:col-span-4', h: 'h-[400px] md:h-[440px]' },
  { t: 'Comunidade de leitores', d: 'Momentos de leitura e pessoas.', v: <VPost />, span: 'md:col-span-4', h: 'h-[400px] md:h-[440px]', tone: 'warm' },
]

export function FeatureMosaic() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
      {TILES.map((x, i) => (
        <motion.div key={x.t} className={`${x.span} ${x.h} relative rounded-[24px] overflow-hidden flex flex-col s-noise ${x.tone === 'warm' ? 's-grad' : x.tone === 'card' ? '' : 's-grad-soft'}`}
          style={x.tone === 'card' ? { background: 'var(--site-card)', boxShadow: '0 0 0 1px var(--site-line)' } : undefined}
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-8%' }} transition={{ duration: 0.9, ease: EASE, delay: (i % 3) * 0.06 }}
          whileHover={{ y: -4 }}>
          <div className="px-6 pt-6 md:px-7 md:pt-7 relative z-10">
            <p className="s-card-title leading-snug">{x.t}</p>
            <p className="s-small">{x.d}</p>
          </div>
          <div className="flex-1 min-h-0 grid place-items-center px-5 pb-6 pt-2"><Fit>{x.v}</Fit></div>
        </motion.div>
      ))}
    </div>
  )
}
