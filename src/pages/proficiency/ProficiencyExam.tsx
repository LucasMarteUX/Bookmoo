// Ambiente imersivo da English Proficiency Test (tela cheia, sem a barra lateral): checagem de som e microfone,
// introdução de cada seção, cronômetro, questões, transições sem nota e "avaliação em andamento".
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, Check, Clock, Headphones, Loader2, Mic, PenLine, ShieldCheck, Volume2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { askConfirm, ConfirmHost } from '@/components/ui/confirm'
import { Toaster, toast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { proficiency, ProfError, profErrorText, SECTION_LABEL, SECTION_PLAN, TASK_LABEL, type ExamItem, type ExamState, type Overview, type Section } from '@/lib/proficiencyApi'
import { micStream, record, releaseMic, testChime } from '@/lib/proficiencyAudio'
import { TaskView } from './examTasks'
import { characterAvatarUrl } from '@/lib/livliv/characters'
import { rememberPending, ScoringWait } from './ScoringWait'
import { useAvatarSettings } from '@/store/useAvatarSettings'
import { effectiveCharacterId } from '@/lib/livliv/characters'

const muted = { color: 'var(--theme-text-secondary)' }
const cardStyle = { borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }
const ICON: Record<Section, typeof BookOpen> = { reading: BookOpen, listening: Headphones, writing: PenLine, speaking: Mic }
const ORDER: Section[] = ['reading', 'listening', 'writing', 'speaking']
const title = (s: Section) => s[0].toUpperCase() + s.slice(1)
const mmss = (ms: number) => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }

const INTRO: Record<Section, string[]> = {
  reading: ['Complete the Words: digite as letras que faltam nas palavras do texto.', 'Read in Daily Life: textos do dia a dia, como avisos, e-mails e cardápios.', 'Read an Academic Passage: um texto acadêmico curto com perguntas.'],
  listening: ['Cada áudio toca uma única vez, sem transcrição. As perguntas aparecem depois do áudio.', 'Listen and Choose a Response, conversas, anúncios e um trecho de aula.', 'Use fone de ouvido e mantenha o volume confortável.'],
  writing: ['Build a Sentence: 10 frases para montar, com 6 minutos no total.', 'Write an Email: 7 minutos.', 'Academic Discussion: 10 minutos. Corretor automático e colar ficam desativados.'],
  speaking: ['Listen and Repeat: 7 frases. Ouça e repita exatamente; o texto não aparece.', 'Interview: 4 perguntas, com até 45 segundos para cada resposta.', 'A gravação começa sozinha depois do sinal sonoro.'],
}

export function ProficiencyExam() {
  const { user, loading } = useAuth()
  const nav = useNavigate()
  const [ov, setOv] = useState<Overview | null>(null)
  const [phase, setPhase] = useState<'checks' | 'run' | 'scoring'>('checks')
  const [state, setState] = useState<ExamState | null>(null)
  const [error, setError] = useState('')
  const [resuming, setResuming] = useState(false)

  // A visão geral é lida uma vez: recarregar durante o início (a sessão acabou de ser criada) trocaria o título para "Retomar".
  const loaded = useRef(false)
  useEffect(() => {
    if (!user || loaded.current) return
    loaded.current = true
    proficiency.overview().then(o => { setOv(o); setResuming(!!o.active) }, e => setError(profErrorText(e)))
  }, [user])
  useEffect(() => () => { releaseMic(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}) }, [])

  const begin = async () => {
    setError('')
    try { document.documentElement.requestFullscreen?.().catch(() => {}) } catch { /* sem tela cheia (iOS) */ }
    try {
      const st = await proficiency.start({ mic: true, audio: true }, effectiveCharacterId(useAvatarSettings.getState().characterId))
      setState(st)
      setPhase(st.session.status === 'active' ? 'run' : 'scoring')
    } catch (e) { setError(profErrorText(e)) }
  }

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (ov && !ov.premium) return <Navigate to="/prova" replace />

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      <Toaster />
      <ConfirmHost />
      {phase === 'checks' && <Checks resuming={resuming} error={error} onExit={() => nav('/prova')} onReady={begin} />}
      {phase === 'run' && state && <Runner initial={state} onScoring={st => { setState(st); setPhase('scoring') }} onExit={() => nav('/prova')} />}
      {phase === 'scoring' && state && <Scoring sessionId={state.session.id} />}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// Checagem antes de começar
