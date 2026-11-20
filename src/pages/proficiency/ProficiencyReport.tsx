// Relatório da English Proficiency Test: capa com a faixa geral e o selo CEFR, as quatro habilidades, desempenho por tipo
// de tarefa, avaliação por rubrica com as palavras da pessoa e próximos passos. "Salvar PDF" usa a impressão do navegador
// com um layout próprio (A4, tema claro, sem menus).
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Award, BookOpen, GitBranch, Headphones, Mic, PenLine, Printer, Quote, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { useMyAvatar } from '@/hooks/useMyAvatar'
import { BAND_CEFR, fmtBand, proficiency, profErrorText, SECTION_LABEL, type Result, type Section, type SectionResult, type SkillReport } from '@/lib/proficiencyApi'
import { ScoringWait } from './ScoringWait'
import { ScoreDial } from './ReportPreview'

const muted = { color: 'var(--theme-text-secondary)' }
const cardStyle = { borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }
const ORDER: Section[] = ['reading', 'listening', 'writing', 'speaking']
const ICON: Record<Section, typeof BookOpen> = { reading: BookOpen, listening: Headphones, writing: PenLine, speaking: Mic }
const title = (s: Section) => s[0].toUpperCase() + s.slice(1)
const REASON: Record<string, string> = {
  few_answers: 'Menos da metade das questões foi respondida.',
  too_little_writing: 'Os textos foram curtos demais para uma avaliação justa.',
  too_little_speech: 'Não houve fala reconhecível suficiente nas gravações.',
}
const CEFR_TEXT: Record<string, string> = {
  A1: 'Entende e usa expressões do dia a dia e frases muito simples.',
  A2: 'Comunica-se em tarefas simples e rotineiras sobre assuntos familiares.',
  B1: 'Lida com a maioria das situações de viagem e descreve experiências e opiniões.',
  B2: 'Interage com fluência e espontaneidade e entende textos complexos sobre temas concretos e abstratos.',
  C1: 'Usa o idioma de forma flexível e eficaz em contextos sociais, acadêmicos e profissionais.',
  C2: 'Compreende praticamente tudo e se expressa com precisão e nuance.',
}

export function ProficiencyReport() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const [res, setRes] = useState<Result | null>(null)
  const [status, setStatus] = useState<string>('loading')
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    if (import.meta.env.DEV && params.get('demo') === '1') {
      const { DEMO_RESULT } = await import('./reportDemo')
      setRes(DEMO_RESULT); setStatus('scored'); return
    }
    try {
      const r = await proficiency.result(id)
      setStatus(r.status)
      if (r.result) setRes(r.result)
    } catch (e) { setError(profErrorText(e)) }
  }, [id, params])
  useEffect(() => { void load() }, [load])

  if (error) return <div className="max-w-3xl mx-auto py-16 text-center"><p role="alert">{error}</p><Link to="/prova" className="mt-4 inline-block underline">Voltar</Link></div>
  if (!res) {
    if (status === 'scoring' || status === 'loading') return status === 'loading' ? <ReportSkeleton /> : <ScoringWait sessionId={id} compact onReady={() => void load()} />
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <h1 className="font-display text-[32px]">Resultado indisponível</h1>
        <p className="mt-2 text-[15px]" style={muted}>Esta prova não foi concluída.</p>
        <Link to="/prova" className="mt-6 inline-block text-[14px] font-medium underline underline-offset-4">Voltar</Link>
      </div>
    )
  }
  return <ReportView res={res} id={id} />
}

