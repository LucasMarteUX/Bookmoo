// Teste seu inglês (docs/TESTE-DE-NIVEL.md). Cada nível tem o seu teste: fala (ler em voz alta + responder), ditado e uma
// conversa curta com um tutor. O resultado confirma o nível, sugere subir (teste do nível de cima) ou sugere ajustar.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, BadgeCheck, Check, GraduationCap, Headphones, Keyboard, Loader2, MessagesSquare, Mic, Square, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LevelStatusBadge } from '@/components/level/LevelStatusBadge'
import { Emblem } from '@/components/level/Emblem'
import { LevelAvatar } from '@/components/level/LevelAvatar'
import { useMyAvatar } from '@/hooks/useMyAvatar'
import { useLanguage } from '@/store/useLanguage'
import { useAuth } from '@/contexts/AuthContext'
import { useLevelStore } from '@/store/useLevelStore'
import { CEFR, levelName, levelRank, levelTone, type CefrId } from '@/lib/cefr'
import { placement, PlacementError, type PlacementItems, type Result, type Status } from '@/lib/placementApi'
import { speak, stopSpeaking } from '@/lib/tts'
import { createRecognizer, defaultEngine, type Recognizer } from '@/lib/speech/recognizers'
import { characterAvatarUrl } from '@/lib/livliv/characters'
import { useAvatarSettings } from '@/store/useAvatarSettings'
import { getSpeakerVoice, setSpeakerVoice } from '@/lib/speakerVoice'
import { characterById, effectiveCharacterId } from '@/lib/livliv/characters'

const muted = { color: 'var(--theme-text-secondary)' }
const card = 'rounded-2xl border p-5 md:p-6'
const cardStyle = { borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }
const bandName = (id: CefrId, pt: boolean) => { const b = CEFR.find(x => x.id === id); return pt ? b?.pt : b?.en }
const fmtDate = (iso: string, pt: boolean) => new Date(iso).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'short' })

type Run = { attemptId: string; level: CefrId; kind: 'confirm' | 'promotion'; items: PlacementItems }

