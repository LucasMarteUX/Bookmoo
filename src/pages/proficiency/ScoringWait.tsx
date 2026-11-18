// "Avaliação em andamento": progresso estimado da correção, tempo restante, o tutor fazendo companhia e a opção de continuar
// estudando (o app avisa quando o relatório ficar pronto). Usada no fim da prova e na página do resultado.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BellRing, Check, ChevronRight, FileText, Headphones, Loader2, Mic, PenLine, Volume2 } from 'lucide-react'
import { speak, stopSpeaking } from '@/lib/tts'
import { Button } from '@/components/ui/button'
import { CharacterAvatar } from '@/components/voice/CharacterAvatar'
import { characterById, effectiveCharacterId } from '@/lib/livliv/characters'
import { useAvatarSettings } from '@/store/useAvatarSettings'
import { proficiency } from '@/lib/proficiencyApi'
import { toast } from '@/components/ui/toast'

const muted = { color: 'var(--theme-text-secondary)' }
const PENDING_KEY = 'bookmoo-prof-pending'
const EXPECTED_MS = 3 * 60_000

/** Guarda a prova em correção para o aviso global (ProficiencyReadyWatcher). */
export function rememberPending(sessionId: string, since?: string | null) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ id: sessionId, since: since ?? new Date().toISOString() })) } catch { /* sem armazenamento */ }
}
function readPending(): { id: string; since: string } | null {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null') } catch { return null }
}
function clearPending(id: string) {
  try { if (readPending()?.id === id) localStorage.removeItem(PENDING_KEY) } catch { /* sem armazenamento */ }
}

const STEPS = [
  { icon: Check, t: 'Respostas objetivas', d: 'Reading e Listening corrigidas pelo gabarito', long: 'Reading e Listening são corrigidas na hora pelo gabarito, e o caminho adaptativo define a sua faixa.', at: 0 },
  { icon: Mic, t: 'Leitura das gravações', d: 'O servidor ouve as 11 respostas e as passa para texto', long: 'O servidor ouve as 11 respostas gravadas e as passa para texto, do mesmo jeito para todo mundo.', at: 0.15 },
  { icon: PenLine, t: 'Rubricas de Writing e Speaking', d: 'Cada resposta avaliada com evidências', long: 'E-mail, discussão e entrevista recebem de 0 a 5 por critério, com trechos das suas respostas como evidência.', at: 0.45 },
  { icon: FileText, t: 'Relatório', d: 'Análise por habilidade e próximos passos', long: 'Faixa de 1 a 6, nível CEFR estimado, pontos fortes, o que melhorar e próximos passos em cada habilidade.', at: 0.8 },
]