function ReportView({ res, id }: { res: Result; id: string }) {
  const { user } = useAuth()
  const avatar = useMyAvatar()
  const name = String(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email ?? '')
  const date = new Date(res.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
  const inconclusive = res.status === 'inconclusive'
  const code = `EPT-${(res.session_id || id).replace(/-/g, '').slice(0, 8).toUpperCase()}`

  return (
    <div className="prof-report max-w-6xl mx-auto pb-16">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link to="/prova" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium whitespace-nowrap" style={muted}><ArrowLeft className="w-4 h-4" />Voltar à prova</Link>
        <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /><span className="sm:hidden">PDF</span><span className="hidden sm:inline">Imprimir ou salvar PDF</span></Button>
      </div>

      {/* Capa */}
      <section className="prof-cover mt-5 rounded-[28px] border overflow-hidden break-inside-avoid" style={cardStyle}>
        <div className="flex items-center justify-between gap-3 px-6 md:px-10 py-4 border-b text-[12px] uppercase tracking-[0.1em] font-semibold" style={{ borderColor: 'var(--theme-border)', ...muted }}>
          <span><span className="hidden sm:inline">Upoonly · </span>English Proficiency Test</span>
          <span className="tabular-nums whitespace-nowrap">{code}</span>
        </div>
        <div className="px-6 md:px-10 py-8 md:py-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex items-center gap-3">
              <Avatar src={avatar} name={name || 'Aluno'} size={48} />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold truncate">{name}</p>
                <p className="text-[13px]" style={muted}>Prova realizada em {date}</p>
              </div>
            </div>
            <h1 className="mt-6 font-display text-[40px] md:text-[54px] leading-[0.98] tracking-[-0.01em]">{inconclusive ? 'Avaliação inconclusiva' : 'Relatório de proficiência'}</h1>
            {res.report.overall && <p className="mt-4 text-[15.5px] leading-relaxed max-w-xl">{res.report.overall}</p>}
          </div>
          <div className="flex flex-col items-center text-center rounded-3xl border px-8 py-6" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)' }}>
            <p className="text-[12px] uppercase tracking-[0.1em] font-semibold" style={muted}>Faixa geral</p>
            <div className="mt-2"><ScoreDial value={inconclusive ? null : res.overall} size={170} /></div>
            <p className="-mt-6 font-display text-[64px] leading-none tabular-nums">{inconclusive ? '–' : fmtBand(res.overall)}</p>
            <p className="mt-1 text-[12.5px]" style={muted}>escala de 1 a 6</p>
            {!inconclusive && res.cefr && (
              <span className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-xl border-2 text-[16px] font-semibold" style={{ borderColor: 'var(--theme-text)' }}>
                <Award className="w-4.5 h-4.5" />CEFR {res.cefr}
              </span>
            )}
          </div>
        </div>
        {!inconclusive && res.cefr && (
          <p className="px-6 md:px-10 py-4 border-t text-[14px]" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
            <span className="font-semibold">Nível {res.cefr}:</span> {CEFR_TEXT[res.cefr]}
          </p>
        )}
      </section>

      {/* Habilidades */}
      <section className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 break-inside-avoid">
        {ORDER.map(s => {
          const sec = res.sections[s]
          const Icon = ICON[s]
          const inc = sec?.status === 'inconclusive'
          return (
            <a key={s} href={`#${s}`} className="rounded-2xl border p-5 hover:bg-[var(--ui-hover)] transition-colors" style={cardStyle}>
              <div className="flex items-center justify-between">
                <span className="grid place-items-center w-9 h-9 rounded-xl" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}><Icon className="w-4 h-4" /></span>
                <span className="text-[12px] font-semibold" style={muted}>{inc ? 'Inconclusiva' : sec?.cefr}</span>
              </div>
              <p className="mt-4 text-[13.5px] font-medium">{title(s)}</p>
              <p className="font-display text-[40px] leading-none tabular-nums">{inc ? '–' : fmtBand(sec?.band)}</p>
              <BandScale band={inc ? null : sec?.band ?? null} />
            </a>
          )
        })}
      </section>

      {ORDER.map(s => <SkillSection key={s} section={s} data={res.sections[s]} report={res.report.skills?.[s]} route={s === 'reading' || s === 'listening' ? res.path?.[s]?.module ?? null : null} />)}

      {/* Escala e autenticidade */}
      <section className="mt-12 grid gap-6 md:grid-cols-[1fr_1fr] break-inside-avoid">
        <div>
          <h2 className="font-display text-[26px]">Como ler este relatório</h2>
          <p className="mt-2 text-[14px] leading-relaxed" style={muted}>
            Cada habilidade recebe uma faixa de 1 a 6, em meios pontos; a faixa geral é a média das quatro e define o nível CEFR
            aproximado. Reading e Listening são corrigidas automaticamente e são adaptativas. Writing e Speaking são avaliadas por
            IA com rubricas de 0 a 5 por tarefa (versão {res.rubric_version}, nota {res.scoring_version}).
          </p>
          <p className="mt-4 text-[12.5px] leading-relaxed flex gap-2" style={muted}><ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />{res.report.disclaimer} Código do relatório: {code}.</p>
        </div>
        <div className="rounded-2xl border overflow-hidden self-start" style={cardStyle}>
          {BAND_CEFR.map(r => {
            const on = res.cefr === r.cefr && !inconclusive
            return (
              <div key={r.cefr} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 px-4 py-2.5 border-t first:border-t-0 text-[13.5px]" style={{ borderColor: 'var(--theme-border)', ...(on ? { backgroundColor: 'var(--theme-bg-secondary)' } : {}) }}>
                <span className="grid place-items-center h-8 rounded-lg font-semibold" style={on ? { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' } : { backgroundColor: 'var(--theme-bg-secondary)' }}>{r.cefr}</span>
                <span>{r.pt}</span>
                <span className="tabular-nums" style={muted}>{r.band}</span>
              </div>
            )
          })}
        </div>
      </section>

      <footer className="hidden print:flex mt-10 pt-4 border-t justify-between text-[11px]" style={{ borderColor: 'var(--theme-border)', ...muted }}>
        <span>Upoonly · English Proficiency Test · {date}</span><span>{code}</span>
      </footer>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="h-10 w-48 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
      <div className="h-72 rounded-[28px] animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />)}</div>
    </div>
  )
}

/** Régua 1–6 com a posição da faixa. */
function BandScale({ band }: { band: number | null }) {
  return (
    <div className="mt-3" aria-hidden>
      <div className="relative h-1.5 rounded-full" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
        {band != null && <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${((band - 1) / 5) * 100}%`, backgroundColor: 'var(--theme-text)' }} />}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums" style={muted}>{[1, 2, 3, 4, 5, 6].map(n => <span key={n}>{n}</span>)}</div>
    </div>
  )
}

function SkillSection({ section, data, report, route }: { section: Section; data?: SectionResult; report?: SkillReport; route: 'easy' | 'hard' | null }) {
  if (!data) return null
  const Icon = ICON[section]
  const objective = section === 'reading' || section === 'listening'
  const rows = Object.entries(data.breakdown).filter(([, v]) => v.total > 0)
  const inc = data.status === 'inconclusive'
  return (
    <section id={section} className="prof-skill mt-12 scroll-mt-20">
      <header className="flex flex-wrap items-end justify-between gap-3 pb-4 border-b" style={{ borderColor: 'var(--theme-border)' }}>
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-12 h-12 rounded-2xl" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}><Icon className="w-5 h-5" /></span>
          <div>
            <p className="text-[12.5px] uppercase tracking-[0.08em] font-semibold" style={muted}>{SECTION_LABEL[section].pt}</p>
            <h2 className="font-display text-[32px] leading-none">{title(section)}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!inc && data.cefr && <span className="h-8 px-2.5 inline-flex items-center rounded-lg border text-[13px] font-semibold" style={{ borderColor: 'var(--theme-border)' }}>{data.cefr}</span>}
          <span className="font-display text-[44px] leading-none tabular-nums">{inc ? '–' : fmtBand(data.band)}</span>
        </div>
      </header>

      {inc && (
        <p className="mt-4 rounded-xl px-4 py-3 text-[14px]" style={{ backgroundColor: 'var(--pastel-amber-bg)', color: 'var(--pastel-amber-fg)' }}>
          {REASON[data.reason ?? ''] ?? 'Não houve evidência suficiente para uma nota nesta habilidade.'}
        </p>
      )}

      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5 break-inside-avoid">
          <p className="text-[12px] uppercase tracking-[0.08em] font-semibold" style={muted}>Desempenho por tarefa</p>
          <ul className="space-y-3.5">
            {rows.map(([task, v]) => {
              const pct = v.total ? v.correct / v.total : 0
              const label = task === 'Listen and Repeat' ? `${Math.round(pct * 100)}% de precisão` : objective || task === 'Build a Sentence' ? `${Math.round(v.correct)} de ${v.total}` : `${fmtBand(v.correct)} de 5`
              return (
                <li key={task}>
                  <div className="flex justify-between gap-3 text-[13.5px]"><span>{task}</span><span className="tabular-nums font-medium">{label}</span></div>
                  <div className="mt-1.5 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}><div className="h-full rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: 'var(--theme-text)' }} /></div>
                </li>
              )
            })}
          </ul>
          {route && (
            <p className="text-[13px] flex items-start gap-2 leading-relaxed rounded-xl p-3" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
              <GitBranch className="w-4 h-4 shrink-0 mt-0.5" />
              {route === 'hard' ? 'O desempenho na primeira parte levou ao módulo desafiador, que permite as faixas mais altas.' : 'A primeira parte levou ao módulo acessível, que mede com mais precisão as faixas de 1 a 4.'}
            </p>
          )}
        </div>
        <div className="space-y-5">
          {report?.summary && <p className="text-[15.5px] leading-relaxed">{report.summary}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {!!report?.strengths.length && <Bullets title="Pontos fortes" items={report.strengths} />}
            {!!report?.improve.length && <Bullets title="Para melhorar" items={report.improve} />}
          </div>
          {!!report?.next_steps.length && (
            <div className="rounded-2xl border p-4" style={cardStyle}>
              <Bullets title="Próximos passos" items={report.next_steps} />
            </div>
          )}
        </div>
      </div>

      {!!data.evals?.length && (
        <div className="mt-6 grid gap-3">
          {data.evals.map(e => (
            <div key={e.task} className="rounded-2xl border p-5 break-inside-avoid" style={cardStyle}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[15px] font-semibold">{e.task}</p>
                <p className="text-[13px] tabular-nums font-medium">Rubrica {fmtBand(e.score)} / 5</p>
              </div>
              {e.rationale && <p className="mt-2 text-[14px] leading-relaxed">{e.rationale}</p>}
              {!!e.evidence.length && (
                <ul className="mt-3 space-y-2">
                  {e.evidence.map((q, i) => <li key={i} className="flex gap-2 text-[13.5px] italic pl-3 border-l-2" style={{ ...muted, borderColor: 'var(--theme-border)' }}><Quote className="w-3.5 h-3.5 shrink-0 mt-0.5 not-italic" />{q}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={muted}>{title}</p>
      <ul className="mt-2 space-y-1.5">{items.map((t, i) => <li key={i} className="flex gap-2 text-[14px] leading-relaxed"><span className="mt-2 w-1 h-1 shrink-0 rounded-full" style={{ backgroundColor: 'var(--theme-text)' }} />{t}</li>)}</ul>
    </div>
  )
}
