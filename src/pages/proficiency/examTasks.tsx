// Telas de cada tipo de tarefa da English Proficiency Test. Recebem o conteúdo público da questão e as respostas salvas;
// cada mudança vai para `onSave` (o salvamento automático fica no ExamRunner).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Mic, Play, RotateCcw, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { proficiency, uploadRecording, type Choice, type ExamItem, type Segment } from '@/lib/proficiencyApi'
import { beep, playOnce, record } from '@/lib/proficiencyAudio'
import { playClip } from '@/lib/tts'
import { CharacterAvatar } from '@/components/voice/CharacterAvatar'

const muted = { color: 'var(--theme-text-secondary)' }
const cardStyle = { borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }
const LETTERS = ['A', 'B', 'C', 'D']

export type TaskProps = {
  sessionId: string
  item: ExamItem
  saved: Record<string, Record<string, unknown>>
  onSave: (part: string, response: Record<string, unknown>, immediate?: boolean) => void
  /** Tarefas que avançam sozinhas (Speaking) chamam ao terminar. */
  onDone?: () => void
  locked?: boolean
  /** Instrução da seção para itens de fala (auto). */
  autoStart?: boolean
  onError?: (msg: string) => void
}

// ---------------------------------------------------------------------------------------------------------------------
// Múltipla escolha (Reading e Listening)
function Questions({ questions, saved, onSave, locked }: { questions: Choice[]; saved: TaskProps['saved']; onSave: TaskProps['onSave']; locked?: boolean }) {
  return (
    <div className="space-y-6">
      {questions.map((q, qi) => {
        const chosen = saved[q.id]?.choice as number | null | undefined
        return (
          <fieldset key={q.id} disabled={locked}>
            <legend className="text-[15.5px] font-medium leading-snug">{questions.length > 1 && <span className="mr-1.5 tabular-nums" style={muted}>{qi + 1}.</span>}{q.prompt}</legend>
            <div className="mt-3 grid gap-2" role="radiogroup">
              {q.options.map((o, i) => {
                const on = chosen === i
                return (
                  <button key={i} type="button" role="radio" aria-checked={on} onClick={() => onSave(q.id, { choice: i }, true)}
                    className="flex items-start gap-3 text-left rounded-xl border px-3.5 py-3 text-[15px] transition-colors hover:bg-[var(--ui-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]/40"
                    style={{ borderColor: on ? 'var(--theme-text)' : 'var(--theme-border)', backgroundColor: on ? 'var(--theme-bg-secondary)' : 'var(--theme-card-bg)' }}>
                    <span className="grid place-items-center w-6 h-6 shrink-0 rounded-full text-[12px] font-semibold border"
                      style={on ? { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)', borderColor: 'var(--theme-primary)' } : { borderColor: 'var(--theme-border)' }}>{LETTERS[i]}</span>
                    <span className="pt-[1px]">{o}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
export function CompleteWords({ item, saved, onSave, locked }: TaskProps) {
  const segs = (item.content.segments ?? []) as Segment[]
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, String(v.letters ?? '')])))
  const refs = useRef<Record<string, HTMLInputElement | null>>({})
  const gapIds = segs.filter(s => s.t === 'gap').map(s => (s as { id: string }).id)
  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-[14px]" style={muted}>Complete as palavras do texto com as letras que faltam.</p>
      {!!item.content.title && <h3 className="mt-4 font-display text-[24px] leading-tight">{String(item.content.title)}</h3>}
      <p className="mt-4 text-[17px] leading-[2.1]">
        {segs.map((s, i) => s.t === 'text' ? <span key={i}>{s.v}</span> : (
          <span key={s.id} className="whitespace-nowrap">{s.prefix}<input
            ref={el => { refs.current[s.id] = el }}
            aria-label={`Lacuna ${gapIds.indexOf(s.id) + 1}`}
            value={vals[s.id] ?? ''} disabled={locked} maxLength={s.len} autoComplete="off" autoCapitalize="off" spellCheck={false}
            onChange={e => {
              const v = e.target.value.replace(/[^A-Za-z']/g, '')
              setVals(x => ({ ...x, [s.id]: v }))
              onSave(s.id, { letters: v })
              if (v.length >= s.len) refs.current[gapIds[gapIds.indexOf(s.id) + 1]]?.focus()
            }}
            className="mx-[1px] px-1 py-0 rounded-md border-b-2 bg-transparent text-[17px] tracking-[0.12em] focus:outline-none"
            style={{ width: `${s.len * 0.95 + 0.9}em`, borderColor: 'var(--theme-text)', backgroundColor: 'var(--theme-bg-secondary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} /></span>
        ))}
      </p>
    </div>
  )
}

const GENRE_PT: Record<string, string> = { notice: 'Aviso', email: 'E-mail', text_messages: 'Mensagens', menu: 'Cardápio', schedule: 'Horários', label: 'Rótulo', advertisement: 'Anúncio', post: 'Publicação' }

export function ReadingSet({ item, saved, onSave, locked }: TaskProps) {
  const c = item.content
  const academic = item.task === 'academic_passage'
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
      <article className={`rounded-2xl border p-5 md:p-6 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto ${academic ? '' : 'self-start'}`} style={cardStyle}>
        {!academic && <p className="text-[11.5px] uppercase tracking-[0.08em]" style={muted}>{GENRE_PT[String(c.genre)] ?? 'Texto'}</p>}
        <h3 className={`${academic ? 'font-display text-[24px]' : 'mt-1 text-[17px] font-semibold'} leading-tight`}>{String(c.title ?? '')}</h3>
        <div className={`mt-3 whitespace-pre-line ${academic ? 'text-[16.5px] leading-[1.75]' : 'text-[15.5px] leading-relaxed'}`} style={academic ? { fontFamily: 'var(--font-serif)' } : undefined}>{String(academic ? c.passage : c.body)}</div>
      </article>
      <Questions questions={(c.questions ?? []) as Choice[]} saved={saved} onSave={onSave} locked={locked} />
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// Listening: o áudio toca uma vez; as perguntas aparecem depois.
function Equalizer({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-end gap-[3px] h-5" aria-hidden>
      {[0, 1, 2, 3, 4].map(i => <span key={i} className={`w-[3px] rounded-full ${active ? 'prof-eq' : ''}`} style={{ height: active ? undefined : 4, backgroundColor: 'var(--theme-text)', animationDelay: `${i * 110}ms` }} />)}
    </span>
  )
}

function useOncePlayer(sessionId: string, item: ExamItem, key = 'main') {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'playing' | 'done'>(item.plays[key] ? 'done' : 'idle')
  const [progress, setProgress] = useState(0)
  const [retry, setRetry] = useState(false)
  const stopRef = useRef<() => void>(() => {})
  useEffect(() => () => stopRef.current(), [])
  const play = async () => {
    setPhase('loading'); setRetry(false)
    let url = ''
    try { url = (await proficiency.audio(sessionId, item.sid, key)).url } catch { setPhase('done'); return }
    try {
      setPhase('playing')
      const h = playOnce(url, setProgress)
      stopRef.current = h.stop
      await h.done
      setProgress(1)
      setPhase('done')
    } catch {
      // O navegador não deixou tocar (ou o arquivo não carregou): a reprodução não foi gasta, dá para tocar de novo.
      setProgress(0); setRetry(true); setPhase('idle')
    }
  }
  return { phase, progress, play, retry }
}

export function ListeningSet({ sessionId, item, saved, onSave, locked }: TaskProps) {
  const { phase, progress, play, retry } = useOncePlayer(sessionId, item)
  const c = item.content
  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl border p-5 md:p-6" style={cardStyle}>
        <p className="text-[15px]">{String(c.context ?? '')}</p>
        <div className="mt-4 flex items-center gap-4">
          {phase === 'idle' && <Button onClick={() => void play()} disabled={locked}><Play className="w-4 h-4" />{retry ? 'Tocar de novo' : 'Ouvir'}</Button>}
          {phase === 'loading' && <Button disabled><Loader2 className="w-4 h-4 animate-spin" />Carregando</Button>}
          {(phase === 'playing' || phase === 'done') && <span className="inline-flex items-center gap-3 text-[14px]"><Equalizer active={phase === 'playing'} />{phase === 'playing' ? 'Ouvindo…' : 'Áudio encerrado'}</span>}
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
            <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${(phase === 'done' ? 1 : progress) * 100}%`, backgroundColor: 'var(--theme-text)' }} />
          </div>
        </div>
        <p className="mt-3 text-[12.5px] flex items-center gap-1.5" style={muted}><Volume2 className="w-3.5 h-3.5" />{retry ? 'O áudio não começou. Toque para ouvir; ele ainda não foi usado.' : 'O áudio toca uma única vez e não há transcrição.'}</p>
      </div>
      {phase === 'done' && <div className="mt-8"><Questions questions={(c.questions ?? []) as Choice[]} saved={saved} onSave={onSave} locked={locked} /></div>}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// Writing
export function BuildSentence({ item, saved, onSave, locked }: TaskProps) {
  const frags = (item.content.fragments ?? []) as string[]
  const [order, setOrder] = useState<number[]>(() => {
    const got = (saved.order?.order ?? []) as string[]
    const used = new Set<number>()
    return got.map(g => { const i = frags.findIndex((f, k) => f === g && !used.has(k)); used.add(i); return i }).filter(i => i >= 0)
  })
  const update = (o: number[]) => { setOrder(o); onSave('order', { order: o.map(i => frags[i]) }, true) }
  const left = frags.map((f, i) => ({ f, i })).filter(x => !order.includes(x.i))
  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-[14px]" style={muted}>Monte uma resposta com sentido. Toque nos trechos na ordem certa.</p>
      <div className="mt-5 flex gap-3">
        <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full text-[13px] font-semibold" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>A</span>
        <p className="rounded-2xl rounded-tl-md px-4 py-3 text-[16px]" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{String(item.content.a_says ?? '')}</p>
      </div>
      <div className="mt-4 flex gap-3 justify-end">
        <div className="min-h-[56px] flex-1 rounded-2xl rounded-tr-md border-2 border-dashed px-3 py-2.5 flex flex-wrap items-center gap-2" style={{ borderColor: 'var(--theme-border)' }}>
          {order.length === 0 && <span className="text-[14px] px-1" style={muted}>Sua resposta aparece aqui</span>}
          {order.map((i, k) => (
            <button key={k} type="button" disabled={locked} onClick={() => update(order.filter((_, j) => j !== k))}
              className="rounded-lg px-3 py-1.5 text-[15.5px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{frags[i]}</button>
          ))}
          {order.length === frags.length && <span className="text-[16px]">{String(item.content.punctuation ?? '.')}</span>}
        </div>
        <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full text-[13px] font-semibold border" style={{ borderColor: 'var(--theme-border)' }}>B</span>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {left.map(x => (
          <button key={x.i} type="button" disabled={locked} onClick={() => update([...order, x.i])}
            className="rounded-lg border px-3 py-1.5 text-[15.5px] hover:bg-[var(--ui-hover)] transition-colors" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>{x.f}</button>
        ))}
      </div>
      {order.length > 0 && <button type="button" disabled={locked} onClick={() => update([])} className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium" style={muted}><RotateCcw className="w-3.5 h-3.5" />Recomeçar</button>}
    </div>
  )
}

function Writer({ initial, onSave, locked, placeholder, minWords }: { initial: string; onSave: TaskProps['onSave']; locked?: boolean; placeholder: string; minWords: number }) {
  const [text, setText] = useState(initial)
  const words = useMemo(() => text.split(/\s+/).filter(Boolean).length, [text])
  return (
    <div className="flex flex-col h-full">
      <textarea value={text} disabled={locked} spellCheck={false} autoCorrect="off" autoCapitalize="sentences" placeholder={placeholder}
        onChange={e => { setText(e.target.value); onSave('text', { text: e.target.value }) }}
        onPaste={e => e.preventDefault()}
        className="w-full min-h-[300px] flex-1 rounded-2xl border p-4 text-[16px] leading-relaxed resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]/40"
        style={{ ...cardStyle, color: 'var(--theme-text)' }} />
      <p className="mt-2 text-[12.5px] tabular-nums flex justify-between" style={muted}>
        <span>{words} {words === 1 ? 'palavra' : 'palavras'}</span>
        <span>Recomendado: {minWords}+ palavras. Corretor e colar estão desativados.</span>
      </p>
    </div>
  )
}

export function WriteEmail({ item, saved, onSave, locked }: TaskProps) {
  const c = item.content
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <div className="space-y-4">
        <p className="text-[15.5px] leading-relaxed">{String(c.scenario ?? '')}</p>
        <div className="rounded-2xl border p-4" style={cardStyle}>
          <p className="text-[13px] font-medium" style={muted}>No seu e-mail, faça o seguinte:</p>
          <ul className="mt-2 space-y-1.5 text-[15px]">{((c.tasks ?? []) as string[]).map((t, i) => <li key={i} className="flex gap-2"><span className="tabular-nums" style={muted}>{i + 1}.</span>{t}</li>)}</ul>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="rounded-t-2xl border border-b-0 px-4 py-2.5 text-[14px] space-y-1" style={cardStyle}>
          <p><span style={muted}>To:</span> {String(c.to ?? '')}</p>
          <p><span style={muted}>Subject:</span> {String(c.subject ?? '')}</p>
        </div>
        <div className="[&_textarea]:rounded-t-none"><Writer initial={String(saved.text?.text ?? '')} onSave={onSave} locked={locked} placeholder="Write your email here." minWords={80} /></div>
      </div>
    </div>
  )
}

export function AcademicDiscussion({ item, saved, onSave, locked }: TaskProps) {
  const c = item.content
  const prof = (c.professor ?? {}) as { name?: string; post?: string }
  const students = (c.students ?? []) as { name: string; post: string }[]
  const initials = (n: string) => n.replace(/^Dr\.?\s*/, '').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1.2fr]">
      <div className="space-y-3 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
        <p className="text-[14px]" style={muted}>Seu professor está discutindo um tema na turma de {String(c.course ?? '')}. Escreva uma resposta que contribua para a discussão.</p>
        <div className="rounded-2xl border p-4" style={cardStyle}>
          <p className="flex items-center gap-2 text-[14px] font-semibold"><span className="grid place-items-center w-8 h-8 rounded-full text-[12px]" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{initials(prof.name ?? 'P')}</span>{prof.name}</p>
          <p className="mt-2 text-[15.5px] leading-relaxed">{prof.post}</p>
        </div>
        {students.map((st, i) => (
          <div key={i} className="rounded-2xl border p-4 ml-4" style={cardStyle}>
            <p className="flex items-center gap-2 text-[14px] font-semibold"><span className="grid place-items-center w-8 h-8 rounded-full text-[12px]" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{initials(st.name)}</span>{st.name}</p>
            <p className="mt-2 text-[15px] leading-relaxed">{st.post}</p>
          </div>
        ))}
      </div>
      <Writer initial={String(saved.text?.text ?? '')} onSave={onSave} locked={locked} placeholder="Write your contribution here." minWords={100} />
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// Speaking: tudo acontece em sequência (ouvir → aviso → gravar → enviar).
function Countdown({ msLeft, total, level }: { msLeft: number; total: number; level: number }) {
  const r = 52, c = 2 * Math.PI * r
  const frac = total ? msLeft / total : 0
  return (
    <div className="relative w-[136px] h-[136px] mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--theme-bg-secondary)" strokeWidth="6" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--theme-text)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <Mic className="w-5 h-5 mx-auto" />
          <p className="mt-1 font-display text-[28px] leading-none tabular-nums">{Math.ceil(msLeft / 1000)}</p>
        </div>
      </div>
      <span className="absolute inset-[18px] rounded-full pointer-events-none" style={{ boxShadow: `0 0 0 ${Math.round(level * 12)}px color-mix(in srgb, var(--theme-text) 12%, transparent)` }} />
    </div>
  )
}

type Phase = 'ready' | 'listening' | 'prep' | 'recording' | 'uploading' | 'done'

/** Uma rodada de fala: toca o áudio (uma vez), dá o sinal e grava por `seconds`. */
function useSpeakRound(sessionId: string, item: ExamItem, onSave: TaskProps['onSave'], onError?: (m: string) => void, viaAvatar = false) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [level, setLevel] = useState(0)
  const [left, setLeft] = useState(0)
  const stopRef = useRef<() => void>(() => {})
  const run = async (key: string, part: string, seconds: number, allowEarly: boolean) => {
    try {
      setPhase('listening')
      try {
        const a = await proficiency.audio(sessionId, item.sid, key)
        if (viaAvatar) await (await playClip(a.url)).done
        else await playOnce(a.url).done
      } catch { /* sem áudio (já tocado ou rede): grava assim mesmo */ }
      setPhase('prep')
      await beep(880, 180)
      setPhase('recording')
      const total = seconds * 1000
      setLeft(total)
      const r = await record(total, setLevel, setLeft)
      stopRef.current = allowEarly ? r.stop : () => {}
      const rec = await r.done
      setPhase('uploading')
      let path = ''
      for (let i = 0; i < 3 && !path; i++) {
        try { path = await uploadRecording(sessionId, item.sid, part, rec.blob) } catch { await new Promise(res => setTimeout(res, 800 * (i + 1))) }
      }
      if (!path) onError?.('Não conseguimos enviar esta gravação. Verifique a conexão.')
      onSave(part, { audioPath: path || null, durationMs: rec.durationMs, mime: rec.blob.type }, true)
      setPhase('done')
    } catch {
      onError?.('O microfone não respondeu. Verifique a permissão do navegador.')
      setPhase('done')
    }
  }
  return { phase, level, left, run, stopEarly: () => stopRef.current() }
}

export function ListenRepeat({ sessionId, item, saved, onSave, onDone, autoStart, onError }: TaskProps) {
  const seconds = Number(item.content.seconds ?? 10)
  const { phase, level, left, run } = useSpeakRound(sessionId, item, onSave, onError)
  const started = useRef(false)
  const already = !!saved.say?.audioPath
  const go = () => { if (started.current) return; started.current = true; void run('main', 'say', seconds, false).then(() => setTimeout(() => onDone?.(), 700)) }
  useEffect(() => { if (autoStart && !already) go() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (already) onDone?.() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="max-w-md mx-auto text-center">
      <p className="text-[15px]">{String(item.content.context ?? '')}</p>
      <p className="mt-1 text-[13.5px]" style={muted}>Ouça a frase e repita exatamente o que ouviu. Você terá {seconds} segundos.</p>
      <div className="mt-8 min-h-[170px] grid place-items-center">
        {phase === 'ready' && <Button size="lg" onClick={go}><Play className="w-4 h-4" />Ouvir a frase</Button>}
        {phase === 'listening' && <p className="inline-flex items-center gap-3 text-[15px]"><Equalizer active />Ouvindo…</p>}
        {phase === 'prep' && <p className="text-[15px] font-medium">Fale depois do sinal</p>}
        {phase === 'recording' && <div><Countdown msLeft={left} total={seconds * 1000} level={level} /><p className="mt-3 text-[14px] font-medium">Gravando</p></div>}
        {phase === 'uploading' && <p className="inline-flex items-center gap-2 text-[14px]" style={muted}><Loader2 className="w-4 h-4 animate-spin" />Enviando</p>}
        {phase === 'done' && <p className="text-[14px]" style={muted}>Resposta registrada</p>}
      </div>
    </div>
  )
}

export function Interview({ sessionId, item, saved, onSave, onDone, onError }: TaskProps) {
  const qs = (item.content.questions ?? []) as { id: string; seconds: number }[]
  const firstOpen = qs.findIndex(q => !saved[q.id]?.audioPath)
  const [qi, setQi] = useState(firstOpen < 0 ? qs.length : firstOpen)
  const { phase, level, left, run, stopEarly } = useSpeakRound(sessionId, item, onSave, onError, true)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (qi >= qs.length) onDone?.() }, [qi]) // eslint-disable-line react-hooks/exhaustive-deps
  const ask = async () => {
    if (busy || qi >= qs.length) return
    setBusy(true)
    const q = qs[qi]
    await run(q.id, q.id, q.seconds || 45, true)
    setBusy(false)
    setQi(i => i + 1)
  }
  // Depois da primeira pergunta, as seguintes começam sozinhas.
  useEffect(() => { if (qi > 0 && qi < qs.length && !busy) { const t = setTimeout(() => void ask(), 1400); return () => clearTimeout(t) } }, [qi]) // eslint-disable-line react-hooks/exhaustive-deps
  const avatarState = phase === 'listening' ? 'speaking' : phase === 'recording' ? 'listening' : phase === 'uploading' ? 'thinking' : 'idle'
  const caption = phase === 'listening' ? 'Ouça a pergunta' : phase === 'prep' ? 'Responda depois do sinal' : phase === 'recording' ? 'Estou ouvindo' : phase === 'uploading' ? 'Guardando a sua resposta' : qi >= qs.length ? 'Entrevista concluída' : qi === 0 ? 'Pronta quando você estiver' : 'Próxima pergunta'
  return (
    <div className="max-w-4xl mx-auto grid gap-8 md:grid-cols-[1fr_1fr] md:items-center">
      <div className="relative rounded-[28px] border overflow-hidden" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
        <div className="relative h-[300px] sm:h-[360px]">
          <CharacterAvatar stage voice characterId="bookmoo-mulher" kind="woman" state={avatarState} followPointer={false} />
        </div>
        <div className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full px-3 h-8 text-[12.5px] font-semibold" style={{ backgroundColor: 'var(--theme-card-bg)' }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: phase === 'recording' ? 'var(--pastel-rose-fg)' : 'var(--theme-text-secondary)' }} />
          {phase === 'recording' ? 'Gravando' : 'Entrevistadora · Bia'}
        </div>
        <div className="absolute bottom-3 inset-x-3 flex justify-center">
          <span className="rounded-lg px-3.5 h-9 inline-flex items-center text-[13.5px] font-medium" style={{ backgroundColor: 'var(--theme-card-bg)' }}>{caption}</span>
        </div>
      </div>

      <div>
        <p className="text-[13px] tabular-nums font-semibold uppercase tracking-[0.08em]" style={muted}>Pergunta {Math.min(qi + 1, qs.length)} de {qs.length}</p>
        <div className="mt-3 flex gap-1.5" aria-hidden>{qs.map((q, i) => <span key={q.id} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: i < qi ? 'var(--theme-text)' : i === qi ? 'color-mix(in srgb, var(--theme-text) 45%, transparent)' : 'var(--theme-border)' }} />)}</div>
        <p className="mt-5 text-[15.5px] leading-relaxed">{String(item.content.context ?? '')}</p>
        <p className="mt-2 text-[13.5px]" style={muted}>A pergunta não aparece escrita. Você tem até 45 segundos para responder; fale com naturalidade.</p>
        <div className="mt-6 min-h-[190px] grid place-items-center md:place-items-start">
          {phase === 'ready' && qi === 0 && <Button size="lg" onClick={() => void ask()}><Play className="w-4 h-4" />Começar a entrevista</Button>}
          {phase === 'listening' && <p className="inline-flex items-center gap-3 text-[15px]"><Equalizer active />A Bia está perguntando</p>}
          {phase === 'prep' && <p className="text-[15px] font-medium">Responda depois do sinal</p>}
          {phase === 'recording' && (
            <div className="flex items-center gap-6">
              <Countdown msLeft={left} total={45_000} level={level} />
              <div>
                <p className="text-[15px] font-medium">Gravando sua resposta</p>
                {left < 30_000 && <button type="button" onClick={stopEarly} className="mt-2 text-[13.5px] font-medium underline underline-offset-4" style={muted}>Terminei de responder</button>}
              </div>
            </div>
          )}
          {phase === 'uploading' && <p className="inline-flex items-center gap-2 text-[14px]" style={muted}><Loader2 className="w-4 h-4 animate-spin" />Enviando</p>}
        </div>
      </div>
    </div>
  )
}

export function TaskView(p: TaskProps) {
  switch (p.item.task) {
    case 'complete_words': return <CompleteWords {...p} />
    case 'daily_life': case 'academic_passage': return <ReadingSet {...p} />
    case 'choose_response': case 'conversation': case 'announcement': case 'academic_talk': return <ListeningSet {...p} />
    case 'build_sentence': return <BuildSentence {...p} />
    case 'write_email': return <WriteEmail {...p} />
    case 'academic_discussion': return <AcademicDiscussion {...p} />
    case 'listen_repeat': return <ListenRepeat {...p} />
    case 'interview': return <Interview {...p} />
  }
}
