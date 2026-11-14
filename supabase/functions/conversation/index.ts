// Conversa por voz (turno a turno): Cenas, conversa livre com tutor e Tutor de leitura.
// O áudio nunca chega aqui: o aparelho transcreve, manda o texto, e fala a resposta com a voz local/VoiceStudio.
// Minutos: Cenas reservam a duração no início e devolvem a sobra no fim; tutores cobram por turno
// (tempo de fala estimado pelo texto, que o servidor vê — não dá para burlar pelo aparelho).
import { adminClient, corsHeaders, getUser, json, log } from '../_shared/tts.ts'
import { AiError, llmChat, llmJson, parseJson, pickProvider } from '../_shared/ai.ts'
import { commitSeconds, entitlements, measured, metered, releaseSeconds, requireFeature, reserveSeconds, type Entitlements } from '../_shared/billing.ts'
import { DEMO_SCENE_KEY, findScene, type Scene } from '../_shared/scenes.ts'

type Body = {
  action?: string; kind?: 'scene' | 'tutor' | 'reader'; sceneKey?: string; sceneId?: string; minutes?: number
  sessionId?: string; text?: string; confidence?: number; filler?: string; bookId?: string; page?: number
  mode?: 'hint' | 'translate'; metrics?: { wpm?: number; avgResponseMs?: number; unclear?: number }
  setting?: string; personaName?: string; personaRole?: string; personaTraits?: string; goal?: string; level?: string; title?: string
}

const LEVEL_GUIDE: Record<string, string> = {
  A1: 'Use very short, simple sentences and the most common words. Speak slowly. Be very patient.',
  A2: 'Use short sentences and everyday vocabulary. Avoid idioms. Be patient.',
  B1: 'Use natural everyday English with some common expressions.',
  B2: 'Speak naturally at normal speed, with common idioms and phrasal verbs.',
  C1: 'Speak fully naturally, like with a native speaker, including idioms.',
}
const SPEECH_WPS = 2.5 // palavras por segundo para estimar tempo de fala

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const ageOf = (birth: string | null) => {
  if (!birth) return null
  const b = new Date(`${birth}T12:00:00Z`)
  const n = new Date()
  let a = n.getUTCFullYear() - b.getUTCFullYear()
  if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--
  return a
}

class ConvError extends Error { constructor(public code: string, public status = 400) { super(code) } }

async function loadScene(db: ReturnType<typeof adminClient>, userId: string, ent: Entitlements, b: Body): Promise<Scene & { id?: string }> {
  if (b.sceneId) {
    requireFeature(ent, ent.limits.scenes_create, 'scenes_create')
    const { data } = await db.from('scenes').select('*').eq('id', b.sceneId).eq('owner_id', userId).maybeSingle()
    if (!data || data.moderation_status !== 'approved') throw new ConvError('scene_not_found', 404)
    return {
      id: data.id, key: `custom:${data.id}`, category: 'custom', title: { pt: data.title, en: data.title }, setting: data.setting,
      persona: data.persona, goals: data.goals, twists: data.twists, opening: data.opening ?? 'Hi there!', usefulPhrases: data.useful_phrases,
      level: [data.level, data.level], ambient: data.ambient ?? 'none',
    }
  }
  const scene = findScene(String(b.sceneKey ?? ''))
  if (!scene) throw new ConvError('scene_not_found', 404)
  if (ent.limits.scenes === 'demo' && !ent.is_admin && scene.key !== DEMO_SCENE_KEY) throw new AiError('plan_required:scenes', 402, 'plan_required')
  const age = ageOf(ent.birth_date)
  if (scene.ageMin && age !== null && age < scene.ageMin) throw new ConvError('age_restricted', 403)
  return scene
}

