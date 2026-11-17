// "Avaliação em andamento": progresso estimado da correção, tempo restante, o tutor fazendo companhia e a opção de continuar
// estudando (o app avisa quando o relatório ficar pronto). Usada no fim da prova e na página do resultado.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BellRing, Check, FileText, Headphones, Loader2, Mic, PenLine } from 'lucide-react'
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
  { icon: Check, t: 'Respostas objetivas', d: 'Reading e Listening corrigidas pelo gabarito', at: 0 },
  { icon: Mic, t: 'Transcrição da fala', d: 'As 11 gravações viram texto', at: 0.15 },
  { icon: PenLine, t: 'Rubricas de Writing e Speaking', d: 'Cada resposta avaliada com evidências', at: 0.45 },
  { icon: FileText, t: 'Relatório', d: 'Análise por habilidade e próximos passos', at: 0.8 },
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
  const lines = useMemo(() => [
    'Estou lendo as suas respostas com calma.',
    'Cada nota vem com o motivo, nas suas próprias palavras.',
    'Enquanto isso, que tal revisar algumas palavras?',
  ], [])
  const line = lines[Math.floor(elapsed / 9000) % lines.length]

  const keepStudying = () => {
    rememberPending(sessionId, new Date(since).toISOString())
    toast('Pode continuar estudando', { detail: 'Avisamos aqui no app quando o relatório ficar pronto.' })
    nav('/')
  }

  return (
    <div className={`w-full max-w-4xl mx-auto px-4 ${compact ? 'py-6' : 'py-10 md:py-16'}`}>
      <div className="grid gap-8 md:gap-12 md:grid-cols-[minmax(0,300px)_1fr] items-center">
        <div className="flex flex-col items-center">
          <div className="relative w-[220px] h-[220px] md:w-[260px] md:h-[260px]">
            <CharacterAvatar characterId={tutorId} kind="woman" state="thinking" size={260} />
          </div>
          <p className="mt-3 max-w-[260px] text-center text-[14px] leading-relaxed rounded-2xl px-4 py-3 border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
            <span className="block text-[11.5px] font-semibold uppercase tracking-[0.08em] mb-1" style={muted}>{tutor?.name}</span>{line}
          </p>
        </div>

        <div>
          <p className="text-[12.5px] inline-flex items-center gap-2 font-semibold uppercase tracking-[0.08em]" style={muted}><Check className="w-4 h-4" />Prova concluída</p>
          <h1 className="mt-3 font-display text-[38px] md:text-[52px] leading-[0.98] tracking-[-0.01em]">{failed ? 'Quase lá' : 'Preparando o seu relatório'}</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed max-w-lg" style={muted}>
            {failed ? 'A correção automática não terminou. Suas respostas estão salvas e a nossa equipe conclui a avaliação; o resultado aparece no seu histórico.'
              : queued ? 'Sua prova está na fila de correção. Assim que o serviço de avaliação liberar, o relatório é preparado automaticamente. Você não precisa ficar nesta tela.'
              : 'A correção da escrita e da fala leva alguns minutos. Você pode esperar aqui ou continuar estudando: avisamos assim que ficar pronto.'}
          </p>

          {!failed && (
            <>
              <div className="mt-7">
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="font-semibold tabular-nums">{Math.round(progress * 100)}%</span>
                  <span className="tabular-nums" style={muted}>{queued ? 'Na fila de correção' : eta}</span>
                </div>
                <div className="mt-2 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full transition-[width] duration-1000 ease-out" style={{ width: `${progress * 100}%`, backgroundColor: 'var(--theme-text)' }} />
                </div>
              </div>
              <ol className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {STEPS.map((s, i) => {
                  const done = progress >= (STEPS[i + 1]?.at ?? 1.01)
                  const active = !done && progress >= s.at
                  const Icon = s.icon
                  return (
                    <li key={s.t} className="flex items-start gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: active ? 'var(--theme-card-bg)' : 'transparent', opacity: !done && !active ? 0.55 : 1 }}>
                      <span className="grid place-items-center w-8 h-8 shrink-0 rounded-lg" style={done ? { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' } : { backgroundColor: 'var(--theme-bg-secondary)' }}>
                        {done ? <Check className="w-4 h-4" /> : active ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                      </span>
                      <span><span className="block text-[14px] font-medium">{s.t}</span><span className="block text-[12.5px]" style={muted}>{s.d}</span></span>
                    </li>
                  )
                })}
              </ol>
            </>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={keepStudying}><ArrowRight className="w-4 h-4" />Continuar estudando</Button>
            <Button size="lg" variant="outline" onClick={() => nav('/practice/write')}><Headphones className="w-4 h-4" />Treinar um ditado</Button>
          </div>
          <p className="mt-4 text-[12.5px] inline-flex items-center gap-1.5" style={muted}><BellRing className="w-3.5 h-3.5" />O relatório também fica em Prova de proficiência, no seu histórico.</p>
        </div>
      </div>
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
