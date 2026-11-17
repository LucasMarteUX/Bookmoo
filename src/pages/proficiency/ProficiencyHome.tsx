// Página principal da English Proficiency Test: apresentação, estrutura, dinâmica, regras, escala e histórico.
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Award, Ban, BookOpen, ChevronDown, Clock, FileText, GitBranch, Headphones, Lock, Mic, PenLine, Printer, RotateCcw, Save, ShieldCheck, Sparkles, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { openPaywall } from '@/components/billing/Paywall'
import { characterAvatarUrl } from '@/lib/livliv/characters'
import { BAND_CEFR, fmtBand, proficiency, profErrorText, SECTION_LABEL, SECTION_PLAN, TASK_LABEL, type Overview, type Section } from '@/lib/proficiencyApi'

const muted = { color: 'var(--theme-text-secondary)' }
const cardStyle = { borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }
const ICON: Record<Section, typeof BookOpen> = { reading: BookOpen, listening: Headphones, writing: PenLine, speaking: Mic }
const ORDER: Section[] = ['reading', 'listening', 'writing', 'speaking']
const title = (s: Section) => s[0].toUpperCase() + s.slice(1)
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
const TOTAL_MIN = ORDER.reduce((a, s) => a + SECTION_PLAN[s].minutes, 0)

