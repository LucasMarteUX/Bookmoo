// Página principal da English Proficiency Test: apresentação, estrutura, dinâmica, regras, escala e histórico.
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Award, Ban, BookOpen, ChevronDown, Clock, FileText, GitBranch, Headphones, Lock, Mic, PenLine, Printer, RotateCcw, Save, ShieldCheck, Sparkles, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportPreview } from './ReportPreview'
import { openPaywall } from '@/components/billing/Paywall'
import { characterAvatarUrl } from '@/lib/livliv/characters'
import { BAND_CEFR, fmtBand, proficiency, profErrorText, SECTION_LABEL, SECTION_PLAN, TASK_LABEL, type Overview, type Section } from '@/lib/proficiencyApi'

const muted = { color: 'var(--theme-text-secondary)' }
const cardStyle = { borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }
const ICON: Record<Section, typeof BookOpen> = { reading: BookOpen, listening: Headphones, writing: PenLine, speaking: Mic }
const ORDER: Section[] = ['reading', 'listening', 'writing', 'speaking']
const title = (s: Section) => s[0].toUpperCase() + s.slice(1)
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
const CEFR_DETAIL: Record<string, { can: string; does: string[]; example: string }> = {
  C2: { can: 'Entende praticamente tudo o que lê e ouve e se expressa com precisão, fluidez e nuance.', does: ['Lê textos literários e técnicos complexos', 'Percebe ironia, humor e sentidos implícitos', 'Ajusta o tom com naturalidade em qualquer situação'], example: 'Her remark was tongue-in-cheek, yet it struck a nerve.' },
  C1: { can: 'Usa o inglês de forma flexível e eficaz no trabalho, nos estudos e na vida social.', does: ['Acompanha palestras e reuniões longas', 'Escreve textos claros e bem estruturados sobre temas complexos', 'Argumenta e reformula sem procurar palavras'], example: "It's not so much the cost as the hidden trade-offs that worry me." },
  B2: { can: 'Interage com fluência e espontaneidade e entende as ideias principais de textos complexos.', does: ['Conversa com nativos sem esforço para nenhum dos lados', 'Defende um ponto de vista com prós e contras', 'Entende séries e notícias com algum esforço'], example: "I see your point, but I'd argue that remote work actually helps." },
  B1: { can: 'Lida com a maioria das situações de viagem e fala de experiências, planos e opiniões.', does: ['Entende o principal de conversas claras sobre temas conhecidos', 'Conta uma história ou descreve um acontecimento', 'Escreve textos simples e conectados'], example: 'Last year I went to Chile and the food was amazing because…' },
  A2: { can: 'Comunica-se em tarefas simples e rotineiras sobre assuntos familiares.', does: ['Fala de rotina, família, compras e trabalho', 'Entende frases do dia a dia ditas devagar', 'Escreve mensagens curtas'], example: 'I usually wake up at seven and take the bus to work.' },
  A1: { can: 'Entende e usa expressões do dia a dia e frases muito simples.', does: ['Apresenta-se e faz perguntas básicas', 'Entende números, preços e horários', 'Preenche formulários simples'], example: 'Hi, my name is Ana. I am from Brazil.' },
}
const RUBRICS: { t: string; s: string; c: [string, string][] }[] = [
  { t: 'Reading e Listening', s: 'Correção automática pelo gabarito, adaptativa', c: [['1', 'Cada item vale um ponto; lacunas comparam as letras digitadas.'], ['2', 'A primeira parte define o módulo da segunda: 60% ou mais leva ao desafiador.'], ['3', 'A faixa combina 40% da primeira parte e 60% da segunda.']] },
  { t: 'Write an Email', s: 'Rubrica de 0 a 5', c: [['5', 'Cumpre os três pontos pedidos, bem organizado, tom adequado, vocabulário variado e poucos erros.'], ['3', 'Cumpre os pontos com partes pouco desenvolvidas; erros perceptíveis que raramente atrapalham.'], ['1', 'Pouco conteúdo relevante e erros frequentes que dificultam o sentido.']] },
  { t: 'Academic Discussion', s: 'Rubrica de 0 a 5', c: [['5', 'Contribuição relevante com ideia própria, bem explicada, linguagem precisa e variada.'], ['3', 'Relevante, mas pouco desenvolvida ou parcialmente clara.'], ['1', 'Pouco conteúdo relevante; repete os colegas ou foge do tema.']] },
  { t: 'Speaking', s: 'Repetição pela precisão e entrevista de 0 a 5', c: [['5', 'Responde por completo, com desenvolvimento, boa variedade e fala contínua nos 45 segundos.'], ['3', 'Responde com desenvolvimento limitado, pausas ou erros perceptíveis.'], ['1', 'Pouca fala relevante, palavras soltas.']] },
]
const TOTAL_MIN = ORDER.reduce((a, s) => a + SECTION_PLAN[s].minutes, 0)