export function PlacementPage() {
  const pt = useLanguage().locale === 'pt-BR'
  const { user } = useAuth()
  const reload = useLevelStore(s => s.load)
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState('')
  const [run, setRun] = useState<Run | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [levelUp, setLevelUp] = useState<{ from: CefrId; to: CefrId } | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try { setStatus(await placement.status()); if (user?.id) void reload(user.id) } catch (e) { setError(errorText(e, pt)) }
  }
  useEffect(() => { void refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (kind: 'confirm' | 'promotion') => {
    setBusy(true); setError(''); setResult(null)
    try { setRun(await placement.start(kind, effectiveCharacterId(useAvatarSettings.getState().characterId))) } catch (e) { setError(errorText(e, pt)) } finally { setBusy(false) }
  }
  const finished = async (r: Result) => {
    setRun(null); setResult(r)
    if (r.outcome === 'promoted') setLevelUp({ from: r.previousLevel, to: r.newLevel })
    await refresh()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2.5 text-[12.5px]" style={muted}>
          <GraduationCap className="w-4 h-4" />
          <span>{pt ? 'Teste de nível' : 'Level test'}</span>
        </div>
        <h1 className="font-display text-[32px] md:text-[44px] leading-[1.02] tracking-tight">{run ? (pt ? `Teste do nível ${levelName(run.level, pt)}` : `${levelName(run.level, pt)} level test`) : (pt ? 'Seu nível de inglês' : 'Your English level')}</h1>
        {!run && !result && <p className="text-[15px] max-w-lg" style={muted}>{pt ? 'Cada nível tem o seu teste. Confirme o seu e suba de patamar, um degrau por vez.' : 'Every level has its own test. Confirm yours and move up, one step at a time.'}</p>}
      </header>
      {error && <p role="alert" className="rounded-xl px-3 py-2.5 text-[14px]" style={{ backgroundColor: 'var(--pastel-rose-bg)', color: 'var(--pastel-rose-fg)' }}>{error}</p>}
      {run
        ? <TestRunner run={run} pt={pt} onDone={finished} onError={msg => { setError(msg) }} onQuit={() => setRun(null)} />
        : result
          ? <ResultView result={result} pt={pt} busy={busy} onPromotion={() => void start('promotion')} onStepDown={async () => { setBusy(true); try { await placement.stepDown(); setResult(null); await refresh() } catch (e) { setError(errorText(e, pt)) } finally { setBusy(false) } }} onBack={() => setResult(null)} />
          : <Intro status={status} pt={pt} busy={busy} onStart={k => void start(k)} />}
      <AnimatePresence>{levelUp && <LevelUp from={levelUp.from} to={levelUp.to} pt={pt} onClose={() => setLevelUp(null)} />}</AnimatePresence>
    </div>
  )
}

function errorText(e: unknown, pt: boolean) {
  const code = e instanceof PlacementError ? e.code : 'request_failed'
  const at = e instanceof PlacementError && typeof e.extra.availableAt === 'string' ? fmtDate(e.extra.availableAt, pt) : ''
  const map: Record<string, [string, string]> = {
    cooldown: [`Você já usou as 2 tentativas deste mês. O próximo teste abre em ${at}.`, `You used both attempts this month. The next test opens on ${at}.`],
    confirm_first: ['Primeiro confirme o seu nível atual; depois o teste do próximo libera.', 'Confirm your current level first; then the next test unlocks.'],
    no_higher_level: ['Você já está no nível mais alto.', 'You are already at the top level.'],
    incomplete: ['Faltou terminar alguma parte do teste.', 'Some part of the test is not finished.'],
    attempt_expired: ['O teste expirou (mais de 24 h). Comece de novo.', 'The test expired (over 24 h). Start again.'],
    scoring_busy: ['A correção está ocupada agora. Suas respostas estão salvas: tente de novo em instantes.', 'Scoring is busy right now. Your answers are saved: try again in a moment.'],
  }
  return (map[code] ?? ['Algo deu errado. Tente de novo.', 'Something went wrong. Try again.'])[pt ? 0 : 1]
}

// ---------------------------------------------------------------------------------------------------------------------
function Intro({ status, pt, busy, onStart }: { status: Status | null; pt: boolean; busy: boolean; onStart: (k: 'confirm' | 'promotion') => void }) {
  const myAvatar = useMyAvatar()
  const { user } = useAuth()
  if (!status) return <IntroSkeleton />
  const myName = String(user?.user_metadata?.full_name ?? user?.email ?? '')
  const confirmLocked = status.confirmAvailableAt && new Date(status.confirmAvailableAt) > new Date() ? status.confirmAvailableAt : null
  const promoLocked = status.promotionAvailableAt && new Date(status.promotionAvailableAt) > new Date() ? status.promotionAvailableAt : null
  const verified = status.state === 'verified'
  const band = CEFR.find(b => b.id === status.level)
  const idx = CEFR.findIndex(b => b.id === status.level)
  const name = levelName(status.level, pt)
  const tone = levelTone(status.level)
  const next = status.next ? levelName(status.next, pt) : null
  const steps: { icon: typeof Mic; t: string; d: string; n: string }[] = [
    { icon: Mic, t: pt ? 'Fala' : 'Speaking', d: pt ? 'Ler 3 frases em voz alta e responder 2 perguntas' : 'Read 3 sentences aloud and answer 2 questions', n: '1' },
    { icon: Headphones, t: pt ? 'Ditado' : 'Dictation', d: pt ? 'Ouvir e escrever 6 a 7 frases' : 'Listen and write 6 to 7 sentences', n: '2' },
    { icon: MessagesSquare, t: pt ? 'Conversa' : 'Conversation', d: pt ? 'Até 8 trocas com um tutor, com tarefas do nível' : 'Up to 8 turns with a tutor, with level tasks', n: '3' },
  ]
  const stateLabel = verified ? (pt ? 'Verificado' : 'Verified') : status.state === 'review' ? (pt ? 'Em revisão' : 'Under review') : (pt ? 'Pendente' : 'Pending')
  const message = status.state === 'pending'
    ? (pt ? `Um teste curto, feito para o nível ${name}, confirma o seu nível e libera o selo verificado.` : `A short test made for ${name} confirms your level and unlocks the verified badge.`)
    : status.state === 'review' ? (pt ? 'Seu último teste ficou abaixo do esperado. Treine com os tutores e refaça quando quiser.' : 'Your last test was below expectations. Practise with the tutors and retake it.')
    : next ? (pt ? `Nível confirmado. Quando se sentir pronto, o teste de promoção leva você para ${next}.` : `Level confirmed. When you feel ready, the promotion test takes you to ${next}.`)
    : (pt ? 'Você está no nível mais alto do Bookmoo.' : 'You are at the top Bookmoo level.')
  const meta = [
    pt ? 'Cerca de 15 minutos' : 'About 15 minutes',
    pt ? `${status.monthUsed ?? 0} de ${status.monthLimit ?? 2} tentativas este mês` : `${status.monthUsed ?? 0} of ${status.monthLimit ?? 2} attempts this month`,
    status.monthBest != null ? (pt ? `melhor nota ${Math.round(status.monthBest)}` : `best score ${Math.round(status.monthBest)}`) : null,
  ].filter(Boolean)
  return (
    <div className="space-y-6">
      {/* Cartão principal: quem é a pessoa, o nível, o estado e a ação certa. */}
      <section className="rounded-3xl border overflow-hidden" style={cardStyle}>
        <div className="p-6 md:p-8 grid gap-6 sm:grid-cols-[auto_1fr]">
          <div className="sm:pt-1"><LevelAvatar src={myAvatar} name={myName} level={status.level} verified={verified} pt={pt} size={120} /></div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={muted}>{pt ? 'Seu nível no Bookmoo' : 'Your Bookmoo level'}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h2 className="font-display text-[40px] md:text-[48px] leading-none tracking-[-0.01em]">{name}</h2>
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12.5px] font-semibold"
                style={verified ? { backgroundColor: tone.bg, color: tone.fg, boxShadow: `inset 0 0 0 1px ${tone.bd}` } : { border: `1.5px ${status.state === 'pending' ? 'dashed' : 'solid'} var(--theme-text-secondary)` }}>
                {verified ? <BadgeCheck className="w-3.5 h-3.5" /> : null}{stateLabel}
              </span>
            </div>
            <p className="mt-2 text-[14px]" style={muted}>{pt ? band?.can.pt : band?.can.en}</p>

            <div className="mt-5 pt-5 border-t" style={{ borderColor: 'var(--theme-border)' }}>
              <p className="text-[15px] leading-relaxed">{message}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                {(!verified || !status.next) && (
                  <Button size="lg" disabled={busy || !!confirmLocked} onClick={() => onStart('confirm')}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                    {confirmLocked ? (pt ? `Disponível em ${fmtDate(confirmLocked, pt)}` : `Available ${fmtDate(confirmLocked, pt)}`) : (pt ? 'Fazer o teste' : 'Take the test')}
                  </Button>
                )}
                {verified && status.next && (
                  <Button size="lg" disabled={busy || !!promoLocked} onClick={() => onStart('promotion')}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    {promoLocked ? (pt ? `Promoção em ${fmtDate(promoLocked, pt)}` : `Promotion on ${fmtDate(promoLocked, pt)}`) : (pt ? `Subir para ${next}` : `Move up to ${next}`)}
                  </Button>
                )}
                <p className="text-[12.5px]" style={muted}>{meta.join(' · ')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trilha de níveis: pontos ligados, o atual em destaque e o próximo indicado. */}
        <div className="px-6 md:px-8 py-6 border-t" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
          <ol className="relative grid grid-cols-6" aria-label={pt ? 'Trilha de níveis' : 'Level path'}>
            <span className="absolute left-[8.33%] right-[8.33%] top-[11px] h-[2px]" style={{ backgroundColor: 'var(--theme-border)' }} aria-hidden />
            <span className="absolute left-[8.33%] top-[11px] h-[2px]" style={{ width: `${(idx / 5) * 83.33}%`, backgroundColor: 'var(--theme-text)' }} aria-hidden />
            {CEFR.map((b, i) => {
              const here = i === idx
              const done = i < idx || status.emblems.includes(b.id)
              return (
                <li key={b.id} className="relative flex flex-col items-center text-center" aria-current={here ? 'step' : undefined}>
                  <span className="grid place-items-center rounded-full" style={{ width: 24, height: 24, backgroundColor: here || done ? 'var(--theme-text)' : 'var(--theme-card-bg)', boxShadow: here ? '0 0 0 4px color-mix(in srgb, var(--theme-text) 18%, transparent)' : 'inset 0 0 0 2px var(--theme-border)', color: 'var(--theme-bg)' }}>
                    {done && !here ? <Check className="w-3.5 h-3.5" /> : here ? <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--theme-bg)' }} /> : null}
                  </span>
                  <span className={`mt-2 text-[11.5px] sm:text-[12.5px] leading-tight ${here ? 'font-semibold' : ''}`} style={{ color: here || done ? 'var(--theme-text)' : 'var(--theme-text-secondary)' }}>{pt ? b.pt : b.en}</span>
                  {i === idx + 1 && <span className="mt-0.5 text-[10.5px] uppercase tracking-[0.06em]" style={muted}>{pt ? 'próximo' : 'next'}</span>}
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* Como funciona */}
      <section className="grid gap-3 md:grid-cols-3">
        {steps.map(({ icon: I, t, d, n }) => (
          <div key={t} className="rounded-2xl border p-5" style={cardStyle}>
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl grid place-items-center" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}><I className="w-[18px] h-[18px]" /></span>
              <span className="text-[12px] tabular-nums" style={muted}>{pt ? `Parte ${n}` : `Part ${n}`}</span>
            </div>
            <p className="mt-4 text-[15px] font-semibold">{t}</p>
            <p className="mt-1 text-[13.5px] leading-snug" style={muted}>{d}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border p-5 md:p-6 grid gap-4 sm:grid-cols-3 text-[13.5px]" style={cardStyle}>
        <div><p className="font-semibold">{pt ? 'Feito para o seu nível' : 'Made for your level'}</p><p className="mt-1" style={muted}>{pt ? 'Ninguém faz o teste de Lenda sendo Iniciante. Indo muito bem, sugerimos subir.' : 'Nobody takes a C2 test at A1. If you do great, we suggest moving up.'}</p></div>
        <div><p className="font-semibold">{pt ? 'Duas tentativas por mês' : 'Two attempts a month'}</p><p className="mt-1" style={muted}>{pt ? 'Pode refazer uma vez no mês; vale a melhor nota. Depois, só no mês seguinte.' : 'You can retake once a month; the best score counts. Then next month.'}</p></div>
        <div><p className="font-semibold">{pt ? 'Fale de verdade' : 'Really speak'}</p><p className="mt-1" style={muted}>{pt ? 'Use fone e um lugar calmo. Digitar é possível, mas vale menos.' : 'Use headphones in a quiet place. Typing works but counts less.'}</p></div>
      </section>

      {status.attempts.filter(a => a.status === 'scored').length > 0 && (
        <section className="rounded-2xl border p-5 md:p-6" style={cardStyle}>
          <h2 className="text-[15px] font-semibold">{pt ? 'Histórico' : 'History'}</h2>
          <ul className="mt-3 divide-y divide-[var(--theme-border)]">
            {status.attempts.filter(a => a.status === 'scored').map(a => (
              <li key={a.id} className="py-3 flex items-center justify-between gap-3 text-[13.5px]">
                <span className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full grid place-items-center text-[12px] font-semibold tabular-nums" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{levelRank(a.level)}</span>
                  <span><span className="block font-medium">{a.kind === 'promotion' ? (pt ? 'Teste de promoção' : 'Promotion test') : (pt ? 'Teste de confirmação' : 'Confirmation test')}</span><span style={muted}>{fmtDate(a.finished_at ?? a.started_at, pt)}</span></span>
                </span>
                <span className="text-right"><span className="block tabular-nums font-semibold">{Math.round(a.total ?? 0)}</span><span style={muted}>{outcomeLabel(a.outcome, pt)}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** Carregando: o mesmo desenho da introdução (cartão com emblema, trilha, três partes e regras), em blocos. */
function IntroSkeleton() {
  const bar = (w: string, h = 'h-3') => <span className={`block ${h} ${w} rounded-full`} style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Carregando">
      <section className="rounded-3xl border overflow-hidden" style={cardStyle}>
        <div className="p-6 md:p-8 grid gap-6 md:grid-cols-[auto_1fr] items-center">
          <span className="block w-[104px] h-[104px] rounded-full" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
          <div className="space-y-3">{bar('w-28', 'h-7')}{bar('w-full')}{bar('w-2/3')}{bar('w-56', 'h-11')}</div>
        </div>
        <div className="px-6 md:px-8 py-5 border-t grid grid-cols-6 gap-1.5" style={{ borderColor: 'var(--theme-border)' }}>{Array.from({ length: 6 }).map((_, i) => <span key={i}>{bar('w-full', 'h-1.5')}</span>)}</div>
      </section>
      <section className="grid gap-3 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-2xl border p-5 space-y-3" style={cardStyle}>{bar('w-10', 'h-10')}{bar('w-20')}{bar('w-full')}</div>)}</section>
      <section className="rounded-2xl border p-5 md:p-6 grid gap-4 sm:grid-cols-3" style={cardStyle}>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="space-y-2">{bar('w-32')}{bar('w-full')}</div>)}</section>
    </div>
  )
}

const outcomeLabel = (o: string | null, pt: boolean) => ({
  confirmed: pt ? 'confirmado' : 'confirmed', promote: pt ? 'pode subir' : 'can move up', step_down: pt ? 'abaixo' : 'below',
  promoted: pt ? 'promovido' : 'promoted', not_promoted: pt ? 'ainda não' : 'not yet',
} as Record<string, string>)[o ?? ''] ?? ''

// ---------------------------------------------------------------------------------------------------------------------
// Captura de fala: o mesmo reconhecimento do app; sem microfone, a pessoa digita (vale menos).
function useSpeech() {
  const rec = useRef<Recognizer | null>(null)
  const [listening, setListening] = useState(false)
  const [live, setLive] = useState('')
  const startedAt = useRef(0)
  const start = async () => {
    const engine = defaultEngine(false)
    if (!engine) throw new Error('no_engine')
    stopSpeaking()
    setLive('')
    const r = createRecognizer(engine, { onTranscript: t => setLive(t) })
    rec.current = r
    await r.start()
    startedAt.current = performance.now()
    setListening(true)
  }
  const stop = async () => {
    const r = rec.current
    rec.current = null
    setListening(false)
    if (!r) return { text: live, durationMs: 0 }
    const out = await r.stop().catch(() => ({ text: live }))
    return { text: (out.text || live).trim(), durationMs: Math.round(performance.now() - startedAt.current) }
  }
  useEffect(() => () => { rec.current?.abort() }, [])
  return { listening, live, start, stop, available: defaultEngine(false) !== null }
}

function SpeakBox({ pt, onAnswer, hint }: { pt: boolean; onAnswer: (text: string, typed: boolean, durationMs: number) => Promise<void>; hint?: string }) {
  const sp = useSpeech()
  const [text, setText] = useState('')
  const [typed, setTyped] = useState(!sp.available)
  const [dur, setDur] = useState(0)
  const [sending, setSending] = useState(false)
  const [micError, setMicError] = useState(false)
  const toggle = async () => {
    if (sp.listening) { const out = await sp.stop(); setText(out.text); setDur(out.durationMs); return }
    try { setMicError(false); await sp.start() } catch { setMicError(true); setTyped(true) }
  }
  const send = async () => { if (!text.trim()) return; setSending(true); try { await onAnswer(text.trim(), typed, dur) } finally { setSending(false); setText('') } }
  return (
    <div className="mt-4 space-y-3">
      {typed ? (
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder={hint ?? (pt ? 'Escreva em inglês' : 'Write in English')}
          className="w-full rounded-xl border px-3.5 py-2.5 text-[15px] bg-transparent outline-none" style={{ borderColor: 'var(--theme-border)' }} />
      ) : (
        <div className="min-h-[64px] rounded-xl border px-3.5 py-2.5 text-[15px]" style={{ borderColor: 'var(--theme-border)' }}>
          {sp.listening ? <span>{sp.live || <span style={muted}>{pt ? 'Ouvindo… fale em inglês' : 'Listening… speak English'}</span>}</span> : text ? text : <span style={muted}>{pt ? 'Toque no microfone e fale.' : 'Tap the mic and speak.'}</span>}
        </div>
      )}
      {micError && <p className="text-[12.5px]" style={muted}>{pt ? 'Não foi possível usar o microfone. Pode digitar a resposta.' : 'Could not use the microphone. You can type instead.'}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {!typed && (
          <Button variant={sp.listening ? 'default' : 'outline'} onClick={() => void toggle()} disabled={sending}>
            {sp.listening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}{sp.listening ? (pt ? 'Parar' : 'Stop') : text ? (pt ? 'Gravar de novo' : 'Record again') : (pt ? 'Falar' : 'Speak')}
          </Button>
        )}
        <Button onClick={() => void send()} disabled={!text.trim() || sending || sp.listening}>{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{pt ? 'Enviar' : 'Send'}</Button>
        {!typed && <button type="button" onClick={() => { void sp.stop(); setTyped(true) }} className="ml-auto inline-flex items-center gap-1 text-[12.5px] underline underline-offset-4" style={muted}><Keyboard className="w-3.5 h-3.5" />{pt ? 'Digitar' : 'Type'}</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
type Step = { kind: 'read'; i: number } | { kind: 'open'; i: number } | { kind: 'dictation'; i: number } | { kind: 'talk' } | { kind: 'scoring' }

function TestRunner({ run, pt, onDone, onError, onQuit }: { run: Run; pt: boolean; onDone: (r: Result) => void; onError: (msg: string) => void; onQuit: () => void }) {
  const { items, attemptId } = run
  const total = items.read.length + items.open.length + items.dictation.length + 1
  const [step, setStep] = useState<Step>({ kind: 'read', i: 0 })
  const done = step.kind === 'read' ? step.i : step.kind === 'open' ? items.read.length + step.i : step.kind === 'dictation' ? items.read.length + items.open.length + step.i : step.kind === 'talk' ? total - 1 : total
  const part = step.kind === 'read' || step.kind === 'open' ? 1 : step.kind === 'dictation' ? 2 : 3
  // A voz do tutor no teste é a do personagem escolhido na conversa.
  const chosen = useAvatarSettings(s => s.characterId)
  const tutor = characterById(effectiveCharacterId(chosen))
  useEffect(() => {
    const prev = getSpeakerVoice()
    if (tutor) setSpeakerVoice(tutor.voice)
    return () => { setSpeakerVoice(prev); stopSpeaking() }
  }, [tutor])

  const next = () => setStep(s => {
    if (s.kind === 'read') return s.i + 1 < items.read.length ? { kind: 'read', i: s.i + 1 } : { kind: 'open', i: 0 }
    if (s.kind === 'open') return s.i + 1 < items.open.length ? { kind: 'open', i: s.i + 1 } : { kind: 'dictation', i: 0 }
    if (s.kind === 'dictation') return s.i + 1 < items.dictation.length ? { kind: 'dictation', i: s.i + 1 } : { kind: 'talk' }
    return { kind: 'scoring' }
  })
  const guard = async (fn: () => Promise<unknown>) => { try { await fn(); return true } catch (e) { onError(errorText(e, pt)); return false } }

  const [busyRetry, setBusyRetry] = useState(false)
  const finish = async () => {
    setStep({ kind: 'scoring' }); setBusyRetry(false)
    try { onDone(await placement.finish(attemptId)) } catch (e) {
      onError(errorText(e, pt))
      // Correção ocupada: as respostas ficam salvas e dá para tentar de novo sem refazer o teste.
      if (e instanceof PlacementError && e.code === 'scoring_busy') setBusyRetry(true); else onQuit()
    }
  }

  return (
    <div className="space-y-4">
      {/* Etapas: Fala, Ditado, Conversa, com o progresso dentro de cada uma. */}
      <ol className="grid grid-cols-3 gap-2">
        {[pt ? 'Fala' : 'Speaking', pt ? 'Ditado' : 'Dictation', pt ? 'Conversa' : 'Conversation'].map((label, i) => {
          const n = i + 1
          const state = n < part || step.kind === 'scoring' ? 'done' : n === part ? 'now' : 'next'
          const inside = n === 1 ? (step.kind === 'read' ? step.i / (items.read.length + items.open.length) : step.kind === 'open' ? (items.read.length + step.i) / (items.read.length + items.open.length) : 1)
            : n === 2 ? (step.kind === 'dictation' ? step.i / items.dictation.length : 1) : 0.5
          return (
            <li key={label} className="space-y-1.5">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                <motion.div className="h-full rounded-full" style={{ backgroundColor: 'var(--theme-text)' }} animate={{ width: state === 'done' ? '100%' : state === 'now' ? `${Math.max(6, inside * 100)}%` : '0%' }} />
              </div>
              <p className={`text-[12.5px] ${state === 'now' ? 'font-semibold' : ''}`} style={{ color: state === 'next' ? 'var(--theme-text-secondary)' : 'var(--theme-text)' }}>{n}. {label}</p>
            </li>
          )
        })}
      </ol>
      {tutor && step.kind !== 'scoring' && (
        <div className="flex items-center gap-3">
          <img src={characterAvatarUrl(tutor.id)} alt="" className="w-10 h-10 rounded-full object-cover" />
          <p className="text-[13.5px]" style={muted}>{pt ? `${tutor.name} acompanha o seu teste.` : `${tutor.name} is with you for this test.`}</p>
        </div>
      )}
      <AnimatePresence mode="wait">
        <motion.section key={JSON.stringify(step)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className={card} style={cardStyle}>
          {step.kind === 'read' && (
            <Item title={pt ? 'Leia em voz alta' : 'Read aloud'} subtitle={pt ? 'Toque em Falar e leia a frase com calma.' : 'Tap Speak and read the sentence calmly.'}>
              <p className="mt-3 font-display text-[22px] leading-snug">“{items.read[step.i].text}”</p>
              <SpeakBox pt={pt} hint={pt ? 'Digite a frase (vale menos)' : 'Type the sentence (counts less)'} onAnswer={async (t, typed, durationMs) => { if (await guard(() => placement.read(attemptId, items.read[step.i].id, t, { typed, durationMs }))) next() }} />
            </Item>
          )}
          {step.kind === 'open' && (
            <OpenItem pt={pt} question={items.open[step.i].question} onAnswer={async (t, typed) => { if (await guard(() => placement.open(attemptId, items.open[step.i].id, t, typed))) next() }} />
          )}
          {step.kind === 'dictation' && (
            <DictationItem key={items.dictation[step.i].id} pt={pt} n={step.i + 1} of={items.dictation.length} say={items.dictation[step.i].say} onAnswer={async t => { if (await guard(() => placement.dictation(attemptId, items.dictation[step.i].id, t))) next() }} />
          )}
          {step.kind === 'talk' && <TalkItem pt={pt} run={run} onFinish={() => void finish()} onError={onError} />}
          {step.kind === 'scoring' && (
            <div className="py-10 flex flex-col items-center text-center gap-3">
              {busyRetry
                ? <Button onClick={() => void finish()}>{pt ? 'Tentar calcular de novo' : 'Try scoring again'}</Button>
                : <><Loader2 className="w-6 h-6 animate-spin" /><p className="text-[15px]">{pt ? 'Calculando o seu resultado…' : 'Working out your result…'}</p></>}
            </div>
          )}
        </motion.section>
      </AnimatePresence>
      {step.kind !== 'scoring' && <button type="button" onClick={onQuit} className="text-[12.5px] underline underline-offset-4" style={muted}>{pt ? 'Sair do teste (dá para voltar em até 24 h começando de novo)' : 'Leave the test'}</button>}
    </div>
  )
}

function Item({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-[16px] font-semibold">{title}</h2>
      {subtitle && <p className="text-[13.5px]" style={muted}>{subtitle}</p>}
      {children}
    </div>
  )
}

function OpenItem({ pt, question, onAnswer }: { pt: boolean; question: string; onAnswer: (t: string, typed: boolean) => Promise<void> }) {
  useEffect(() => { void speak(question, { language: 'en', context: 'phrase' }) }, [question])
  return (
    <Item title={pt ? 'Responda falando' : 'Answer out loud'} subtitle={pt ? 'Responda com algumas frases, como numa conversa.' : 'Answer with a few sentences, like in a chat.'}>
      <div className="mt-3 flex items-start gap-2">
        <button type="button" onClick={() => void speak(question, { language: 'en', context: 'phrase' })} aria-label={pt ? 'Ouvir a pergunta' : 'Hear the question'} className="shrink-0 w-9 h-9 rounded-full grid place-items-center border" style={{ borderColor: 'var(--theme-border)' }}><Volume2 className="w-4 h-4" /></button>
        <p className="font-display text-[22px] leading-snug">{question}</p>
      </div>
      <SpeakBox pt={pt} onAnswer={(t, typed) => onAnswer(t, typed)} />
    </Item>
  )
}

function DictationItem({ pt, n, of, say, onAnswer }: { pt: boolean; n: number; of: number; say: string; onAnswer: (t: string) => Promise<void> }) {
  const [plays, setPlays] = useState(0)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const play = (rate: number) => { setPlays(p => p + 1); void speak(say, { language: 'en', context: 'phrase', rate }) }
  useEffect(() => { const t = window.setTimeout(() => play(0.95), 400); return () => { window.clearTimeout(t); stopSpeaking() } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Item title={pt ? `Ditado ${n} de ${of}` : `Dictation ${n} of ${of}`} subtitle={pt ? 'Ouça e escreva exatamente o que ouviu. Pode ouvir até 3 vezes.' : 'Listen and write exactly what you hear. Up to 3 plays.'}>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" disabled={plays >= 3} onClick={() => play(0.95)}><Volume2 className="w-4 h-4" />{pt ? 'Ouvir' : 'Play'}</Button>
        <Button variant="outline" disabled={plays >= 3} onClick={() => play(0.7)}>{pt ? 'Mais devagar' : 'Slower'}</Button>
        <span className="self-center text-[12.5px]" style={muted}>{3 - Math.min(3, plays)} {pt ? 'restantes' : 'left'}</span>
      </div>
      <input value={text} onChange={e => setText(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false}
        onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { setSending(true); void onAnswer(text).finally(() => setSending(false)) } }}
        placeholder={pt ? 'Escreva aqui' : 'Type here'} className="mt-4 w-full h-12 rounded-xl border px-3.5 text-[16px] bg-transparent outline-none" style={{ borderColor: 'var(--theme-border)' }} />
      <Button className="mt-3" disabled={!text.trim() || sending} onClick={() => { setSending(true); void onAnswer(text).finally(() => setSending(false)) }}>{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{pt ? 'Próxima' : 'Next'}</Button>
    </Item>
  )
}

function TalkItem({ pt, run, onFinish, onError }: { pt: boolean; run: Run; onFinish: () => void; onError: (msg: string) => void }) {
  const [turns, setTurns] = useState<{ role: 'ai' | 'user'; text: string }[]>([{ role: 'ai', text: run.items.talk.opening }])
  const [over, setOver] = useState(false)
  const learner = turns.filter(t => t.role === 'user').length
  useEffect(() => { void speak(run.items.talk.opening, { language: 'en', context: 'phrase' }) }, [run.items.talk.opening])
  const answer = async (text: string, typed: boolean) => {
    setTurns(t => [...t, { role: 'user', text }])
    try {
      const r = await placement.turn(run.attemptId, text, typed)
      setTurns(t => [...t, { role: 'ai', text: r.reply }])
      void speak(r.reply, { language: 'en', context: 'phrase' })
      if (r.done) setOver(true)
    } catch (e) { onError(errorText(e, pt)) }
  }
  return (
    <Item title={pt ? 'Conversa' : 'Conversation'} subtitle={pt ? 'Converse naturalmente. Responda com frases completas.' : 'Talk naturally. Answer in full sentences.'}>
      <ul className="mt-4 space-y-2 max-h-72 overflow-y-auto">
        {turns.map((t, i) => (
          <li key={i} className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[14.5px] ${t.role === 'user' ? 'ml-auto' : ''}`}
            style={t.role === 'user' ? { backgroundColor: 'var(--theme-text)', color: 'var(--theme-bg)' } : { backgroundColor: 'var(--theme-bg-secondary)' }}>{t.text}</li>
        ))}
      </ul>
      {over
        ? <Button className="mt-4" onClick={onFinish}><Check className="w-4 h-4" />{pt ? 'Ver o resultado' : 'See the result'}</Button>
        : <>
            <SpeakBox pt={pt} onAnswer={(t, typed) => answer(t, typed)} />
            {learner >= 2 && <button type="button" onClick={onFinish} className="mt-3 text-[12.5px] underline underline-offset-4" style={muted}>{pt ? 'Terminar a conversa e ver o resultado' : 'End the conversation and see the result'}</button>}
          </>}
    </Item>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
function ResultView({ result, pt, busy, onPromotion, onStepDown, onBack }: { result: Result; pt: boolean; busy: boolean; onPromotion: () => void; onStepDown: () => void; onBack: () => void }) {
  const navigate = useNavigate()
  const s = result.scores
  const lower = CEFR[Math.max(0, CEFR.findIndex(b => b.id === result.level) - 1)].id
  const headline = {
    confirmed: pt ? `Seu nível ${levelName(result.level, pt)} está confirmado!` : `Your ${levelName(result.level, pt)} level is confirmed!`,
    promote: pt ? 'Você foi muito bem!' : 'You did really well!',
    promoted: pt ? `Você agora é ${result.newLevel}!` : `You are now ${result.newLevel}!`,
    not_promoted: pt ? `Ainda não foi desta vez para o ${levelName(result.level, pt)}` : `Not quite ${levelName(result.level, pt)} yet`,
    step_down: pt ? 'Vamos ajustar o ritmo?' : 'Shall we adjust the pace?',
  }[result.outcome]
  const body = {
    confirmed: pt ? 'O selo verificado já está no seu perfil. Continue com os tutores e a leitura diária para chegar ao próximo nível.' : 'The verified badge is on your profile. Keep going with tutors and daily reading to reach the next level.',
    promote: pt ? `Parece que o seu inglês está acima do ${levelName(result.level, pt)}. Quer fazer o teste do ${levelName(result.next, pt)} agora?` : `Your English seems above ${levelName(result.level, pt)}. Take the ${levelName(result.next, pt)} test now?`,
    promoted: pt ? 'Novo emblema conquistado. Os tutores e os livros já se adaptam ao novo nível.' : 'New emblem unlocked. Tutors and books now adapt to your new level.',
    not_promoted: pt ? 'Você continua no seu nível atual, verificado. Treine com os tutores e a leitura: se ainda tiver tentativa este mês, pode tentar de novo; senão, no mês que vem.' : 'You stay at your current verified level. Keep practising: the next promotion test opens next month.',
    step_down: pt ? `Para aprender com mais conforto, sugerimos o ${lower}. Ou mantenha o nível e treine para refazer.` : `To learn more comfortably we suggest ${lower}. Or keep your level and practise to retake.`,
  }[result.outcome]
  const bars: [string, number][] = [[pt ? 'Fala' : 'Speaking', s.speaking], [pt ? 'Escuta (ditado)' : 'Listening', s.listening], [pt ? 'Conversa' : 'Conversation', s.interaction]]
  return (
    <section className={card} style={cardStyle}>
      <p className="text-[12.5px]" style={muted}>{result.kind === 'promotion' ? (pt ? `Teste de promoção · ${levelName(result.level, pt)}` : `Promotion test · ${levelName(result.level, pt)}`) : (pt ? `Teste ${levelName(result.level, pt)}` : `${levelName(result.level, pt)} test`)}</p>
      <h2 className="mt-1 font-display text-[28px] leading-tight">{headline}</h2>
      <p className="mt-2 text-[14.5px]" style={muted}>{body}</p>
      {s.summary && <p className="mt-3 text-[14.5px]">{s.summary}</p>}
      <div className="mt-5 space-y-3">
        {bars.map(([label, v]) => (
          <div key={label}>
            <div className="flex justify-between text-[13px]"><span>{label}</span><span className="tabular-nums" style={muted}>{Math.round(v)}</span></div>
            <div className="mt-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
              <motion.div className="h-full rounded-full" style={{ backgroundColor: 'var(--theme-text)' }} initial={{ width: 0 }} animate={{ width: `${Math.max(2, v)}%` }} transition={{ duration: 0.6 }} />
            </div>
          </div>
        ))}
      </div>
      {(s.strengths.length > 0 || s.improve.length > 0) && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 text-[13.5px]">
          {s.strengths.length > 0 && <div><p className="font-medium">{pt ? 'Pontos fortes' : 'Strengths'}</p><ul className="mt-1 space-y-1" style={muted}>{s.strengths.map(x => <li key={x}>· {x}</li>)}</ul></div>}
          {s.improve.length > 0 && <div><p className="font-medium">{pt ? 'Para treinar' : 'To practise'}</p><ul className="mt-1 space-y-1" style={muted}>{s.improve.map(x => <li key={x}>· {x}</li>)}</ul></div>}
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        {result.outcome === 'promote' && result.next && <Button disabled={busy} onClick={onPromotion}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}{pt ? `Fazer o teste do ${levelName(result.next, pt)}` : `Take the ${levelName(result.next, pt)} test`}</Button>}
        {result.outcome === 'step_down' && <Button disabled={busy} onClick={onStepDown}>{pt ? `Ajustar para ${lower}` : `Switch to ${lower}`}</Button>}
        <Button variant="outline" onClick={() => navigate('/conversar')}>{pt ? 'Treinar com um tutor' : 'Practise with a tutor'}</Button>
        <Button variant="outline" onClick={() => navigate('/gallery')}>{pt ? 'Escolher um livro' : 'Pick a book'}</Button>
        <Button variant="ghost" onClick={onBack}>{result.outcome === 'step_down' ? (pt ? 'Manter e treinar' : 'Keep and practise') : (pt ? 'Voltar' : 'Back')}</Button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
/** Promoção: o selo antigo encolhe, o novo entra com um anel e o emblema aparece. Curta, sem gradiente, respeita "reduzir
 *  movimento" (nesse caso só aparece). */
function LevelUp({ from, to, pt, onClose }: { from: CefrId; to: CefrId; pt: boolean; onClose: () => void }) {
  const reduce = useReducedMotion()
  const chosen = useAvatarSettings(s => s.characterId)
  const tutor = characterById(effectiveCharacterId(chosen))
  useEffect(() => { const t = window.setTimeout(onClose, 6500); return () => window.clearTimeout(t) }, [onClose])
  return (
    <motion.div role="dialog" aria-label={pt ? 'Novo nível' : 'New level'} className="fixed inset-0 z-[80] grid place-items-center px-6" onClick={onClose}
      style={{ backgroundColor: 'color-mix(in srgb, var(--theme-bg) 97%, transparent)', backdropFilter: 'blur(6px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="flex flex-col items-center text-center">
        <div className="relative w-40 h-40 grid place-items-center">
          {!reduce && <motion.span aria-hidden className="absolute inset-0 rounded-full" style={{ border: '2px solid var(--theme-text)' }} initial={{ scale: 0.6, opacity: 0.8 }} animate={{ scale: 1.5, opacity: 0 }} transition={{ duration: 1.2, delay: 0.7, ease: 'easeOut' }} />}
          <motion.span className="absolute text-[34px] font-semibold" style={{ color: 'var(--theme-text-secondary)' }} initial={{ scale: 1, opacity: 1 }} animate={{ scale: reduce ? 1 : 0.4, opacity: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>{from}</motion.span>
          <motion.span initial={{ scale: reduce ? 1 : 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.6 }}><Emblem level={to} size={128} pt={pt} /></motion.span>
        </div>
        <motion.p className="mt-6 font-display text-[30px] leading-tight" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1 }}>{pt ? `Você agora é ${to}` : `You are now ${to}`}</motion.p>
        <motion.p className="mt-1 text-[15px]" style={muted} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>{bandName(to, pt)} · {pt ? 'novo emblema no seu perfil' : 'new emblem on your profile'}</motion.p>
        {tutor && (
          <motion.div className="mt-6 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)' }} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.5 }}>
            <img src={characterAvatarUrl(tutor.id)} alt="" className="w-10 h-10 rounded-full object-cover" />
            <p className="text-[14px] text-left">{pt ? `${tutor.name}: Parabéns! Sabia que você ia conseguir.` : `${tutor.name}: Congratulations! I knew you could do it.`}</p>
          </motion.div>
        )}
        <Link to="/me" className="mt-6 text-[13px] underline underline-offset-4" style={muted}>{pt ? 'Ver no meu perfil' : 'See it on my profile'}</Link>
      </div>
    </motion.div>
  )
}
