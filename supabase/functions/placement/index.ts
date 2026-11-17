// Teste de nível (docs/TESTE-DE-NIVEL.md). Cada nível tem o seu teste: leitura em voz alta + pergunta aberta (fala),
// ditado (ouvir e escrever) e uma conversa curta com tarefas. O aparelho transcreve a fala e manda o texto; aqui fica o
// gabarito, a nota e a decisão (confirmar, sugerir promoção, sugerir ajuste). Só esta função grava nível, estado,
// emblemas e histórico.
import { adminClient, corsHeaders, getUser, json, log } from '../_shared/tts.ts'
import { rateLimit } from '../_shared/rate.ts'
import { AiError, llmChat, llmJson, parseJson, pickProvider } from '../_shared/ai.ts'
import { entitlements, measured } from '../_shared/billing.ts'
import { BANK, drawItems, LEVELS, type Level } from '../_shared/placementBank.ts'
import { dictationScore, outcomeOf, readAloudScore } from '../_shared/placementScore.ts'

type Body = {
  action?: string; kind?: 'confirm' | 'promotion'; attemptId?: string; itemId?: string
  transcript?: string; confidence?: number; durationMs?: number; typed?: boolean; text?: string; characterId?: string
}
class PlacementError extends Error { constructor(public code: string, public status = 400, public extra: Record<string, unknown> = {}) { super(code) } }
const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const asLevel = (v: unknown): Level | null => (LEVELS.includes(v as Level) ? (v as Level) : null)
const DAY = 86_400_000
const MAX_TALK_TURNS = 8
// Limite mensal: até 2 testes por mês (confirmação ou promoção). Vale a melhor nota; o próximo só no mês seguinte.
const MONTHLY_ATTEMPTS = 2
const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
const nextMonthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
function monthUsage(attempts: { status: string; finished_at: string | null; started_at: string; total: number | null }[]) {
  const from = monthStart().getTime()
  const used = attempts.filter(a => a.status === 'scored' && new Date(a.finished_at ?? a.started_at).getTime() >= from)
  return { used: used.length, best: used.length ? Math.max(...used.map(a => Number(a.total) || 0)) : null, nextAt: used.length >= MONTHLY_ATTEMPTS ? nextMonthStart().toISOString() : null }
}

type Items = ReturnType<typeof drawItems>
type Answers = {
  read?: Record<string, { transcript: string; score: number; typed: boolean; confidence?: number; durationMs?: number }>
  open?: Record<string, { transcript: string; typed: boolean }>
  dictation?: Record<string, { text: string; score: number }>
}

async function profileOf(db: ReturnType<typeof adminClient>, userId: string) {
  const { data } = await db.from('profiles').select('declared_level, placement_level, level_state, level_emblems').eq('user_id', userId).maybeSingle()
  const current = asLevel(data?.placement_level) ?? asLevel(data?.declared_level) ?? 'A1'
  return { current, state: String(data?.level_state ?? 'pending'), emblems: (data?.level_emblems ?? []) as string[], placement: asLevel(data?.placement_level), declared: asLevel(data?.declared_level) }
}

/** Itens sem gabarito para o aparelho (o ditado leva o texto: a voz local precisa dele para falar). */
const publicItems = (items: Items) => ({
  read: items.read, open: items.open,
  dictation: items.dictation.map(d => ({ id: d.id, say: d.text, words: d.text.split(/\s+/).length })),
  talk: { topic: items.talk.topic, opening: items.talk.opening, tasks: items.talk.tasks.length },
})