function Checks({ resuming, error, onReady, onExit }: { resuming: boolean; error: string; onReady: () => Promise<void>; onExit: () => void }) {
  const [consent, setConsent] = useState(false)
  const [audioOk, setAudioOk] = useState<boolean | null>(null)
  const [played, setPlayed] = useState(false)
  const [mic, setMic] = useState<'idle' | 'asking' | 'recording' | 'playback' | 'ok' | 'denied'>('idle')
  const [level, setLevel] = useState(0)
  const [busy, setBusy] = useState(false)
  const playbackUrl = useRef<string | null>(null)

  const testMic = async () => {
    setMic('asking')
    try {
      await micStream()
      setMic('recording')
      const r = await record(3500, setLevel)
      const rec = await r.done
      if (rec.peak < 0.04) { setMic('idle'); toast('Não ouvimos nada. Fale mais perto do microfone e tente de novo.', { tone: 'error' }); return }
      setMic('playback')
      playbackUrl.current = URL.createObjectURL(rec.blob)
      const a = new Audio(playbackUrl.current)
      await a.play().catch(() => {})
      a.onended = () => setMic('ok')
      setTimeout(() => setMic(m => m === 'playback' ? 'ok' : m), 4500)
    } catch { setMic('denied') }
  }
  const ready = consent && audioOk === true && mic === 'ok'
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-14">
        <div className="flex items-center justify-between">
          <p className="text-[12.5px]" style={muted}>English Proficiency Test</p>
          <button onClick={onExit} className="inline-flex items-center gap-1 text-[13px] font-medium" style={muted}><X className="w-4 h-4" />Sair</button>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <img src={characterAvatarUrl('bookmoo-mulher')} alt="" className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover shrink-0" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
          <div>
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em]" style={muted}>{resuming ? 'Bem-vindo de volta' : 'Olá, eu sou a Bia'}</p>
            <h1 className="mt-1 font-display text-[34px] md:text-[46px] leading-[1.02]">{resuming ? 'Retomar a prova' : 'Antes de começar'}</h1>
          </div>
        </div>
        <p className="mt-4 text-[15px] leading-relaxed" style={muted}>{resuming ? 'Sua prova continua de onde parou. O cronômetro não parou enquanto você esteve fora. Confirme o som e o microfone para seguir.' : 'Três verificações rápidas. Use fone de ouvido, fique num lugar silencioso e reserve 90 minutos sem interrupções.'}</p>

        <ol className="mt-8 space-y-3">
          <CheckRow n={1} done={consent} title="Gravação da voz" text="Na seção Speaking sua voz é gravada e enviada para avaliação. As gravações ficam guardadas de forma privada e são apagadas em até 30 dias; a nota e a transcrição ficam no seu histórico.">
            <label className="mt-3 flex items-start gap-2.5 text-[14px] cursor-pointer">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--theme-text)]" />
              Concordo com a gravação e a avaliação da minha voz e dos meus textos por IA.
            </label>
          </CheckRow>
          <CheckRow n={2} done={audioOk === true} title="Som" text="Toque o som de teste. Você deve ouvir três notas.">
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => { void testChime(); setPlayed(true) }}><Volume2 className="w-4 h-4" />Tocar som de teste</Button>
              {played && <>
                <Button variant={audioOk === true ? 'default' : 'secondary'} onClick={() => setAudioOk(true)}><Check className="w-4 h-4" />Ouvi</Button>
                <Button variant="ghost" onClick={() => setAudioOk(false)}>Não ouvi</Button>
              </>}
            </div>
            {audioOk === false && <p className="mt-2 text-[13px]" style={muted}>Confira o volume e se o fone está conectado, e toque de novo.</p>}
          </CheckRow>
          <CheckRow n={3} done={mic === 'ok'} title="Microfone" text="Grave 3 segundos dizendo uma frase em inglês. Você vai ouvir a gravação em seguida.">
            <div className="mt-3 flex items-center gap-3">
              <Button variant="outline" disabled={mic === 'asking' || mic === 'recording' || mic === 'playback'} onClick={() => void testMic()}>
                {mic === 'recording' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                {mic === 'recording' ? 'Gravando…' : mic === 'playback' ? 'Ouvindo a gravação…' : mic === 'ok' ? 'Testar de novo' : 'Testar microfone'}
              </Button>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} aria-hidden>
                <div className="h-full rounded-full transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%`, backgroundColor: 'var(--theme-text)' }} />
              </div>
            </div>
            {mic === 'denied' && <p className="mt-2 text-[13px]" style={{ color: 'var(--pastel-rose-fg)' }}>O navegador bloqueou o microfone. Libere o acesso nas permissões do site e tente de novo.</p>}
          </CheckRow>
        </ol>

        <div className="mt-8 rounded-2xl border p-4 flex gap-3 text-[13.5px] leading-relaxed" style={cardStyle}>
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <p style={muted}>Durante a prova não há dicas, tradução nem ajuda de IA, e nenhuma nota aparece antes do fim. Cada parte tem tempo rígido e não dá para voltar a uma parte encerrada.</p>
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl px-3 py-2.5 text-[14px]" style={{ backgroundColor: 'var(--pastel-rose-bg)', color: 'var(--pastel-rose-fg)' }}>{error}</p>}
        <div className="mt-6 flex items-center gap-3">
          <Button size="lg" disabled={!ready || busy} onClick={async () => { setBusy(true); await onReady(); setBusy(false) }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}{resuming ? 'Retomar em tela cheia' : 'Começar em tela cheia'}
          </Button>
          {!resuming && <p className="text-[13px]" style={muted}>A seção Reading começa em seguida: 30 minutos.</p>}
        </div>
      </div>
    </div>
  )
}

