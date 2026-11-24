// Páginas internas no mesmo padrão da Home: abertura centralizada, fotos humanas, blocos em tons suaves e respiro.
import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, BookOpen, Clock, Headphones, Mic, PenLine } from 'lucide-react'
import { ReportPreview } from '@/pages/proficiency/ReportPreview'
import { BAND_CEFR, SECTION_LABEL, SECTION_PLAN, type Section } from '@/lib/proficiencyApi'
import { SiteLayout } from '../SiteLayout'
import { PageOpening } from '../PageOpening'
import { useSeo } from '../ui'
import { FaqSection, FinalCta } from '../sections'
import { CompareTable, Pricing } from '../blocks'
import { SUPPORT_EMAIL, TUTORS, tutorImg } from '../content'
import { In, SectionHead, Tiles } from '../story/Showcase'
import '../story/story.css'

const EASE = [0.2, 0.8, 0.2, 1] as const

/** Abertura das páginas: o mesmo padrão editorial da home. */
function PageHero({ kicker, title, text, actions, children }: { kicker: string; title: ReactNode; text: string; actions?: ReactNode; children?: ReactNode }) {
  return <PageOpening kicker={kicker} title={title} text={text} actions={actions}>{children}</PageOpening>
}

const Primary = ({ to, children }: { to: string; children: ReactNode }) => <Link to={to} className="sc-btn sc-btn-dark">{children} <ArrowRight size={16} /></Link>
const Secondary = ({ to, children }: { to: string; children: ReactNode }) => <Link to={to} className="sc-btn sc-btn-line">{children}</Link>

/* ================================================================ Planos */

export function SitePlanos() {
  useSeo('Planos · Upoonly', 'Compare os planos do leitor Upoonly, as formas de pagamento e os créditos de cada assinatura.')
  return (
    <SiteLayout>
      <PageHero kicker="Planos" title={<>Escolha como quer <i>ler</i>.</>}
        text="O primeiro livro é seu no plano Grátis. Nos planos pagos, você abre toda a galeria e recebe novos créditos de IA a cada mês. No anual, você paga 20% menos." />
      <section className="sc-section sc-plans-wrap"><Pricing /></section>
      <section className="sc-section">
        <SectionHead kicker="Comparar" title={<>Os planos, <i>lado a lado</i>.</>} text="Limites de importação, conversas com os tutores e tudo o que vem em cada plano." />
        <In><CompareTable /></In>
      </section>
      <FaqSection ids={['pagar', 'creditos', 'presente', 'cancelar']} />
    </SiteLayout>
  )
}

/* ================================================================ Prova */

const examSections: { id: Section; icon: typeof BookOpen; description: string; tone: 'sage' | 'sand' | 'blush' | 'sky' }[] = [
  { id: 'reading', icon: BookOpen, description: 'Complete palavras e interprete textos do cotidiano e passagens acadêmicas.', tone: 'sage' },
  { id: 'listening', icon: Headphones, description: 'Ouça conversas, avisos e aulas curtas. Cada áudio toca uma vez.', tone: 'sky' },
  { id: 'writing', icon: PenLine, description: 'Monte frases, escreva um e-mail e defenda uma ideia em uma discussão.', tone: 'sand' },
  { id: 'speaking', icon: Mic, description: 'Repita frases e responda em voz alta às perguntas de uma entrevista.', tone: 'blush' },
]
const examMinutes = examSections.reduce((sum, s) => sum + SECTION_PLAN[s.id].minutes, 0)