export function ProficiencyHome() {
  const nav = useNavigate()
  const [ov, setOv] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { proficiency.overview().then(setOv, e => setError(profErrorText(e))) }, [])

  const cooling = ov?.nextAvailableAt && new Date(ov.nextAvailableAt) > new Date() ? ov.nextAvailableAt : null
  const scoring = ov?.active?.status === 'scoring'
  const cta = () => {
    if (!ov) return
    if (scoring) return nav(`/prova/resultado/${ov.active!.id}`)
    if (!ov.premium) return openPaywall('proficiency')
    nav('/prova/sessao')
  }
  const ctaLabel = !ov ? 'Carregando…'
    : scoring ? 'Acompanhar a avaliação'
    : ov.active ? 'Retomar a prova'
    : !ov.premium ? 'Liberar com o plano Pro'
    : !ov.available ? 'Em preparação'
    : cooling ? `Nova prova em ${fmtDate(cooling)}`
    : 'Começar a prova'
  const ctaDisabled = !ov || (!ov.active && ov.premium && (!ov.available || !!cooling))
  const last = ov?.history.find(h => h.status === 'final')

  return (
    <div className="max-w-5xl mx-auto pb-24 md:pb-16">
      {/* Abertura */}
      <section className="relative overflow-hidden rounded-[28px] border px-5 py-7 sm:px-8 sm:py-10 md:px-12 md:py-14" style={cardStyle}>
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 h-7 font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}><Award className="w-3.5 h-3.5" />Plano Pro</span>
              <span className="inline-flex items-center rounded-full px-2.5 h-7 border" style={{ borderColor: 'var(--theme-border)', ...muted }}>4 habilidades · {TOTAL_MIN} min</span>
            </div>
            <h1 className="mt-5 font-display text-[44px] sm:text-[56px] md:text-[68px] leading-[0.92] tracking-[-0.02em]">English<br />Proficiency Test</h1>
            <p className="mt-5 text-[16px] md:text-[17.5px] leading-relaxed max-w-lg" style={muted}>
              Descubra o seu nível real em leitura, compreensão auditiva, escrita e fala, numa prova completa no formato dos exames
              internacionais. Ao final, um relatório detalhado e o seu selo CEFR no perfil.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={cta} disabled={ctaDisabled} className="hidden md:inline-flex h-12 px-6 text-[15.5px]">
                {!ov?.premium && ov ? <Lock className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                {ctaLabel}
              </Button>
              <a href="#como-funciona" className="inline-flex items-center gap-1 h-12 px-2 text-[14.5px] font-medium" style={muted}>Como funciona<ChevronDown className="w-4 h-4" /></a>
            </div>
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
          <Step n={3} icon={<Mic className="w-4 h-4" />} title="Entrevista" text="No Speaking, um tutor do Bookmoo conduz a entrevista: pergunta, escuta e passa para a próxima." />
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
          <Rule icon={<RotateCcw className="w-4 h-4" />} title="Uma por semana" text="Depois de concluir, uma nova prova fica disponível em 7 dias." />
        </ul>
      </section>

      {/* Escala */}
      <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-start">
        <div>
          <H2 kicker="Resultado" title="Escala de 1 a 6, com selo CEFR" />
          <p className="mt-4 text-[14.5px] leading-relaxed" style={muted}>
            Cada habilidade recebe uma faixa de 1 a 6, em meios pontos, e a nota geral é a média das quatro. A faixa geral vira o
            seu selo CEFR, que aparece no perfil ao lado do seu nível no Bookmoo. Reading e Listening são corrigidas
            automaticamente; Writing e Speaking por IA, com rubricas publicadas e citando as suas próprias palavras.
          </p>
          <ul className="mt-5 space-y-2 text-[14px]">
            <li className="flex gap-2"><Sparkles className="w-4 h-4 mt-0.5 shrink-0" />Análise de pontos fortes e do que melhorar em cada habilidade</li>
            <li className="flex gap-2"><Printer className="w-4 h-4 mt-0.5 shrink-0" />Relatório para imprimir ou salvar em PDF</li>
            <li className="flex gap-2"><ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />Sem resposta suficiente, a habilidade fica inconclusiva em vez de receber uma nota injusta</li>
          </ul>
        </div>
        <div className="rounded-2xl border overflow-hidden" style={cardStyle}>
          {BAND_CEFR.map((r, i) => (
            <div key={r.cefr} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 px-5 py-3 border-t first:border-t-0" style={{ borderColor: 'var(--theme-border)' }}>
              <span className="grid place-items-center h-9 rounded-lg font-semibold tabular-nums text-[14px]" style={i === 0 ? { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' } : { backgroundColor: 'var(--theme-bg-secondary)' }}>{r.cefr}</span>
              <span className="text-[14px]">{r.pt}</span>
              <span className="text-[13px] tabular-nums" style={muted}>faixa {r.band}</span>
            </div>
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
        A English Proficiency Test é uma avaliação do Bookmoo inspirada no formato público do TOEFL iBT. Não é um exame oficial, não é
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
function ReportPreview() {
  const bars: [Section, number][] = [['reading', 4.5], ['listening', 4], ['writing', 3.5], ['speaking', 4]]
  return (
    <div className="relative mx-auto w-full max-w-[420px]" aria-label="Exemplo de relatório">
      <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }} aria-hidden />
      <div className="relative rounded-3xl border p-6" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)' }}>
        <div className="flex items-center justify-between text-[11.5px] uppercase tracking-[0.08em]" style={muted}><span>Relatório de resultado</span><span>Exemplo</span></div>
        <div className="mt-5 flex items-center gap-5">
          <ScoreDial value={4} size={112} />
          <div>
            <p className="text-[12.5px]" style={muted}>Faixa geral</p>
            <p className="font-display text-[40px] leading-none tabular-nums">4,0</p>
            <span className="mt-2 inline-flex items-center gap-1.5 h-7 px-2 rounded-md border text-[12.5px] font-semibold" style={{ borderColor: 'var(--theme-text)' }}><Award className="w-3.5 h-3.5" />B2</span>
          </div>
        </div>
        <ul className="mt-6 space-y-3">
          {bars.map(([s, b]) => (
            <li key={s}>
              <div className="flex justify-between text-[13px]"><span>{title(s)}</span><span className="tabular-nums font-medium">{fmtBand(b)}</span></div>
              <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}><div className="h-full rounded-full" style={{ width: `${((b - 1) / 5) * 100}%`, backgroundColor: 'var(--theme-text)' }} /></div>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[12.5px] leading-relaxed rounded-xl p-3" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>“Você organiza bem as ideias no e-mail. Para subir, varie os conectores e desenvolva mais os exemplos.”</p>
      </div>
    </div>
  )
}

/** Mostrador semicircular da faixa (1 a 6). */
export function ScoreDial({ value, size = 140 }: { value: number | null; size?: number }) {
  const r = 44, c = Math.PI * r
  const frac = value == null ? 0 : (value - 1) / 5
  return (
    <svg viewBox="0 0 100 60" width={size} height={size * 0.6} aria-hidden>
      <path d="M6 54 A44 44 0 0 1 94 54" fill="none" stroke="var(--theme-bg-secondary)" strokeWidth="9" strokeLinecap="round" />
      <path d="M6 54 A44 44 0 0 1 94 54" fill="none" stroke="var(--theme-text)" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
    </svg>
  )
}

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