export function ScoringWait({ sessionId, onReady, compact = false }: { sessionId: string; onReady: () => void; compact?: boolean }) {
  const nav = useNavigate()
  const [since, setSince] = useState<number>(() => new Date(readPending()?.id === sessionId ? readPending()!.since : Date.now()).getTime())
  const [queued, setQueued] = useState(false)
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(Date.now())
  const tutorId = effectiveCharacterId(useAvatarSettings(s => s.characterId))
  const tutor = characterById(tutorId)

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => {
    let stop = false
    const poll = async () => {
      if (stop) return
      try {
        const r = await proficiency.result(sessionId)
        if (r.status === 'scored' || r.status === 'inconclusive') { clearPending(sessionId); onReady(); return }
        if (r.status === 'failed') { setFailed(true); return }
        setQueued(!!r.queued)
        if (r.submittedAt) { setSince(new Date(r.submittedAt).getTime()); rememberPending(sessionId, r.submittedAt) }
      } catch { /* tenta de novo */ }
      setTimeout(poll, 5000)
    }
    void poll()
    return () => { stop = true }
  }, [sessionId, onReady])

  const elapsed = Math.max(0, now - since)
  // Progresso estimado: sobe depressa no começo e desacelera; nunca chega a 100% antes do resultado.
  const progress = queued ? Math.min(0.3, elapsed / EXPECTED_MS) : Math.min(0.96, 1 - Math.exp(-elapsed / (EXPECTED_MS * 0.55)))
  const left = Math.max(0, EXPECTED_MS - elapsed)
  const eta = left > 60_000 ? `cerca de ${Math.ceil(left / 60_000)} minutos` : left > 0 ? 'menos de 1 minuto' : 'quase pronto'
  // A Bia explica o relatório enquanto a correção acontece: dicas que mudam sozinhas, "Ouvir" com a boca sincronizada e
  // "Próxima dica" para quem quer ir no próprio ritmo.
  const tips = useMemo(() => [
    'Estou lendo as suas respostas com calma. Cada habilidade recebe uma faixa de 1 a 6.',
    'No relatório, cada nota de escrita e de fala vem com o motivo, citando as suas próprias palavras.',
    'A faixa geral vira uma estimativa do seu nível CEFR e um selo no seu perfil.',
    'Você também recebe pontos fortes, o que melhorar e próximos passos para cada habilidade.',
    'Dá para salvar o relatório em PDF. E, se quiser, você tem mais uma tentativa neste mês.',
  ], [])
  const [tipAt, setTipAt] = useState(0)
  const [talking, setTalking] = useState(false)
  useEffect(() => { if (talking) return; const t = setTimeout(() => setTipAt(i => (i + 1) % tips.length), 10_000); return () => clearTimeout(t) }, [tipAt, talking, tips.length])
  useEffect(() => () => stopSpeaking(), [])
  const say = async (i = tipAt) => {
    setTalking(true)
    try { const h = await speak(tips[i], { language: 'pt-BR' }); await h.done } catch { /* sem voz: o balão basta */ }
    setTalking(false)
  }
  const nextTip = () => { stopSpeaking(); const n = (tipAt + 1) % tips.length; setTipAt(n); void say(n) }

  const keepStudying = () => {
    rememberPending(sessionId, new Date(since).toISOString())
    toast('Pode continuar estudando', { detail: 'Avisamos aqui no app quando o relatório ficar pronto.' })
    nav('/')
  }
  const stepState = (i: number) => {
    const done = progress >= (STEPS[i + 1]?.at ?? 1.01)
    return done ? 'done' : progress >= STEPS[i].at ? 'active' : 'waiting'
  }
  const STATE_LABEL = { done: 'Concluído', active: queued ? 'Na fila' : 'Em andamento', waiting: 'A seguir' } as const

  return (
    <div className={`w-full max-w-6xl mx-auto ${compact ? 'py-2' : 'px-4 py-8 md:py-12'}`}>
      {/* Cartão principal: Bia à esquerda, estado da avaliação e ações à direita. */}
      <section className="rounded-[28px] border overflow-hidden" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
        <div className="grid md:grid-cols-[minmax(0,420px)_1fr]">
          <div className="relative overflow-hidden min-h-[380px] md:min-h-[460px] border-b md:border-b-0 md:border-r" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
            {/* O palco do personagem reserva espaço em cima para o balão dele; aqui o balão é nosso, então a Bia é ampliada
                a partir da base para preencher a área. */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 origin-bottom" style={{ transform: 'scale(1.22)' }}>
                <CharacterAvatar stage voice characterId={tutorId} kind="woman" state={talking ? 'speaking' : 'idle'} followPointer />
              </div>
            </div>
            <div className="absolute z-10 left-4 right-4 bottom-4 rounded-2xl px-4 py-3 border shadow-[0_2px_12px_rgba(0,0,0,0.06)]" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em]" style={muted}>{tutor?.name} · sobre o seu relatório</p>
              <p key={tipAt} className="mt-1 text-[14px] leading-relaxed prof-fade">{tips[tipAt]}</p>
              <span aria-hidden className="absolute left-1/2 -top-[7px] w-3.5 h-3.5 -translate-x-1/2 rotate-45 border-l border-t" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }} />
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex gap-1" aria-hidden>{tips.map((_, i) => <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === tipAt ? 16 : 6, backgroundColor: i === tipAt ? 'var(--theme-text)' : 'var(--theme-border)' }} />)}</div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => (talking ? stopSpeaking() : void say())} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] font-medium hover:bg-[var(--ui-hover)]"><Volume2 className="w-3.5 h-3.5" />{talking ? 'Parar' : 'Ouvir'}</button>
                  <button type="button" onClick={nextTip} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[12.5px] font-medium hover:bg-[var(--ui-hover)]">Próxima<ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>

          </div>

          <div className="p-6 md:p-10 flex flex-col justify-center">
            <span className="self-start inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-semibold" style={{ backgroundColor: 'var(--pastel-green-bg)', color: 'var(--pastel-green-fg)' }}><Check className="w-3.5 h-3.5" />Prova concluída</span>
            <h1 className="mt-4 font-display text-[38px] md:text-[54px] leading-[0.98] tracking-[-0.01em]">{failed ? 'Quase lá' : 'Preparando o seu relatório'}</h1>
            <p className="mt-4 text-[15.5px] leading-relaxed max-w-xl" style={muted}>
              {failed ? 'A correção automática não terminou. Suas respostas estão salvas e a nossa equipe conclui a avaliação; o resultado aparece no seu histórico.'
                : queued ? 'Sua prova está na fila de correção. Assim que o serviço de avaliação liberar, o relatório é preparado automaticamente. Você não precisa ficar nesta tela.'
                : 'A correção da escrita e da fala leva alguns minutos. Você pode esperar aqui ou continuar estudando: avisamos assim que ficar pronto.'}
            </p>
            {!failed && (
              <div className="mt-7 max-w-xl">
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="font-display text-[28px] leading-none tabular-nums">{Math.round(progress * 100)}%</span>
                  <span className="tabular-nums" style={muted}>{queued ? 'Na fila de correção' : eta}</span>
                </div>
                <div className="mt-2.5 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full transition-[width] duration-1000 ease-out" style={{ width: `${progress * 100}%`, backgroundColor: 'var(--theme-text)' }} />
                </div>
              </div>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={keepStudying}><ArrowRight className="w-4 h-4" />Continuar estudando</Button>
              <Button size="lg" variant="outline" onClick={() => nav('/practice/write')}><Headphones className="w-4 h-4" />Treinar um ditado</Button>
            </div>
            <p className="mt-4 text-[12.5px] inline-flex items-center gap-1.5" style={muted}><BellRing className="w-3.5 h-3.5" />Avisamos aqui no app quando ficar pronto. O relatório também fica no seu histórico.</p>
          </div>
        </div>
      </section>

      {/* Como funciona a correção: uma etapa por cartão, com o estado de cada uma. */}
      {!failed && (
        <section className="mt-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={muted}>O que acontece agora</p>
          <h2 className="mt-1.5 font-display text-[28px] md:text-[34px] leading-tight">Quatro etapas até o seu relatório</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((st, i) => {
              const state = stepState(i)
              const Icon = st.icon
              return (
                <li key={st.t} className="rounded-2xl border p-5 flex flex-col transition-opacity" style={{ borderColor: state === 'active' ? 'var(--theme-text)' : 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)', opacity: state === 'waiting' ? 0.7 : 1 }}>
                  <div className="flex items-center justify-between">
                    <span className="grid place-items-center w-11 h-11 rounded-xl" style={state === 'done' ? { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' } : { backgroundColor: 'var(--theme-bg-secondary)' }}>
                      {state === 'done' ? <Check className="w-5 h-5" /> : state === 'active' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
                    </span>
                    <span className="text-[11.5px] font-semibold rounded-full px-2 h-6 inline-flex items-center" style={state === 'done' ? { backgroundColor: 'var(--pastel-green-bg)', color: 'var(--pastel-green-fg)' } : state === 'active' ? { backgroundColor: 'var(--pastel-amber-bg)', color: 'var(--pastel-amber-fg)' } : { backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-secondary)' }}>{STATE_LABEL[state]}</span>
                  </div>
                  <p className="mt-4 text-[12px] tabular-nums font-semibold" style={muted}>Etapa {i + 1}</p>
                  <p className="mt-0.5 text-[16px] font-semibold leading-snug">{st.t}</p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed" style={muted}>{st.long}</p>
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </div>
  )
}

/** Aviso global: quando a prova em correção fica pronta, mostra um toast com o atalho para o relatório. */
export function ProficiencyReadyWatcher() {
  const nav = useNavigate()
  useEffect(() => {
    let stop = false
    const tick = async () => {
      const p = readPending()
      if (p && !location.pathname.startsWith('/prova')) {
        try {
          const r = await proficiency.result(p.id)
          if (r.status === 'scored' || r.status === 'inconclusive') {
            clearPending(p.id)
            toast('Seu relatório da prova está pronto', { detail: 'English Proficiency Test', duration: 15000, action: { label: 'Ver relatório', onClick: () => nav(`/prova/resultado/${p.id}`) } })
          } else if (r.status === 'failed' || r.status === 'abandoned') clearPending(p.id)
        } catch { /* sem rede: tenta depois */ }
      }
      if (!stop) setTimeout(tick, 45_000)
    }
    const first = setTimeout(tick, 8000)
    return () => { stop = true; clearTimeout(first) }
  }, [nav])
  return null
}