export function SiteProva() {
  useSeo('Prova de proficiência · Upoonly', 'Avaliação de leitura, escuta, escrita e fala, com relatório e estimativa CEFR no plano Pro.')
  return (
    <SiteLayout>
      <section className="sc-thero sc-prova-hero">
        <div className="sc-thero-grid">
          <div className="sc-thero-copy">
            <In><p className="sc-kicker">Prova de proficiência · Plano Pro</p><h1 className="sc-hero-title sc-page-title">Seu inglês em <i>quatro habilidades</i>.</h1></In>
            <In delay={0.08}><p className="sc-lead">Leitura, escuta, escrita e fala em cerca de {examMinutes} minutos. O relatório mostra seu nível em cada habilidade, a estimativa CEFR e o que treinar a seguir.</p></In>
            <In delay={0.14}><div className="sc-hero-actions" style={{ justifyContent: 'flex-start' }}><Primary to="/signup?plano=pro">Começar com o Pro</Primary><Secondary to="/planos">Ver planos</Secondary></div></In>
          </div>
          <In delay={0.1} className="sc-prova-visual">
            <div className="theme-light sc-report" style={{ background: 'transparent' }}><ReportPreview /></div>
            <motion.div className="sc-prova-chip sc-prova-chip-a" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: 0.6 }}><b>B2</b><span>Independente avançado</span></motion.div>
            <motion.div className="sc-prova-chip sc-prova-chip-b" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: 0.85 }}><Mic size={15} /><span>Speaking · 4 de 6</span></motion.div>
          </In>
        </div>
      </section>

      <section className="sc-section">
        <SectionHead kicker={`Cerca de ${examMinutes} minutos`} title={<>Por dentro <i>da prova</i>.</>} text="Você faz as quatro seções em ordem, cada uma com seu cronômetro. As respostas são salvas durante a prova." />
        <div className="sc-tiles">
          {examSections.map(({ id, icon: Icon, description, tone }, k) => (
            <In key={id} delay={(k % 2) * 0.08} className="sc-tile-cell sc-span-6">
              <div className="sc-tile sc-fact" data-tone={tone}>
                <div className="sc-fact-top"><span className="sc-fact-icon"><Icon size={20} /></span><span className="sc-fact-min"><Clock size={14} />{SECTION_PLAN[id].minutes} min</span></div>
                <p className="sc-tile-title">{SECTION_LABEL[id].en}</p>
                <p className="sc-tile-text"><b>{SECTION_PLAN[id].items} itens.</b> {description}</p>
              </div>
            </In>
          ))}
        </div>
      </section>

      <section className="sc-section">
        <SectionHead kicker="Resultado" title={<>Uma faixa de 1 a 6, <i>e o seu CEFR</i>.</>} text="Leitura e escuta se adaptam ao seu desempenho. Escrita e fala recebem comentários por critério." />
        <In><div className="sc-levels">{[...BAND_CEFR].reverse().map(l => <div key={l.cefr}><b>{l.cefr}</b><span>{l.pt}</span><small>Faixa {l.band}</small></div>)}</div></In>
        <In><p className="sc-fineprint">Avaliação interna do Upoonly, inspirada no formato público do TOEFL iBT. A ETS não certifica a prova. O resultado serve para acompanhar seus estudos. O Pro inclui duas tentativas por mês.</p></In>
      </section>
      <FinalCta />
    </SiteLayout>
  )
}

/* ================================================================ Sobre */