function CheckRow({ n, done, title, text, children }: { n: number; done: boolean; title: string; text: string; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl border p-5" style={cardStyle}>
      <div className="flex items-start gap-3">
        <span className="grid place-items-center w-7 h-7 shrink-0 rounded-full text-[13px] font-semibold border" style={done ? { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)', borderColor: 'var(--theme-primary)' } : { borderColor: 'var(--theme-border)' }}>
          {done ? <Check className="w-4 h-4" /> : n}
        </span>
        <div className="flex-1">
          <p className="text-[15.5px] font-semibold">{title}</p>
          <p className="mt-0.5 text-[13.5px] leading-relaxed" style={muted}>{text}</p>
          {children}
        </div>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// Prova em andamento
function Runner({ initial, onScoring, onExit }: { initial: ExamState; onScoring: (s: ExamState) => void; onExit: () => void }) {
  const [st, setSt] = useState(initial)
  const s = st.session
  const sid = s.id
  const posKey = `prof:${sid}:${s.section}:${s.module}`
  const [idx, setIdx] = useState(() => Number(sessionStorage.getItem(posKey) ?? 0) || 0)
  const [offset, setOffset] = useState(() => new Date(initial.session.serverNow).getTime() - Date.now())
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(0)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [local, setLocal] = useState(initial.responses)
  const pending = useRef(new Map<string, { sid: string; part: string; response: Record<string, unknown>; timer: ReturnType<typeof setTimeout> | null }>())
  const advancing = useRef(false)
  const opened = useRef(new Set<string>())

  const apply = useCallback((next: ExamState) => {
    setOffset(new Date(next.session.serverNow).getTime() - Date.now())
    setSt(next)
    setLocal(next.responses)
    if (next.session.status !== 'active') onScoring(next)
  }, [onScoring])

  // Troca de módulo/seção: posição volta ao início (ou à salva desta parte).
  const modKey = `${s.section}:${s.module}`
  const lastMod = useRef(modKey)
  useEffect(() => {
    if (lastMod.current !== modKey) { lastMod.current = modKey; setIdx(Number(sessionStorage.getItem(posKey) ?? 0) || 0) }
  }, [modKey, posKey])
  useEffect(() => { sessionStorage.setItem(posKey, String(idx)) }, [posKey, idx])

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t) }, [])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  // ---- salvamento automático
  const send = useCallback(async (key: string) => {
    const p = pending.current.get(key)
    if (!p) return
    pending.current.delete(key)
    if (p.timer) clearTimeout(p.timer)
    setSaving(n => n + 1)
    try {
      await proficiency.save(sid, p.sid, p.part, p.response)
      setSavedAt(Date.now())
    } catch (e) {
      if (e instanceof ProfError && (e.code === 'time_up' || e.code === 'item_not_current')) apply(await proficiency.state(sid))
      else toast(profErrorText(e), { tone: 'error' })
    } finally { setSaving(n => n - 1) }
  }, [sid, apply])
  const onSave = useCallback((itemSid: string) => (part: string, response: Record<string, unknown>, immediate?: boolean) => {
    setLocal(l => ({ ...l, [itemSid]: { ...(l[itemSid] ?? {}), [part]: response } }))
    const key = `${itemSid}|${part}`
    const prev = pending.current.get(key)
    if (prev?.timer) clearTimeout(prev.timer)
    const entry = { sid: itemSid, part, response, timer: null as ReturnType<typeof setTimeout> | null }
    pending.current.set(key, entry)
    if (immediate) void send(key)
    else entry.timer = setTimeout(() => void send(key), 900)
  }, [send])
  const flush = useCallback(async () => { await Promise.all([...pending.current.keys()].map(k => send(k))) }, [send])

  // ---- navegação
  const advance = useCallback(async () => {
    if (advancing.current) return
    advancing.current = true
    setBusy(true)
    try {
      await flush()
      const next = await proficiency.advance(sid, String(s.section), String(s.module))
      sessionStorage.removeItem(posKey)
      apply(next)
    } catch (e) {
      toast(profErrorText(e), { tone: 'error' })
      try { apply(await proficiency.state(sid)) } catch { /* segue */ }
    } finally { advancing.current = false; setBusy(false) }
  }, [flush, sid, s.section, s.module, posKey, apply])

  const items = st.items
  const item: ExamItem | undefined = items[Math.min(idx, items.length - 1)]
  const serverNow = now + offset
  const moduleLeft = new Date(s.deadline).getTime() - serverNow
  const taskLeft = item?.deadlineAt ? new Date(item.deadlineAt).getTime() - serverNow : null
  const shownLeft = taskLeft != null ? Math.min(taskLeft, moduleLeft) : moduleLeft
  const pendingIntro = s.pending && serverNow < new Date(s.startsAt).getTime()

  // Tarefas cronometradas (Writing/Speaking): o relógio da tarefa começa quando ela aparece.
  useEffect(() => {
    if (!item || pendingIntro || (s.section !== 'writing' && s.section !== 'speaking') || item.openedAt || opened.current.has(item.sid)) return
    opened.current.add(item.sid)
    proficiency.open(sid, item.sid).then(next => { setOffset(new Date(next.session.serverNow).getTime() - Date.now()); setSt(cur => ({ ...cur, items: next.items, session: next.session })) }, () => {})
  }, [item, pendingIntro, s.section, sid])

  // Avança na hora; o salvamento pendente termina em segundo plano (só o fim do módulo espera tudo salvar).
  const goNext = useCallback(async () => {
    if (idx < items.length - 1) { void flush(); setIdx(i => Math.min(i + 1, items.length - 1)); window.scrollTo({ top: 0 }) }
    else await advance()
  }, [flush, idx, items.length, advance])

  // Tempo esgotado: do módulo inteiro → avança; de uma tarefa → vai para a próxima.
  const timeoutFired = useRef('')
  useEffect(() => {
    if (pendingIntro || busy || !item) return
    if (moduleLeft <= 0 && timeoutFired.current !== `m:${modKey}`) {
      timeoutFired.current = `m:${modKey}`
      toast('O tempo desta parte acabou. Suas respostas foram salvas.')
      void advance()
      return
    }
    if (taskLeft != null && taskLeft <= 0 && timeoutFired.current !== `t:${item.sid}`) {
      timeoutFired.current = `t:${item.sid}`
      if (item.task === 'build_sentence') {
        const j = items.findIndex(x => x.task !== 'build_sentence')
        if (j > idx) { void flush(); setIdx(j) } else void advance()
      } else if (item.task === 'write_email' || item.task === 'academic_discussion') void goNext()
    }
  }, [moduleLeft, taskLeft, pendingIntro, busy, item, modKey, items, idx, advance, goNext, flush])

  const exit = async () => {
    if (await askConfirm('Sair da prova agora?', { detail: 'O cronômetro continua correndo. Você pode voltar e retomar enquanto houver tempo; o que não for respondido fica em branco.', confirmLabel: 'Sair' })) {
      await flush()
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
      onExit()
    }
  }

  const section = s.section as Section
  const partLabel = s.module === 'router' ? 'Parte 1 de 2' : s.module === 'easy' || s.module === 'hard' ? 'Parte 2 de 2' : null
  const isSpeaking = section === 'speaking'
  const lastInModule = idx >= items.length - 1
  const low = shownLeft < 60_000

  return (
    <>
      <header className="sticky top-0 z-20 border-b backdrop-blur" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'color-mix(in srgb, var(--theme-bg) 92%, transparent)', paddingTop: 'var(--safe-t, 0px)' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] leading-none" style={muted}>English Proficiency Test</p>
            <p className="mt-1 text-[14.5px] font-semibold leading-none truncate">{title(section)}{partLabel && <span className="font-normal" style={muted}> · {partLabel}</span>}</p>
          </div>
          <ol className="hidden md:flex items-center gap-1.5" aria-label="Seções">
            {ORDER.map(x => {
              const done = s.sections.find(y => y.id === x)?.done
              const cur = x === section
              return <li key={x} className="flex items-center gap-1.5 text-[12.5px]" style={cur ? undefined : muted}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: done || cur ? 'var(--theme-text)' : 'var(--theme-border)' }} />{title(x)}
              </li>
            })}
          </ol>
          <span className="hidden sm:inline text-[12px] w-16 text-right" style={muted} aria-live="polite">{saving > 0 ? 'Salvando…' : savedAt ? 'Salvo' : ''}</span>
          {!pendingIntro && (
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 h-9 text-[15px] font-semibold tabular-nums border"
              style={low ? { backgroundColor: 'var(--pastel-amber-bg)', color: 'var(--pastel-amber-fg)', borderColor: 'var(--pastel-amber-bd)' } : { borderColor: 'var(--theme-border)' }}
              aria-label={`Tempo restante ${mmss(shownLeft)}`}>
              <Clock className="w-4 h-4" />{mmss(shownLeft)}
            </span>
          )}
          <button onClick={() => void exit()} aria-label="Sair da prova" className="grid place-items-center w-9 h-9 rounded-lg hover:bg-[var(--ui-hover)]"><X className="w-4 h-4" /></button>
        </div>
        {!pendingIntro && items.length > 1 && (
          <div className="h-[3px]" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
            <div className="h-full transition-[width] duration-300" style={{ width: `${((idx + 1) / items.length) * 100}%`, backgroundColor: 'var(--theme-text)' }} />
          </div>
        )}
      </header>

      <main className="flex-1">
        {pendingIntro
          ? <SectionIntro section={section} startsIn={new Date(s.startsAt).getTime() - serverNow} busy={busy} onBegin={async () => {
              setBusy(true)
              try { apply(await proficiency.begin(sid, section)) } catch (e) { toast(profErrorText(e), { tone: 'error' }) } finally { setBusy(false) }
            }} />
          : busy && !item ? <Centered><Loader2 className="w-6 h-6 animate-spin" /></Centered>
          : item ? (
            <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
              <div className="mb-6 flex items-baseline justify-between gap-4">
                <p className="text-[12.5px] uppercase tracking-[0.08em]" style={muted}>{TASK_LABEL[item.task]}</p>
                <p className="text-[12.5px] tabular-nums" style={muted}>{idx + 1} de {items.length}</p>
              </div>
              <TaskView key={item.sid} sessionId={sid} item={item} saved={local[item.sid] ?? {}} onSave={onSave(item.sid)}
                locked={busy || shownLeft <= 0} autoStart={isSpeaking} onDone={isSpeaking ? () => void goNext() : undefined}
                onError={m => toast(m, { tone: 'error' })} />
            </div>
          ) : <Centered><p style={muted}>Carregando…</p></Centered>}
      </main>

      {!pendingIntro && item && !isSpeaking && (
        <footer className="sticky bottom-0 border-t" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)', paddingBottom: 'var(--safe-b, 0px)' }}>
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
            <p className="text-[12.5px]" style={muted}>{lastInModule ? 'Esta é a última questão desta parte.' : 'Não é possível voltar depois de avançar.'}</p>
            <Button size="lg" disabled={busy} onClick={async () => {
              if (lastInModule && !(await askConfirm(s.module === 'router' ? 'Concluir a parte 1?' : `Concluir ${title(section)}?`, { detail: 'Depois de concluir, não é possível voltar a esta parte.', confirmLabel: 'Concluir' }))) return
              await goNext()
            }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{lastInModule ? 'Concluir parte' : 'Próxima'}<ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </footer>
      )}
    </>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[60vh] grid place-items-center">{children}</div>
}