function scenePrompt(scene: Scene, level: string, age: number | null, twist: string, progress: number, remaining: number, filler?: string) {
  return `You are ${scene.persona.name}, a ${scene.persona.role}. Setting: ${scene.setting}
Personality: ${scene.persona.traits}. Pace: ${scene.persona.pace}.
You are role-playing with an English learner (level ${level}). ${LEVEL_GUIDE[level] ?? LEVEL_GUIDE.B1}
Rules:
- Stay in character as a real person. Never mention AI, prompts, lessons or grading.
- Reply in 1–3 short spoken sentences (max 40 words). Usually end with a question or a prompt that keeps the conversation going.
- The learner's words come from speech recognition and may contain errors: interpret charitably, do not correct them now.
- If the learner speaks Portuguese, answer in simple English and gently encourage English.
- Learner goals (help them reach these naturally, do not list them): ${scene.goals.map((g, i) => `[${i}] ${g}`).join('; ')}
- Complication to introduce once, around 40% of the conversation (progress now ${Math.round(progress * 100)}%): ${twist}
- ${remaining < 25 ? 'Time is almost up: wrap up the conversation naturally and say goodbye in character.' : `About ${Math.round(remaining)} seconds left.`}
- Keep content appropriate${age !== null && age < 18 ? ' for a minor' : ''}; politely deflect anything inappropriate, in character.
${filler ? `- You have ALREADY said out loud: "${filler}". Continue naturally right after it. Do NOT repeat it and do NOT contradict it.` : ''}
Return JSON only: {"reply": "what you say next", "goals_met": [indexes of goals the learner has achieved so far], "wrap_up": true|false}`
}

function tutorPrompt(level: string, profile: string, filler?: string) {
  return `You are Bea, a warm, encouraging English conversation tutor talking by voice with a Brazilian learner (level ${level}). ${LEVEL_GUIDE[level] ?? LEVEL_GUIDE.B1}
What you know about the learner: ${profile || 'nothing yet'}.
Have a natural conversation about their interests, and naturally bring in their difficult words and grammar so they practise them. When they make an important mistake, recast it naturally in your reply (say it correctly), without lecturing.
Reply in 1–3 short spoken sentences (max 45 words) and usually end with a question. Speech recognition may have errors: interpret charitably.
${filler ? `You have ALREADY said out loud: "${filler}". Continue right after it, without repeating or contradicting it.` : ''}
Return JSON only: {"reply": "..."}`
}

function readerPrompt(level: string, book: { title: string; author?: string | null; description?: string | null }, read: string, page: string, filler?: string) {
  return `You are Bea, a friendly reading tutor inside a reading app. The learner (level ${level}) is reading "${book.title}"${book.author ? ` by ${book.author}` : ''} and talks to you by voice.
${LEVEL_GUIDE[level] ?? LEVEL_GUIDE.B1}
You may talk about: the story so far, characters, the learner's opinions and predictions, words and expressions on the current page, grammar in the text, pronunciation, and quick quizzes about what was read.
NO SPOILERS: you only know the text below (everything up to the current page). If asked about what happens later, playfully refuse ("No spoilers! Keep reading 😉").
If the learner speaks Portuguese, understand it and answer in simple English; at A1/A2 you may add a very short Portuguese gloss in parentheses.
Stay on the book and language learning; politely redirect other topics.
Reply in 1–3 short spoken sentences (max 50 words), friendly and encouraging.
${filler ? `You have ALREADY said out loud: "${filler}". Continue right after it, without repeating or contradicting it.` : ''}
Book description: ${clean(book.description, 600)}
Story so far (earlier pages, condensed): ${read}
Current page: ${page}
Return JSON only: {"reply": "...", "highlight": "an exact word or short phrase from the current page to highlight, or null", "offer_save": true|false}`
}