export function ProficiencyHome() {
  const nav = useNavigate()
  const [ov, setOv] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { proficiency.overview().then(setOv, e => setError(profErrorText(e))) }, [])

  const cooling = ov?.nextAvailableAt && new Date(ov.nextAvailableAt) > new Date() ? ov.nextAvailableAt : null
  const scoring = ov?.scoring ?? null
  const used = ov?.monthUsed ?? 0
  const cta = () => {
    if (!ov) return
    if (!ov.premium) return openPaywall('proficiency')
    nav('/prova/sessao')
  }
  const ctaLabel = !ov ? 'Carregando…'
    : ov.active ? 'Retomar a prova'
    : !ov.premium ? 'Liberar com o plano Pro'
    : !ov.available ? 'Em preparação'
    : cooling ? `Nova tentativa em ${fmtDate(cooling)}`
    : used > 0 ? `Fazer a ${used + 1}ª tentativa` : 'Começar a prova'
  const ctaDisabled = !ov || (!ov.active && ov.premium && (!ov.available || !!cooling))
  const last = ov?.history.find(h => h.status === 'final')

  return (
    <div className="max-w-6xl mx-auto pb-24 md:pb-16">
      {/* Abertura */}
      <section className="relative overflow-hidden rounded-[28px] border px-5 py-7 sm:px-8 sm:py-10 md:px-12 md:py-14" style={cardStyle}>
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 h-7 font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}><Award className="w-3.5 h-3.5" />Plano Pro</span>
              <span className="inline-flex items-center rounded-full px-2.5 h-7 border" style={{ borderColor: 'var(--theme-border)', ...muted }}>4 habilidades · {TOTAL_MIN} min</span>
            </div>
            <h1 className="mt-5 font-display text-[44px] sm:text-[56px] md:text-[68px] leading-[0.92] tracking-[-0.02em]">English<br />Proficiency</h1>
            <p className="mt-5 text-[16px] md:text-[17.5px] leading-relaxed max-w-lg" style={muted}>
              Descubra seu nível de inglês em uma prova completa de leitura, compreensão auditiva, escrita e fala, com atividades
              inspiradas nos exames internacionais. Ao final, receba um relatório detalhado, uma estimativa do seu nível CEFR e um
              selo exclusivo no seu perfil.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={cta} disabled={ctaDisabled} className="hidden md:inline-flex h-12 px-6 text-[15.5px]">
                {!ov?.premium && ov ? <Lock className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                {ctaLabel}
              </Button>
              {scoring
                ? <Button size="lg" variant="outline" onClick={() => nav(`/prova/resultado/${scoring.id}`)} className="h-12">Acompanhar a avaliação</Button>
                : <a href="#como-funciona" className="inline-flex items-center gap-1 h-12 px-2 text-[14.5px] font-medium" style={muted}>Como funciona<ChevronDown className="w-4 h-4" /></a>}
            </div>
            {ov?.premium && (
              <p className="mt-3 text-[13px] tabular-nums" style={muted}>
                {ov.monthUsed ?? 0} de {ov.monthLimit ?? 2} tentativas este mês{ov.monthBest != null ? ` · maior nota ${fmtBand(ov.monthBest)}` : ''}
              </p>
            )}
            {error && <p role="alert" className="mt-3 text-[13.5px]" style={{ color: 'var(--pastel-rose-fg)' }}>{error}</p>}
            {last && (
              <Link to={`/prova/resultado/${last.id}`} className="mt-6 inline-flex items-center gap-3 rounded-2xl border px-4 py-3 hover:bg-[var(--ui-hover)] transition-colors" style={{ borderColor: 'var(--theme-border)' }}>
                <span className="font-display text-[28px] leading-none tabular-nums">{fmtBand(last.overall)}</span>
                <span className="text-[13px] leading-tight"><span className="block font-semibold">Seu último resultado · {last.cefr}</span><span style={muted}>{fmtDate(last.created_at)} · ver relatório</span></span>
              </Link>
            )}
          </div>
          <ReportPreview />
        </div>
      </section>

      {/* Linha do tempo das seções */}
      <section className="mt-14">
        <H2 kicker="Estrutura" title="Quatro seções, uma depois da outra" sub="Cada seção tem o seu cronômetro. Não dá para escolher a ordem nem voltar a uma seção encerrada." />
        <div className="mt-6 flex h-3 rounded-full overflow-hidden gap-[3px]" aria-hidden>
          {ORDER.map((s, i) => <div key={s} style={{ flex: SECTION_PLAN[s].minutes, backgroundColor: 'var(--theme-text)', opacity: 1 - i * 0.18 }} />)}
        </div>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ORDER.map((s, i) => {
            const Icon = ICON[s]
            const p = SECTION_PLAN[s]
            return (
              <li key={s} className="rounded-2xl border p-5 flex flex-col" style={cardStyle}>
                <div className="flex items-center justify-between">
                  <span className="grid place-items-center w-11 h-11 rounded-xl" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}><Icon className="w-5 h-5" /></span>
                  <span className="text-[12px] tabular-nums font-semibold" style={muted}>0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-display text-[26px] leading-none">{title(s)}</h3>
                <p className="mt-1 text-[13px]" style={muted}>{SECTION_LABEL[s].pt}</p>
                <p className="mt-3 text-[13.5px] tabular-nums font-medium">{p.items} itens · {p.minutes} min</p>
                <ul className="mt-3 pt-3 border-t space-y-1.5 text-[13.5px]" style={{ borderColor: 'var(--theme-border)' }}>
                  {p.tasks.map(t => <li key={t}>{TASK_LABEL[t]}</li>)}
                </ul>
              </li>
            )
          })}
        </ol>
      </section>

      {/* Dinâmica */}
      <section id="como-funciona" className="mt-14 scroll-mt-20">
        <H2 kicker="Dinâmica" title="Do primeiro clique ao relatório" />
        <ol className="mt-6 relative grid gap-4 md:grid-cols-4">
          <Step n={1} icon={<Volume2 className="w-4 h-4" />} title="Checagem" text="Você testa o som e o microfone e aceita a gravação da voz. A prova abre em tela cheia." />
          <Step n={2} icon={<Clock className="w-4 h-4" />} title="As quatro seções" text="Cerca de 90 minutos, com instruções antes de cada seção. O relógio só começa quando você toca em Começar." />
          <Step n={3} icon={<Mic className="w-4 h-4" />} title="Entrevista" text="No Speaking, um tutor do Upoonly conduz a entrevista: pergunta, escuta e passa para a próxima." />
          <Step n={4} icon={<FileText className="w-4 h-4" />} title="Relatório" text="A correção leva alguns minutos. Você pode continuar estudando: o app avisa quando o relatório ficar pronto." />
        </ol>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border p-6 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center" style={cardStyle}>
            <div>
              <p className="text-[15.5px] font-semibold flex items-center gap-2"><GitBranch className="w-4 h-4" />Adaptativa</p>
              <p className="mt-2 text-[14px] leading-relaxed" style={muted}>
                Em Reading e Listening, a primeira parte tem dificuldade média. Acertando 60% ou mais, a segunda parte fica mais
                desafiadora e permite as faixas mais altas. A regra é a mesma para todos.
              </p>
            </div>
            <RouteDiagram />
          </div>
          <div className="rounded-2xl border p-6 flex gap-5 items-center" style={cardStyle}>
            <img src={characterAvatarUrl('bookmoo-mulher')} alt="" className="w-24 h-24 rounded-full object-cover shrink-0" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
            <div>
              <p className="text-[15.5px] font-semibold">Entrevista com a Bia</p>
              <p className="mt-2 text-[14px] leading-relaxed" style={muted}>
                A tutora faz quatro perguntas, uma de cada vez, com até 45 segundos para cada resposta. Fale com naturalidade:
                não há texto na tela, como numa conversa de verdade.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Regras */}
      <section className="mt-14">
        <H2 kicker="Regras" title="Combinado antes de começar" />
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Rule icon={<Clock className="w-4 h-4" />} title="Tempo rígido" text="Quando o relógio zera, a parte é encerrada com o que você respondeu." />
          <Rule icon={<Ban className="w-4 h-4" />} title="Sem voltar" text="As seções seguem a ordem e uma parte encerrada não reabre." />
          <Rule icon={<Volume2 className="w-4 h-4" />} title="Áudio uma vez" text="Cada áudio toca uma única vez, sem transcrição. Use fone de ouvido." />
          <Rule icon={<ShieldCheck className="w-4 h-4" />} title="Sem ajuda" text="Sem dicas, tradução, dicionário ou IA, e nenhuma nota antes do fim." />
          <Rule icon={<Save className="w-4 h-4" />} title="Tudo salvo" text="Cada resposta é salva na hora. Se a conexão cair, você retoma de onde parou." />
          <Rule icon={<RotateCcw className="w-4 h-4" />} title="Duas tentativas por mês" text="Não gostou do resultado? Faça de novo no mesmo mês: o selo fica com a sua maior nota. Toda prova iniciada conta como tentativa." />
        </ul>
      </section>

      {/* Escala */}
      <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-start">
        <div>
          <H2 kicker="Resultado" title="Escala de 1 a 6, com nível CEFR" />
          <p className="mt-4 text-[14.5px] leading-relaxed" style={muted}>
            Cada habilidade recebe uma faixa de 1 a 6, em meios pontos, e a nota geral é a média das quatro. A faixa geral vira o
            seu selo CEFR, que aparece no perfil ao lado do seu nível no Upoonly. Reading e Listening são corrigidas
            automaticamente; Writing e Speaking por IA, com rubricas publicadas e citando as suas próprias palavras.
          </p>
          <ul className="mt-5 space-y-2 text-[14px]">
            <li className="flex gap-2"><Sparkles className="w-4 h-4 mt-0.5 shrink-0" />Análise de pontos fortes e do que melhorar em cada habilidade</li>
            <li className="flex gap-2"><Printer className="w-4 h-4 mt-0.5 shrink-0" />Relatório para imprimir ou salvar em PDF</li>
            <li className="flex gap-2"><ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />Sem resposta suficiente, a habilidade fica inconclusiva em vez de receber uma nota injusta</li>
          </ul>
        </div>
        <div className="rounded-2xl border overflow-hidden" style={cardStyle}>
          {BAND_CEFR.map((r, i) => {
            const d = CEFR_DETAIL[r.cefr]
            return (
              <details key={r.cefr} className="group [&:not(:first-child)]:border-t" style={{ borderColor: 'var(--theme-border)' }} open={i === 2}>
                <summary className="list-none cursor-pointer grid grid-cols-[56px_1fr_auto_16px] items-center gap-4 px-5 py-3.5 hover:bg-[var(--ui-hover)] transition-colors [&::-webkit-details-marker]:hidden">
                  <span className="grid place-items-center h-9 rounded-lg font-semibold tabular-nums text-[14px] bg-[var(--theme-bg-secondary)] text-[var(--theme-text)] group-open:bg-[var(--theme-primary)] group-open:text-[var(--theme-primary-text)]">{r.cefr}</span>
                  <span className="text-[14.5px] font-medium">{r.pt}</span>
                  <span className="text-[12.5px] tabular-nums" style={muted}>faixa {r.band}</span>
                  <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" style={muted} />
                </summary>
                <div className="pt-1 pb-5 pl-[92px] pr-[52px] max-sm:pl-5 max-sm:pr-5 space-y-3 text-[13.5px] leading-relaxed">
                  <p>{d.can}</p>
                  <ul className="space-y-1.5" style={muted}>{d.does.map(x => <li key={x} className="flex gap-2"><span className="mt-2 w-1 h-1 shrink-0 rounded-full" style={{ backgroundColor: 'var(--theme-text-secondary)' }} />{x}</li>)}</ul>
                  <p className="rounded-xl px-3 py-2 italic" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>“{d.example}”</p>
                </div>
              </details>
            )
          })}
        </div>
      </section>

      {/* Rubricas */}
      <section className="mt-14">
        <H2 kicker="Como avaliamos" title="Critérios claros em cada habilidade" sub="As respostas objetivas seguem o gabarito. Escrita e fala recebem de 0 a 5 em cada tarefa, por estes critérios, e a avaliação cita as suas próprias palavras." />
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {RUBRICS.map(r => (
            <details key={r.t} className="group rounded-2xl border p-5 open:pb-6" style={cardStyle}>
              <summary className="list-none cursor-pointer flex items-center justify-between gap-3">
                <span><span className="block text-[15px] font-semibold">{r.t}</span><span className="block text-[13px]" style={muted}>{r.s}</span></span>
                <ChevronDown className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180" style={muted} />
              </summary>
              <ul className="mt-4 space-y-2 text-[13.5px] leading-relaxed">
                {r.c.map(([k, v]) => <li key={k} className="grid grid-cols-[26px_1fr] gap-2"><span className="font-semibold tabular-nums">{k}</span><span style={muted}>{v}</span></li>)}
              </ul>
            </details>
          ))}
        </div>
      </section>

      {/* Histórico */}
      {!!ov?.history.length && (
        <section className="mt-14">
          <H2 kicker="Histórico" title="Suas provas" />
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {ov.history.map(h => (
              <li key={h.id}>
                <Link to={`/prova/resultado/${h.id}`} className="block rounded-2xl border p-5 hover:bg-[var(--ui-hover)] transition-colors" style={cardStyle}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[13px]" style={muted}>{fmtDate(h.created_at)}</p>
                      <p className="mt-1 font-display text-[34px] leading-none tabular-nums">{h.status === 'inconclusive' ? '–' : fmtBand(h.overall)}</p>
                    </div>
                    <span className="h-8 px-2.5 inline-flex items-center rounded-lg text-[13px] font-semibold border" style={{ borderColor: 'var(--theme-border)' }}>{h.status === 'inconclusive' ? 'Inconclusiva' : h.cefr}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {ORDER.map(s => {
                      const b = h.bands[s] ?? null
                      return (
                        <div key={s}>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}><div className="h-full" style={{ width: `${b ? ((b - 1) / 5) * 100 : 0}%`, backgroundColor: 'var(--theme-text)' }} /></div>
                          <p className="mt-1 text-[11.5px] tabular-nums" style={muted}>{title(s).slice(0, 1)} {fmtBand(b)}</p>
                        </div>
                      )
                    })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-14 text-[12.5px] leading-relaxed max-w-2xl" style={muted}>
        A English Proficiency Test é uma avaliação do Upoonly inspirada no formato público do TOEFL iBT. Não é um exame oficial, não é
        afiliada nem certificada pela ETS e não tem equivalência oficial com nenhuma prova ou certificado. As questões são originais.
      </p>

      {/* Botão fixo no celular */}
      <div className="md:hidden fixed inset-x-0 z-30 px-4 pt-3 border-t" style={{ bottom: 'calc(var(--tabbar-h, 0px))', paddingBottom: 'calc(12px + var(--safe-b, 0px))', backgroundColor: 'var(--theme-bg)', borderColor: 'var(--theme-border)' }}>
        <Button size="lg" onClick={cta} disabled={ctaDisabled} className="w-full">{!ov?.premium && ov ? <Lock className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}{ctaLabel}</Button>
      </div>
    </div>
  )
}

/** Prévia ilustrativa do relatório (dados de exemplo, rotulados como tal). */
function H2({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <header className="max-w-2xl">
      <p className="text-[12px] uppercase tracking-[0.1em] font-semibold" style={muted}>{kicker}</p>
      <h2 className="mt-1.5 font-display text-[30px] md:text-[38px] leading-[1.05]">{title}</h2>
      {sub && <p className="mt-2 text-[14.5px] leading-relaxed" style={muted}>{sub}</p>}
    </header>
  )
}

function Step({ n, icon, title, text }: { n: number; icon: ReactNode; title: string; text: string }) {
  return (
    <li className="rounded-2xl border p-5" style={cardStyle}>
      <div className="flex items-center justify-between">
        <span className="grid place-items-center w-9 h-9 rounded-full" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{icon}</span>
        <span className="font-display text-[28px] leading-none tabular-nums" style={muted}>{n}</span>
      </div>
      <p className="mt-4 text-[15.5px] font-semibold">{title}</p>
      <p className="mt-1 text-[13.5px] leading-relaxed" style={muted}>{text}</p>
    </li>
  )
}

function Rule({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <li className="rounded-2xl border p-5 flex gap-3" style={cardStyle}>
      <span className="mt-0.5 grid place-items-center w-9 h-9 shrink-0 rounded-xl" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{icon}</span>
      <div>
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[13.5px] leading-relaxed" style={muted}>{text}</p>
      </div>
    </li>
  )
}

/** Roteamento: parte 1 → (≥ 60%) módulo desafiador, (< 60%) módulo acessível. */
function RouteDiagram() {
  const stroke = 'var(--theme-text-secondary)'
  const box = (x: number, y: number, w: number, label: string, sub: string, strong = false) => (
    <g>
      <rect x={x} y={y} width={w} height={44} rx={10} fill={strong ? 'var(--theme-primary)' : 'var(--theme-bg-secondary)'} stroke="var(--theme-border)" />
      <text x={x + w / 2} y={y + 19} textAnchor="middle" fontSize="12.5" fontWeight="600" fill={strong ? 'var(--theme-primary-text)' : 'var(--theme-text)'}>{label}</text>
      <text x={x + w / 2} y={y + 34} textAnchor="middle" fontSize="10.5" fill={strong ? 'var(--theme-primary-text)' : 'var(--theme-text-secondary)'} opacity={strong ? 0.8 : 1}>{sub}</text>
    </g>
  )
  return (
    <svg viewBox="0 0 250 120" className="w-full max-w-[260px] h-auto" role="img" aria-label="A parte 1 leva ao módulo desafiador com 60% ou mais, ou ao acessível abaixo disso">
      {box(2, 38, 76, 'Parte 1', 'média', true)}
      <path d="M78 60 C 104 60, 104 24, 130 24" fill="none" stroke={stroke} strokeWidth="1.5" />
      <path d="M78 60 C 104 60, 104 96, 130 96" fill="none" stroke={stroke} strokeWidth="1.5" />
      <text x={104} y={14} textAnchor="middle" fontSize="9.5" fill="var(--theme-text-secondary)">60%+</text>
      {box(130, 2, 118, 'Desafiador', 'faixas 2,5 a 6')}
      {box(130, 74, 118, 'Acessível', 'faixas 1 a 4')}
    </svg>
  )
}