function examinerPrompt(level: Level, talk: Items['talk'], turnsLeft: number) {
  return `You are a friendly English tutor running a short spoken placement check with a Brazilian learner who says their level is ${level}.
${BANK[level].guide}
Topic: ${talk.topic}. Guide the learner, one at a time, through these tasks: ${talk.tasks.map((t, i) => `(${i + 1}) ${t}`).join('; ')}.
Rules: reply in 1-2 short spoken sentences (max 30 words) at level ${level}. Never correct mistakes and never give scores or feedback. Speech recognition may contain errors: interpret charitably. If the learner speaks Portuguese, answer in simple English. ${turnsLeft <= 1 ? 'This is the last turn: thank them warmly and say goodbye.' : `About ${turnsLeft} learner turns left.`}
Return JSON only: {"reply": "what you say", "done": true|false (true when all tasks were covered or this is the last turn)}`
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Nota da IA (pergunta aberta e conversa). Tenta 3 vezes; se a IA não responder, o teste NÃO recebe nota (a tentativa
 *  continua aberta e a pessoa tenta de novo em instantes): nível e promoção nunca saem de uma estimativa. */
async function scoreWithAi(userId: string, plan: string | undefined, level: Level, items: Items, answers: Answers, turns: { role: string; text: string }[]) {
  const open = items.open.map(o => ({ q: o.question, a: answers.open?.[o.id]?.transcript ?? '' }))
  const talkText = turns.map(t => `${t.role === 'ai' ? 'Tutor' : 'Learner'}: ${clean(t.text, 300)}`).join('\n')
  let last: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await measured(userId, 'placement-score', async () => {
        const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
        return await llmJson<{ open?: number; conversation?: number; tasks_done?: number; strengths?: string[]; improve?: string[]; summary_pt?: string }>(provider, key, {
          prompt: `You are a strict but fair CEFR examiner. Score a Brazilian learner on a ${level}-level test (score how well they perform AT ${level}: 100 = clearly above ${level}, 70 = solid ${level}, 50 = borderline, below 40 = clearly below ${level}). The text comes from speech recognition: ignore small transcription glitches.
Rubric for ${level}: task achievement, comprehension of the tutor, range of vocabulary and grammar expected at ${level}, accuracy, fluency (answer length and coherence).
Open question(s):
${open.map(o => `Q: ${o.q}\nA: ${o.a || '(no answer)'}`).join('\n')}
Conversation (tasks: ${items.talk.tasks.join('; ')}):
${talkText || '(no conversation)'}
Return JSON only: {"open": 0-100, "conversation": 0-100, "tasks_done": number of tasks achieved, "strengths": ["up to 3 short items in Portuguese"], "improve": ["up to 3 short, specific items in Portuguese"], "summary_pt": "one encouraging sentence in Brazilian Portuguese"}`,
        })
      }, plan)
    } catch (e) {
      last = e
      log('placement', 'ai_score_failed', { attempt, msg: String((e as Error)?.message ?? e).slice(0, 160) })
      await sleep(1200 * (attempt + 1))
    }
  }
  throw new PlacementError('scoring_busy', 503, { detail: String((last as Error)?.message ?? last).slice(0, 120) })
}