async function learnerProfile(db: ReturnType<typeof adminClient>, userId: string) {
  const [{ data: vocab }, { data: errs }, { data: prof }] = await Promise.all([
    db.from('vocabulary').select('text, status').eq('user_id', userId).eq('status', 'review').order('created_at', { ascending: false }).limit(12),
    db.from('learner_errors').select('kind, example, correction').eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
    db.from('profiles').select('english_level, placement_level, goal').eq('user_id', userId).maybeSingle(),
  ])
  const level = String(prof?.placement_level || prof?.english_level || 'B1').toUpperCase().slice(0, 2)
  const parts = [
    vocab?.length ? `words they are reviewing: ${vocab.map((v) => v.text).join(', ')}` : '',
    errs?.length ? `recent mistakes: ${errs.map((e) => `${e.kind} ("${e.example}" → "${e.correction}")`).join('; ')}` : '',
    prof?.goal ? `goal: ${clean(prof.goal, 160)}` : '',
  ].filter(Boolean)
  return { level: LEVEL_GUIDE[level] ? level : 'B1', text: parts.join('. ') }
}

async function handle(userId: string, b: Body) {
  const db = adminClient()
  const ent = await entitlements(userId)
  const plan = ent.plan

  switch (b.action) {
    case 'start': {
      const kind = b.kind ?? 'scene'
      if (kind === 'tutor') requireFeature(ent, ent.limits.free_talk, 'free_talk')
      if (kind === 'reader') requireFeature(ent, ent.limits.tutor, 'tutor')
      if (kind !== 'scene') {
        if (ent.seconds_available < 5 && !ent.is_admin) throw new AiError('no_minutes', 402, 'no_minutes')
        let title = 'Tutor'
        if (kind === 'reader') {
          const { data: book } = await db.from('books').select('id, title').eq('id', String(b.bookId ?? '')).eq('user_id', userId).maybeSingle()
          if (!book) throw new ConvError('book_not_found', 404)
          title = book.title
        }
        const { data: s, error } = await db.from('conversation_sessions').insert({ user_id: userId, kind, book_id: kind === 'reader' ? b.bookId : null, title }).select('id').single()
        if (error) throw new ConvError('session_failed', 500)
        return { sessionId: s.id, secondsAvailable: ent.seconds_available }
      }
      const scene = await loadScene(db, userId, ent, b)
      const max = ent.is_admin ? 10 : ent.limits.max_scene_minutes
      const minutes = [3, 5, 10].includes(Number(b.minutes)) ? Math.min(Number(b.minutes), max) : Math.min(3, max)
      // Encerra sessão de cena esquecida aberta (devolve minutos).
      const { data: stale } = await db.from('conversation_sessions').select('id, reservation_id').eq('user_id', userId).eq('kind', 'scene').eq('status', 'active')
      for (const s of stale ?? []) {
        if (s.reservation_id) await releaseSeconds(s.reservation_id)
        await db.from('conversation_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', s.id)
      }
      const { data: s, error } = await db.from('conversation_sessions').insert({
        user_id: userId, kind: 'scene', scene_key: scene.key, title: scene.title.pt, planned_seconds: minutes * 60,
        context: { twist: scene.twists[Math.floor(Math.random() * scene.twists.length)] ?? '', level: scene.level[0], sceneId: scene.id ?? null },
      }).select('id').single()
      if (error) throw new ConvError('session_failed', 500)
      let reservation: string
      try {
        reservation = await reserveSeconds(userId, minutes * 60, 'scene', s.id, `scene:${s.id}`)
      } catch (e) {
        await db.from('conversation_sessions').delete().eq('id', s.id)
        throw e
      }
      await db.from('conversation_sessions').update({ reservation_id: reservation }).eq('id', s.id)
      await db.from('conversation_turns').insert({ session_id: s.id, role: 'ai', text: scene.opening })
      return { sessionId: s.id, plannedSeconds: minutes * 60, opening: scene.opening, scene: { key: scene.key, title: scene.title, persona: scene.persona, goals: scene.goals, usefulPhrases: scene.usefulPhrases, fillers: scene.fillers ?? [], ambient: scene.ambient } }
    }

    case 'turn': {
      const text = clean(b.text, 600)
      if (!text) throw new ConvError('empty_text')
      const { data: session } = await db.from('conversation_sessions').select('*').eq('id', String(b.sessionId ?? '')).eq('user_id', userId).maybeSingle()
      if (!session || session.status !== 'active') throw new ConvError('session_over', 409)
      const filler = clean(b.filler, 80) || undefined
      const { data: history } = await db.from('conversation_turns').select('role, text').eq('session_id', session.id).order('id', { ascending: false }).limit(16)
      const messages = [...(history ?? [])].reverse().map((t) => ({ role: t.role === 'ai' ? 'assistant' as const : 'user' as const, content: t.text }))
      messages.push({ role: 'user', content: text })
      const now = Date.now()
      const elapsed = (now - new Date(session.started_at).getTime()) / 1000

      let system: string
      if (session.kind === 'scene') {
        if (elapsed > session.planned_seconds + 30) throw new ConvError('session_over', 409)
        const scene = session.context?.sceneId
          ? await loadScene(db, userId, ent, { sceneId: session.context.sceneId })
          : findScene(String(session.scene_key))!
        system = scenePrompt(scene, String(session.context?.level ?? 'B1'), ageOf(ent.birth_date), String(session.context?.twist ?? ''), elapsed / session.planned_seconds, session.planned_seconds - elapsed, filler)
      } else if (session.kind === 'tutor') {
        const prof = await learnerProfile(db, userId)
        system = tutorPrompt(prof.level, prof.text, filler)
      } else {
        const { data: book } = await db.from('books').select('title, author, description, pages').eq('id', session.book_id).eq('user_id', userId).maybeSingle()
        if (!book) throw new ConvError('book_not_found', 404)
        const pages = (Array.isArray(book.pages) ? book.pages : []) as unknown[]
        const at = Math.max(0, Math.min(pages.length - 1, Number(b.page ?? 0)))
        const pageText = (i: number) => clean(typeof pages[i] === 'string' ? pages[i] : (pages[i] as { text?: string })?.text ?? '', 4000)
        // Só o que já foi lido: as páginas anteriores entram resumidas (cortadas), a atual inteira.
        const earlier = Array.from({ length: Math.min(at, 6) }, (_, k) => at - 6 + k).filter((i) => i >= 0).map((i) => pageText(i).slice(0, 700)).join(' … ')
        const prof = await learnerProfile(db, userId)
        system = readerPrompt(prof.level, book, earlier, pageText(at), filler)
      }

      // Tutores: cobra o tempo de fala estimado deste turno antes de responder (reserva) e acerta depois.
      let reservation: string | null = null
      if (session.kind !== 'scene' && !ent.is_admin) {
        if (ent.seconds_available <= 0) throw new AiError('no_minutes', 402, 'no_minutes')
        const estimate = Math.min(120, Math.max(5, Math.ceil((words(text) + 60) / SPEECH_WPS)))
        reservation = await reserveSeconds(userId, Math.max(1, Math.min(estimate, ent.seconds_available)), session.kind, session.id)
      }
      let reply = ''
      let extra: Record<string, unknown> = {}
      try {
        const raw = await measured(userId, `conversation-${session.kind}`, async () => {
          const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
          return await llmChat(provider, key, { system, messages, json: true, maxTokens: 200 })
        }, plan)
        const parsed = parseJson<{ reply?: string; goals_met?: number[]; wrap_up?: boolean; highlight?: string | null; offer_save?: boolean }>(raw)
        reply = clean(parsed.reply, 500) || "Sorry, could you say that again?"
        extra = { goalsMet: Array.isArray(parsed.goals_met) ? parsed.goals_met.filter(Number.isInteger) : [], wrapUp: !!parsed.wrap_up, highlight: parsed.highlight ? clean(parsed.highlight, 60) : null, offerSave: !!parsed.offer_save }
      } catch (e) {
        if (reservation) await releaseSeconds(reservation)
        throw e
      }
      if (reservation) await commitSeconds(reservation, Math.max(5, Math.ceil((words(text) + words(reply) + (filler ? words(filler) : 0)) / SPEECH_WPS)))
      await db.from('conversation_turns').insert([
        { session_id: session.id, role: 'user', text, stt_confidence: typeof b.confidence === 'number' ? b.confidence : null },
        { session_id: session.id, role: 'ai', text: filler ? `${filler} ${reply}` : reply },
      ])
      await db.from('conversation_sessions').update({ last_turn_at: new Date().toISOString(), turns: (session.turns ?? 0) + 1 }).eq('id', session.id)
      return { reply, ...extra, remaining: session.kind === 'scene' ? Math.max(0, session.planned_seconds - elapsed) : null }
    }

    case 'assist': {
      // Ajuda (2 frases sugeridas em PT/EN) ou tradução da última fala. Sem custo de créditos.
      const { data: session } = await db.from('conversation_sessions').select('id, scene_key, kind').eq('id', String(b.sessionId ?? '')).eq('user_id', userId).maybeSingle()
      if (!session) throw new ConvError('session_not_found', 404)
      const { data: last } = await db.from('conversation_turns').select('role, text').eq('session_id', session.id).order('id', { ascending: false }).limit(6)
      const transcript = [...(last ?? [])].reverse().map((t) => `${t.role === 'ai' ? 'Character' : 'Learner'}: ${t.text}`).join('\n')
      return await measured(userId, `conversation-${b.mode ?? 'hint'}`, async () => {
        const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
        if (b.mode === 'translate') {
          const lastAi = (last ?? []).find((t) => t.role === 'ai')?.text ?? ''
          const r = await llmJson<{ pt?: string }>(provider, key, { prompt: `Translate to Brazilian Portuguese, naturally. Return JSON {"pt": "..."}.\n${lastAi}` })
          return { translation: clean(r.pt, 600) }
        }
        const r = await llmJson<{ suggestions?: { en?: string; pt?: string }[] }>(provider, key, {
          prompt: `An English learner is stuck in this conversation. Suggest 2 short, natural things they could say next (simple English), each with a Brazilian Portuguese translation.
${transcript}
Return JSON {"suggestions": [{"en": "...", "pt": "..."}]}`,
        })
        return { suggestions: (r.suggestions ?? []).slice(0, 2).map((s) => ({ en: clean(s.en, 160), pt: clean(s.pt, 200) })) }
      }, plan)
    }

    case 'end': {
      const { data: session } = await db.from('conversation_sessions').select('*').eq('id', String(b.sessionId ?? '')).eq('user_id', userId).maybeSingle()
      if (!session) throw new ConvError('session_not_found', 404)
      const now = new Date()
      if (session.status === 'active') {
        const elapsed = Math.round((now.getTime() - new Date(session.started_at).getTime()) / 1000)
        const used = session.kind === 'scene' ? Math.min(session.planned_seconds, Math.max(0, elapsed)) : 0
        if (session.reservation_id) await commitSeconds(session.reservation_id, used)
        await db.from('conversation_sessions').update({ status: 'ended', ended_at: now.toISOString(), used_seconds: used }).eq('id', session.id)
      }
      if (session.kind !== 'scene') return { ok: true }
      const { data: existing } = await db.from('conversation_feedback').select('*').eq('session_id', session.id).maybeSingle()
      if (existing) return { feedback: shape(existing, ent) }
      const { data: turns } = await db.from('conversation_turns').select('role, text, stt_confidence').eq('session_id', session.id).order('id')
      const learnerTurns = (turns ?? []).filter((t) => t.role === 'user')
      if (learnerTurns.length < 2) return { feedback: null, reason: 'too_short' }
      const scene = session.context?.sceneId ? null : findScene(String(session.scene_key))
      const conf = learnerTurns.map((t) => t.stt_confidence).filter((c): c is number => typeof c === 'number')
      const avgConf = conf.length ? conf.reduce((a, c) => a + c, 0) / conf.length : null
      const fb = await measured(userId, 'conversation-feedback', async () => {
        const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
        return await llmJson<{
          score?: number; cefr?: string; criteria?: Record<string, number>; summary?: string; tips?: string[]
          corrections?: { said?: string; better?: string; why?: string }[]; new_words?: { word?: string; meaning?: string }[]
          goals_met?: number[]; errors?: { kind?: string; example?: string; correction?: string }[]
        }>(provider, key, {
          prompt: `You are an English teacher evaluating a spoken role-play by a Brazilian learner. The learner's lines come from speech recognition.
${scene ? `Scene: ${scene.setting}. Learner goals: ${scene.goals.map((g, i) => `[${i}] ${g}`).join('; ')}` : ''}
Measured: words per minute ${Math.round(Number(b.metrics?.wpm ?? 0))}, average time to start answering ${Math.round(Number(b.metrics?.avgResponseMs ?? 0))} ms, unclear recognitions ${Number(b.metrics?.unclear ?? 0)}, average recognition confidence ${avgConf === null ? 'n/a' : avgConf.toFixed(2)}.
Transcript:
${(turns ?? []).map((t) => `${t.role === 'ai' ? 'Character' : 'Learner'}: ${t.text}`).join('\n')}

Score each criterion from 0 to 20: communication (goals achieved, task done), grammar, vocabulary (range and precision), fluency (use the measured numbers), pronunciation (intelligibility only, from recognition confidence and unclear count; never judge accent).
Return JSON only:
{"score": 0-100 (sum of criteria), "cefr": "A1|A2|B1|B2|C1", "criteria": {"communication": n, "grammar": n, "vocabulary": n, "fluency": n, "pronunciation": n},
 "summary": "2 sentences in Brazilian Portuguese, encouraging and honest",
 "tips": ["3 short practical tips in Brazilian Portuguese"],
 "corrections": [{"said": "learner sentence", "better": "more natural English", "why": "short reason in Portuguese"}] (up to 8, most useful first),
 "new_words": [{"word": "useful English word or phrase from this situation", "meaning": "meaning in Portuguese"}] (up to 6),
 "goals_met": [goal indexes achieved],
 "errors": [{"kind": "tense|preposition|word order|article|vocabulary|pronunciation|other", "example": "...", "correction": "..."}] (up to 6)}`,
        })
      }, plan)
      const criteria = fb.criteria ?? {}
      const score = Math.max(0, Math.min(100, Math.round(Number(fb.score ?? Object.values(criteria).reduce((a, n) => a + Number(n || 0), 0)))))
      const row = {
        session_id: session.id, user_id: userId, score, cefr: clean(fb.cefr, 3), criteria,
        summary: clean(fb.summary, 600), tips: (fb.tips ?? []).slice(0, 3).map((t) => clean(t, 200)),
        corrections: (fb.corrections ?? []).slice(0, 8).map((c) => ({ said: clean(c.said, 300), better: clean(c.better, 300), why: clean(c.why, 200) })),
        new_words: (fb.new_words ?? []).slice(0, 6).map((w) => ({ word: clean(w.word, 60), meaning: clean(w.meaning, 120) })),
        goals_met: (fb.goals_met ?? []).filter(Number.isInteger),
      }
      await db.from('conversation_feedback').upsert(row)
      await db.from('conversation_sessions').update({ score }).eq('id', session.id)
      const errors = (fb.errors ?? []).slice(0, 6).filter((e) => e.example)
      if (errors.length) await db.from('learner_errors').insert(errors.map((e) => ({ user_id: userId, source: 'conversation', kind: clean(e.kind, 30) || 'other', example: clean(e.example, 200), correction: clean(e.correction, 200) })))
      return { feedback: shape(row, ent) }
    }

    case 'create-scene': {
      requireFeature(ent, ent.limits.scenes_create, 'scenes_create')
      const setting = clean(b.setting, 400)
      const goal = clean(b.goal, 300)
      if (setting.length < 3 || goal.length < 3) throw new ConvError('invalid_scene')
      const { count } = await db.from('scenes').select('id', { count: 'exact', head: true }).eq('owner_id', userId)
      if ((count ?? 0) >= 100) throw new ConvError('too_many_scenes')
      const age = ageOf(ent.birth_date)
      const level = ['A1', 'A2', 'B1', 'B2', 'C1'].includes(String(b.level)) ? String(b.level) : 'B1'
      const built = await metered(userId, 'scene-create', async () => {
        const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
        return await llmJson<{
          allowed?: boolean; reason?: string; title?: string; setting?: string; persona?: { name?: string; role?: string; traits?: string; gender?: string; pace?: string; emoji?: string }
          goals?: string[]; twists?: string[]; opening?: string; useful_phrases?: string[]
        }>(provider, key, {
          prompt: `A ${age !== null && age < 18 ? 'minor' : 'adult'} English learner (level ${level}) wants a role-play scene to practise speaking.
Place/situation: ${setting}
Character: ${clean(b.personaName, 40) || '(choose a name)'}, ${clean(b.personaRole, 80) || '(choose a role)'}, personality: ${clean(b.personaTraits, 200) || '(choose)'}
Learner's goal: ${goal}
First moderate: set "allowed": false if it is sexual, hateful, violent, illegal, impersonates a real or famous person, or is inappropriate${age !== null && age < 18 ? ' for a minor' : ''}. Otherwise build the scene.
Return JSON only: {"allowed": true|false, "reason": "if not allowed, short reason in Portuguese", "title": "short title in Portuguese", "setting": "one English sentence",
"persona": {"name": "...", "role": "...", "traits": "personality and way of speaking, in English", "gender": "female|male", "pace": "calm|normal|fast", "emoji": "one emoji"},
"goals": ["3 concrete goals in English"], "twists": ["2 complications in English"], "opening": "the character's first line", "useful_phrases": ["3 useful English phrases"]}`,
        })
      }, { credits: 0, plan })
      if (!built.allowed) return { rejected: true, reason: clean(built.reason, 200) || 'Esta cena não pode ser criada.' }
      const persona = {
        name: clean(built.persona?.name, 40) || 'Alex', role: clean(built.persona?.role, 80) || 'person', traits: clean(built.persona?.traits, 300),
        gender: built.persona?.gender === 'female' ? 'female' : 'male', pace: ['calm', 'normal', 'fast'].includes(String(built.persona?.pace)) ? built.persona!.pace : 'normal',
        emoji: clean(built.persona?.emoji, 8) || '🙂',
      }
      const { data: row, error } = await db.from('scenes').insert({
        owner_id: userId, title: clean(b.title, 80) || clean(built.title, 80) || 'Minha cena', setting: clean(built.setting, 400) || setting,
        persona, goals: (built.goals ?? []).slice(0, 3).map((g) => clean(g, 160)), twists: (built.twists ?? []).slice(0, 2).map((g) => clean(g, 200)),
        opening: clean(built.opening, 300) || 'Hi there!', useful_phrases: (built.useful_phrases ?? []).slice(0, 3).map((g) => clean(g, 120)), level,
      }).select('*').single()
      if (error) throw new ConvError('scene_save_failed', 500)
      return { scene: row }
    }

    default:
      throw new ConvError('unknown_action')
  }
}

/** Grátis vê nota + dicas; Essencial vê até 3 correções; Plus/Pro, tudo. */
function shape(row: Record<string, unknown>, ent: Entitlements) {
  const level = ent.is_admin ? 'detailed' : ent.limits.feedback
  const corrections = (row.corrections as unknown[]) ?? []
  return {
    ...row,
    corrections: level === 'summary' ? [] : level === 'full' ? corrections.slice(0, 3) : corrections,
    locked_corrections: level === 'summary' ? corrections.length : level === 'full' ? Math.max(0, corrections.length - 3) : 0,
    new_words: level === 'summary' ? [] : row.new_words,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized' }, 401)
  const body = await req.json().catch(() => null) as Body | null
  if (!body) return json({ error: 'invalid_json' }, 400)
  try {
    return json(await handle(user.id, body))
  } catch (e) {
    if (e instanceof ConvError) return json({ error: e.code }, e.status)
    const err = e instanceof AiError ? e : new AiError(String((e as Error)?.message ?? e))
    log('conversation', 'error', { action: body.action, code: err.code, msg: err.message.slice(0, 200) })
    return json({ error: err.code, detail: err.message }, err.status)
  }
})