export function SiteSobre() {
  useSeo('Sobre · Upoonly', 'Conheça o leitor, as histórias e os tutores do Upoonly.')
  return (
    <SiteLayout>
      <PageHero kicker="Sobre o Upoonly" title={<>A vontade de ler <i>mais uma página.</i></>}
        text="Foi do nosso amor pela leitura que nasceu o Upoonly. Queríamos levar para o estudo de inglês aquela vontade de ficar acordado só para descobrir o que acontece no próximo capítulo."
        actions={<><Primary to="/signup">Começar grátis</Primary><Secondary to="/recursos">Conhecer o leitor</Secondary></>} />
      <section className="sc-section">
        <div className="sc-split sc-story">
          <In className="sc-story-photo"><img src="/site/home/ouvir.webp" alt="Um jovem sorrindo enquanto ouve um livro em inglês no celular, no trem" /></In>
          <div>
            <In><p className="sc-kicker">Nossa história</p><h2 className="sc-title">Uma palavra fica quando <i>tem uma história.</i></h2></In>
            <In delay={0.06}><p className="sc-lead">Quem ama ler conhece a sensação de lembrar de uma fala anos depois de fechar o livro. A gente se lembra de quem falou, do que estava em jogo e até do silêncio que veio depois. Foi daí que veio a ideia de estudar outro idioma dentro de uma história.</p></In>
            <In delay={0.12}><p className="sc-lead">Imaginamos um leitor em que desse para parar numa frase, ouvir a voz do personagem e perguntar por que aquela palavra muda o sentido da cena. A IA entrou para acompanhar essa curiosidade. Depois, você pode escrever o que ouviu e contar a um tutor como teria respondido. O inglês que começou na voz de outra pessoa ganha a sua.</p></In>
          </div>
        </div>
      </section>
      <section className="sc-section">
        <SectionHead kicker="No que acreditamos" title={<>Um capítulo, <i>quatro jeitos de aprender.</i></>} text="Uma mesma passagem pode acompanhar você da primeira leitura até uma conversa inteira." />
        <Tiles tiles={[
          { title: 'Ler para descobrir', text: 'Siga o fio da história. Quando uma expressão despertar curiosidade, toque nela e descubra o que significa naquela cena.', to: '/leitor', tone: 'sand', span: 6 },
          { title: 'Escutar a cena', text: 'Ouça a narração acompanhando as palavras na tela. Uma pausa ou uma mudança de tom pode revelar a intenção de um personagem.', to: '/leitor', tone: 'blush', span: 6 },
          { title: 'Escrever de ouvido', text: 'No ditado, escute uma frase, escreva o que entendeu e compare com o trecho do livro.', to: '/pratica', tone: 'sage', span: 6 },
          { title: 'Falar com a sua voz', text: 'Você teria aberto aquela porta? Converse com um tutor de IA sobre as escolhas dos personagens. A resposta é sua, e há tempo para tentar de novo.', to: '/tutores', tone: 'sky', span: 6 },
        ]} />
      </section>
      <section className="sc-section">
        <In><div className="sc-numbers">
          <div><b>100+</b><span>livros em inglês, com capa e nível indicado</span></div>
          <div><b>16</b><span>estilos para ilustrar as páginas</span></div>
          <div><b>4</b><span>tutores para conversar por voz</span></div>
          <div><b>A1–C2</b><span>do primeiro conto ao Sherlock Holmes</span></div>
        </div></In>
      </section>
      <section className="sc-section">
        <SectionHead kicker="As vozes do Upoonly" title={<>Quem vai ler <i>com você</i>.</>} text="Cada tutor tem uma voz e um jeito de conversar. Escolha quem vai dividir a próxima leitura com você." />
        <div className="sc-cast">
          {TUTORS.map((t, k) => (
            <In key={t.id} delay={k * 0.06}>
              <Link to="/tutores" className="sc-cast-card" style={{ background: t.tint }}>
                <img src={tutorImg(t.id, true)} alt="" loading="lazy" />
                <div><p className="sc-tile-title">{t.name}</p><p className="sc-tile-text">{t.role}</p></div>
              </Link>
            </In>
          ))}
        </div>
      </section>
      <section id="contato" className="sc-section sc-note-line">
        <In><p className="sc-kicker">Fale com a gente</p><h2 className="sc-title">Sugestões, dúvidas <i>ou parcerias</i>?</h2>
          <p className="sc-lead" style={{ marginInline: 'auto' }}>Escreva para a nossa equipe. Respondemos sugestões de livros, dúvidas sobre a conta e propostas para escolas.</p>
          <Link className="sc-textlink" to="/contato">Abrir o formulário de contato <ArrowRight size={15} /></Link></In>
      </section>
      <FinalCta />
    </SiteLayout>
  )
}

/* ================================================================ Contato */

const CONTACT_SUBJECTS = ['Dúvida sobre a conta', 'Assinatura e pagamento', 'Sugestão de livro', 'Escolas e parcerias', 'Privacidade e dados', 'Denúncia', 'Outro']

const fieldStyle: CSSProperties = { width: '100%', padding: '13px 14px', border: '1px solid var(--site-line)', borderRadius: 8, background: 'var(--site-card, #fff)', color: 'var(--site-ink)', font: 'inherit', fontSize: 15 }
const labelStyle: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--site-ink)' }
const errStyle: CSSProperties = { fontSize: 12.5, color: '#a3322a', marginTop: 5 }