async function handle(userId: string, b: Body) {
  const db = adminClient()
  const ent = await entitlements(userId)
  switch (b.action) {
    case 'status': {
      const prof = await profileOf(db, userId)
      const { data: attempts } = await db.from('placement_attempts').select('id, level, kind, status, started_at, finished_at, scores, total, outcome').eq('user_id', userId).order('started_at', { ascending: false }).limit(10)
      const { data: history } = await db.from('level_history').select('at, from_level, to_level, reason').eq('user_id', userId).order('at', { ascending: false }).limit(20)
      const now = Date.now()
      const usage = monthUsage(attempts ?? [])
      const nextLevel = LEVELS[LEVELS.indexOf(prof.current) + 1] ?? null
      return {
        level: prof.current, state: prof.state, emblems: prof.emblems, declared: prof.declared, placement: prof.placement, next: nextLevel,
        confirmAvailableAt: usage.nextAt, promotionAvailableAt: usage.nextAt,
        monthUsed: usage.used, monthLimit: MONTHLY_ATTEMPTS, monthBest: usage.best,
        promotionOffered: prof.state === 'verified',
        attempts: attempts ?? [], history: history ?? [],
      }
    }

    case 'start': {
      const kind = b.kind === 'promotion' ? 'promotion' : 'confirm'
      const prof = await profileOf(db, userId)
      const level: Level | null = kind === 'confirm' ? prof.current : (LEVELS[LEVELS.indexOf(prof.current) + 1] ?? null)
      if (!level) throw new PlacementError('no_higher_level')
      const { data: recent } = await db.from('placement_attempts').select('id, level, kind, status, outcome, finished_at, started_at, items, total').eq('user_id', userId).order('started_at', { ascending: false }).limit(10)
      // Promoção só depois de confirmar o nível atual. E vale para todos (inclusive admin): no máximo 2 testes por mês.
      if (kind === 'promotion' && prof.state !== 'verified') throw new PlacementError('confirm_first', 409)
      const usage = monthUsage(recent ?? [])
      if (usage.nextAt) throw new PlacementError('cooldown', 429, { availableAt: usage.nextAt })
      const tutor = clean(b.characterId, 40)
      // Tentativas abertas antigas são abandonadas; os itens da última do mesmo nível são evitados no sorteio.
      await db.from('placement_attempts').update({ status: 'abandoned' }).eq('user_id', userId).eq('status', 'active')
      const prev = (recent ?? []).find(a => a.level === level)
      const avoid = new Set<string>()
      if (prev?.items) {
        const it = prev.items as Items
        for (const x of it.read ?? []) avoid.add(x.text)
        for (const x of it.dictation ?? []) avoid.add(x.text)
        for (const x of it.open ?? []) avoid.add(x.question)
      }
      const items = drawItems(level, avoid)
      const turns = [{ role: 'ai', text: items.talk.opening }]
      const { data: row, error } = await db.from('placement_attempts').insert({ user_id: userId, level, kind, items: { ...items, tutor }, turns }).select('id').single()
      if (error || !row) throw new PlacementError('start_failed', 500)
      return { attemptId: row.id, level, kind, items: publicItems(items) }
    }

    case 'read':
    case 'open':
    case 'dictation': {
      const at = await activeAttempt(db, userId, b.attemptId)
      const items = at.items as Items
      const answers = (at.answers ?? {}) as Answers
      const id = clean(b.itemId, 8)
      if (b.action === 'read') {
        const item = items.read.find(x => x.id === id)
        if (!item) throw new PlacementError('item_not_found', 404)
        const transcript = clean(b.transcript, 400)
        // Digitado em vez de falado: a leitura vira cópia; vale no máximo 50.
        let score = readAloudScore(item.text, transcript)
        if (b.typed) score = Math.min(50, score)
        answers.read = { ...(answers.read ?? {}), [id]: { transcript, score, typed: !!b.typed, confidence: Number(b.confidence) || undefined, durationMs: Number(b.durationMs) || undefined } }
      } else if (b.action === 'open') {
        if (!items.open.some(x => x.id === id)) throw new PlacementError('item_not_found', 404)
        answers.open = { ...(answers.open ?? {}), [id]: { transcript: clean(b.transcript, 800), typed: !!b.typed } }
      } else {
        const item = items.dictation.find(x => x.id === id)
        if (!item) throw new PlacementError('item_not_found', 404)
        answers.dictation = { ...(answers.dictation ?? {}), [id]: { text: clean(b.text, 300), score: dictationScore(item.text, clean(b.text, 300)) } }
      }
      await db.from('placement_attempts').update({ answers }).eq('id', at.id)
      return { ok: true }
    }

    case 'turn': {
      const at = await activeAttempt(db, userId, b.attemptId)
      const items = at.items as Items
      const text = clean(b.transcript, 500)
      if (!text) throw new PlacementError('empty_text')
      const turns = [...((at.turns ?? []) as { role: string; text: string; typed?: boolean }[]), { role: 'user', text, typed: !!b.typed }]
      const learnerTurns = turns.filter(t => t.role === 'user').length
      const left = MAX_TALK_TURNS - learnerTurns
      let reply = 'Thank you! That was great.'
      let done = left <= 0
      if (!done) {
        try {
          const raw = await measured(userId, 'placement-talk', async () => {
            const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
            return await llmChat(provider, key, { system: examinerPrompt(at.level as Level, items.talk, left), messages: turns.map(t => ({ role: t.role === 'ai' ? 'assistant' as const : 'user' as const, content: t.text })), json: true, maxTokens: 160, temperature: 0.6 })
          }, ent.plan)
          // Às vezes o modelo responde em texto puro: aproveita a frase em vez de cair na reserva.
          let out: { reply?: string; done?: boolean }
          try { out = parseJson<{ reply?: string; done?: boolean }>(raw) } catch { out = { reply: raw.replace(/[{}"]/g, '').replace(/^\s*reply\s*:\s*/i, ''), done: false } }
          reply = clean(out.reply, 300) || reply
          done = !!out.done || left <= 1
        } catch (e) {
          log('placement', 'talk_failed', { msg: String((e as Error)?.message ?? e).slice(0, 160) })
          reply = learnerTurns >= 3 ? 'Thank you! That was great.' : 'Nice! Can you tell me a bit more?'
          done = learnerTurns >= 3
        }
      }
      turns.push({ role: 'ai', text: reply })
      await db.from('placement_attempts').update({ turns }).eq('id', at.id)
      return { reply, done }
    }

    case 'finish': {
      const at = await activeAttempt(db, userId, b.attemptId)
      const level = at.level as Level
      const items = at.items as Items
      const answers = (at.answers ?? {}) as Answers
      const turns = (at.turns ?? []) as { role: string; text: string; typed?: boolean }[]
      const learnerTurns = turns.filter(t => t.role === 'user')
      const missing: string[] = []
      if (items.read.some(r => !answers.read?.[r.id])) missing.push('read')
      if (items.open.some(o => !answers.open?.[o.id])) missing.push('open')
      if (items.dictation.some(d => !answers.dictation?.[d.id])) missing.push('dictation')
      if (learnerTurns.length < 2) missing.push('talk')
      if (missing.length) throw new PlacementError('incomplete', 409, { missing })

      const ai = await scoreWithAi(userId, ent.plan, level, items, answers, turns)
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
      const read = avg(Object.values(answers.read ?? {}).map(r => r.score))
      const typedOpen = Object.values(answers.open ?? {}).some(o => o.typed)
      const open = Math.max(0, Math.min(100, Number(ai.open) || 0)) * (typedOpen ? 0.8 : 1)
      const typedTalk = learnerTurns.filter(t => t.typed).length / Math.max(1, learnerTurns.length)
      const interaction = Math.round(Math.max(0, Math.min(100, Number(ai.conversation) || 0)) * (1 - 0.15 * typedTalk))
      const parts = { speaking: Math.round(read * 0.5 + open * 0.5), listening: Math.round(avg(Object.values(answers.dictation ?? {}).map(d => d.score))), interaction }
      const { total, outcome } = outcomeOf(at.kind as 'confirm' | 'promotion', level, parts)
      const scores = { ...parts, read: Math.round(read), open: Math.round(open), tasks_done: Number(ai.tasks_done) || 0, strengths: (ai.strengths ?? []).slice(0, 3).map(s => clean(s, 120)), improve: (ai.improve ?? []).slice(0, 3).map(s => clean(s, 120)), summary: clean(ai.summary_pt, 240) }
      await db.from('placement_attempts').update({ status: 'scored', finished_at: new Date().toISOString(), scores, total, outcome }).eq('id', at.id)

      // O tutor que acompanhou guarda o que a pessoa precisa treinar: depois, numa conversa, ele lembra e pode retomar.
      await rememberTest(db, userId, String((items as Items & { tutor?: string }).tutor ?? ''), level, at.kind as string, total, outcome, scores)
      // Efeitos no perfil (só aqui o nível muda).
      const prof = await profileOf(db, userId)
      const addEmblem = (l: Level) => [...new Set([...prof.emblems, l])].sort((a, b) => LEVELS.indexOf(a as Level) - LEVELS.indexOf(b as Level))
      const now = new Date().toISOString()
      let newLevel: Level = prof.current
      if (outcome === 'confirmed' || outcome === 'promote') {
        await db.from('profiles').upsert({ user_id: userId, placement_level: level, level_state: 'verified', level_verified_at: now, level_emblems: addEmblem(level), updated_at: now })
        if (prof.placement !== level || prof.state !== 'verified') await db.from('level_history').insert({ user_id: userId, from_level: prof.current, to_level: level, reason: 'test_confirmed' })
        newLevel = level
      } else if (outcome === 'promoted') {
        await db.from('profiles').upsert({ user_id: userId, placement_level: level, level_state: 'verified', level_verified_at: now, level_emblems: addEmblem(level), updated_at: now })
        await db.from('level_history').insert({ user_id: userId, from_level: prof.current, to_level: level, reason: 'test_promoted' })
        newLevel = level
      } else if (outcome === 'step_down') {
        await db.from('profiles').upsert({ user_id: userId, level_state: 'review', updated_at: now })
      }
      return { level, kind: at.kind, total, outcome, scores, newLevel, previousLevel: prof.current, next: LEVELS[LEVELS.indexOf(newLevel) + 1] ?? null }
    }

    case 'step_down': {
      // A pessoa aceitou descer um nível depois de um teste abaixo do esperado.
      const prof = await profileOf(db, userId)
      if (prof.state !== 'review') throw new PlacementError('not_in_review', 409)
      const lower = LEVELS[Math.max(0, LEVELS.indexOf(prof.current) - 1)]
      const now = new Date().toISOString()
      await db.from('profiles').upsert({ user_id: userId, placement_level: lower, declared_level: lower, level_state: 'pending', updated_at: now })
      await db.from('level_history').insert({ user_id: userId, from_level: prof.current, to_level: lower, reason: 'step_down' })
      return { level: lower }
    }

    default:
      throw new PlacementError('unknown_action')
  }
}

const TUTOR_IDS = ['bookmoo-mulher', 'bookmoo-homem', 'bookmoo-yuno', 'bookmoo-yuri']
/** Junta o resultado do teste à memória do tutor (tutor_memory): pontos a melhorar, acertos e um resumo. Nunca quebra o teste. */
async function rememberTest(db: ReturnType<typeof adminClient>, userId: string, tutor: string, level: Level, kind: string, total: number, outcome: string, scores: { strengths: string[]; improve: string[]; summary: string; speaking: number; listening: number; interaction: number }) {
  if (!TUTOR_IDS.includes(tutor)) return
  try {
    const { data: prev } = await db.from('tutor_memory').select('*').eq('user_id', userId).eq('character_id', tutor).maybeSingle()
    const merge = (a: string[] | null | undefined, b: string[], n: number) => [...new Set([...b, ...(a ?? [])])].slice(0, n)
    const note = `Level test (${kind === 'promotion' ? 'promotion' : 'confirmation'} ${level}, ${new Date().toISOString().slice(0, 10)}): total ${total}/100 (speaking ${scores.speaking}, listening ${scores.listening}, conversation ${scores.interaction}), result ${outcome}. To practise: ${scores.improve.join('; ') || 'n/a'}.`
    await db.from('tutor_memory').upsert({
      user_id: userId, character_id: tutor,
      summary: clean(`${note} ${prev?.summary ?? ''}`, 480),
      strengths: merge(prev?.strengths, scores.strengths, 4), weaknesses: merge(prev?.weaknesses, scores.improve, 4),
      topics: merge(prev?.topics, [`level test ${level}`], 5),
      sessions: Number(prev?.sessions ?? 0), last_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
  } catch (e) { log('placement', 'memory_failed', { msg: String((e as Error)?.message ?? e).slice(0, 120) }) }
}

async function activeAttempt(db: ReturnType<typeof adminClient>, userId: string, id: unknown) {
  const { data } = await db.from('placement_attempts').select('*').eq('id', String(id ?? '')).eq('user_id', userId).maybeSingle()
  if (!data) throw new PlacementError('attempt_not_found', 404)
  if (data.status !== 'active') throw new PlacementError('attempt_closed', 409)
  if (Date.now() - new Date(data.started_at).getTime() > DAY) {
    await db.from('placement_attempts').update({ status: 'abandoned' }).eq('id', data.id)
    throw new PlacementError('attempt_expired', 409)
  }
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized' }, 401)
  const limited = await rateLimit(req, user.id, 'placement', 60)
  if (limited) return limited
  const body = await req.json().catch(() => null) as Body | null
  if (!body) return json({ error: 'invalid_json' }, 400)
  try {
    return json(await handle(user.id, body))
  } catch (e) {
    if (e instanceof PlacementError) return json({ error: e.code, ...e.extra }, e.status)
    const err = e instanceof AiError ? e : new AiError(String((e as Error)?.message ?? e))
    log('placement', 'error', { action: body.action, code: err.code, msg: err.message.slice(0, 200) })
    return json({ error: err.code, detail: err.message }, err.status)
  }
})