function SectionIntro({ section, startsIn, busy, onBegin }: { section: Section; startsIn: number; busy: boolean; onBegin: () => void }) {
  const Icon = ICON[section]
  const p = SECTION_PLAN[section]
  const i = ORDER.indexOf(section)
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-16">
      {/* Trilha das seções: o que já foi feito e onde a pessoa está. */}
      <ol className="grid grid-cols-4 gap-2" aria-label="Seções">
        {ORDER.map((x, k) => (
          <li key={x}>
            <div className="h-1.5 rounded-full" style={{ backgroundColor: k <= i ? 'var(--theme-text)' : 'var(--theme-border)', opacity: k < i ? 0.5 : 1 }} />
            <p className={`mt-2 text-[12px] ${k === i ? 'font-semibold' : ''}`} style={k === i ? undefined : muted}>{k < i ? <Check className="inline w-3 h-3 mr-1 -mt-0.5" /> : null}{title(x)}</p>
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-start">
        <div>
          {i > 0 && <p className="text-[13px] inline-flex items-center gap-2 font-medium" style={muted}><Check className="w-4 h-4" />{title(ORDER[i - 1])} concluída. Respire um pouco antes de seguir.</p>}
          <div className="mt-4 flex items-center gap-4">
            <span className="grid place-items-center w-16 h-16 rounded-2xl" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}><Icon className="w-7 h-7" /></span>
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em]" style={muted}>Seção {i + 1} de 4 · {SECTION_LABEL[section].pt}</p>
              <h2 className="font-display text-[48px] md:text-[60px] leading-[0.95]">{title(section)}</h2>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[14px] font-medium tabular-nums" style={{ borderColor: 'var(--theme-border)' }}><Clock className="w-4 h-4" />{p.minutes} minutos</span>
            <span className="inline-flex items-center h-9 px-3 rounded-full border text-[14px] font-medium tabular-nums" style={{ borderColor: 'var(--theme-border)' }}>{p.items} itens</span>
            {(section === 'reading' || section === 'listening') && <span className="inline-flex items-center h-9 px-3 rounded-full border text-[14px]" style={{ borderColor: 'var(--theme-border)', ...muted }}>2 partes, adaptativa</span>}
          </div>
          <ul className="mt-6 space-y-3">
            {INTRO[section].map(t => <li key={t} className="flex gap-3 text-[15px] leading-relaxed"><span className="mt-2 w-1.5 h-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--theme-text)' }} />{t}</li>)}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button size="lg" disabled={busy} onClick={onBegin} className="h-12 px-6">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}Começar {title(section)}</Button>
            <p className="text-[13px] tabular-nums" style={muted}>O relógio começa ao tocar. Sem toque, começa sozinha em {mmss(startsIn)}.</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {p.tasks.map((t, k) => (
            <div key={t} className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
              <span className="grid place-items-center w-8 h-8 rounded-lg text-[13px] font-semibold tabular-nums" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{k + 1}</span>
              <span className="text-[14.5px] font-medium">{TASK_LABEL[t]}</span>
            </div>
          ))}
          {section === 'speaking' && (
            <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
              <img src={characterAvatarUrl('bookmoo-mulher')} alt="" className="w-12 h-12 rounded-full object-cover" />
              <p className="text-[13.5px] leading-snug">A Bia conduz a entrevista. Ela pergunta e você responde depois do sinal.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
function Scoring({ sessionId }: { sessionId: string }) {
  const nav = useNavigate()
  useEffect(() => {
    releaseMic()
    rememberPending(sessionId)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }, [sessionId])
  return <div className="flex-1 grid place-items-center"><ScoringWait sessionId={sessionId} onReady={() => nav(`/prova/resultado/${sessionId}`, { replace: true })} /></div>
}