export function SiteContato() {
  useSeo('Contato · Upoonly', 'Fale com a equipe do Upoonly: dúvidas sobre a conta, assinatura, sugestões de livros e parcerias com escolas.')
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', website: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (form.name.trim().length < 2) e.name = 'Informe seu nome.'
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(form.email.trim())) e.email = 'Informe um e-mail válido.'
    if (!form.subject) e.subject = 'Escolha um assunto.'
    if (form.message.trim().length < 10) e.message = 'Escreva pelo menos 10 caracteres.'
    return e
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    if (!supabase) { setState('error'); setErrorMsg(`Envio indisponível agora. Escreva para ${SUPPORT_EMAIL}.`); return }
    setState('sending')
    const { data, error } = await supabase.functions.invoke('contact', { body: form })
    if (!error && data?.ok) { setState('sent'); return }
    let code = '', fields: Record<string, string> | undefined
    try { const b = await (error as { context?: Response })?.context?.json(); code = b?.error ?? ''; fields = b?.fields } catch { /* resposta sem corpo */ }
    if (fields) setErrors(fields)
    setState('error')
    setErrorMsg(code === 'rate_limited' ? 'Você enviou várias mensagens em pouco tempo. Tente de novo em uma hora.'
      : code === 'invalid_fields' ? 'Confira os campos destacados.'
      : `Não conseguimos enviar agora. Tente de novo ou escreva para ${SUPPORT_EMAIL}.`)
  }

  return (
    <SiteLayout>
      <PageHero kicker="Contato" title={<>Escreva para <i>a gente</i>.</>}
        text="Dúvidas sobre a conta, assinatura, sugestões de livros ou parcerias com escolas. Respondemos em até 2 dias úteis." />
      <section className="sc-section">
        <div style={{ maxWidth: 620, marginInline: 'auto' }}>
          {state === 'sent' ? (
            <In><div style={{ textAlign: 'center', padding: '40px 24px', border: '1px solid var(--site-line)', borderRadius: 10 }}>
              <p className="sc-kicker">Mensagem enviada</p>
              <h2 className="sc-title">Obrigado, <i>{form.name.split(' ')[0]}</i>.</h2>
              <p className="sc-lead" style={{ marginInline: 'auto' }}>Enviamos uma confirmação para {form.email}. Respondemos nesse endereço.</p>
            </div></In>
          ) : (
            <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                <div><label htmlFor="ct-name" style={labelStyle}>Nome</label>
                  <input id="ct-name" autoComplete="name" maxLength={120} value={form.name} onChange={set('name')} style={fieldStyle} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'ct-name-err' : undefined} />
                  {errors.name && <p id="ct-name-err" style={errStyle}>{errors.name}</p>}</div>
                <div><label htmlFor="ct-email" style={labelStyle}>E-mail</label>
                  <input id="ct-email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={set('email')} style={fieldStyle} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'ct-email-err' : undefined} />
                  {errors.email && <p id="ct-email-err" style={errStyle}>{errors.email}</p>}</div>
              </div>
              <div><label htmlFor="ct-subject" style={labelStyle}>Assunto</label>
                <select id="ct-subject" value={form.subject} onChange={set('subject')} style={fieldStyle} aria-invalid={!!errors.subject}>
                  <option value="" disabled>Escolha um assunto</option>
                  {CONTACT_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.subject && <p style={errStyle}>{errors.subject}</p>}</div>
              <div><label htmlFor="ct-message" style={labelStyle}>Mensagem</label>
                <textarea id="ct-message" rows={7} maxLength={5000} value={form.message} onChange={set('message')} style={{ ...fieldStyle, resize: 'vertical' }} aria-invalid={!!errors.message} />
                {errors.message && <p style={errStyle}>{errors.message}</p>}</div>
              {/* Honeypot: invisível para pessoas, bots costumam preencher. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
                <label htmlFor="ct-website">Site</label>
                <input id="ct-website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
              </div>
              {state === 'error' && <p role="alert" style={{ ...errStyle, fontSize: 14 }}>{errorMsg}</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, justifyContent: 'space-between' }}>
                <p style={{ fontSize: 12.5, color: 'var(--site-muted)', maxWidth: 360 }}>Usamos seus dados só para responder. Veja a <Link to="/privacy" className="s-link">política de privacidade</Link>.</p>
                <button type="submit" className="sc-btn sc-btn-dark" disabled={state === 'sending'}>{state === 'sending' ? 'Enviando…' : 'Enviar mensagem'} <ArrowRight size={16} /></button>
              </div>
            </form>
          )}
          <p style={{ textAlign: 'center', marginTop: 32, fontSize: 14, color: 'var(--site-muted)' }}>Prefere e-mail? <a className="s-link" href={'mailto:' + SUPPORT_EMAIL}>{SUPPORT_EMAIL}</a></p>
        </div>
      </section>
      <FaqSection ids={['cancelar', 'pagar', 'excluir-conta']} title={<>Antes de escrever,<br />veja se já respondemos.</>} />
    </SiteLayout>
  )
}
