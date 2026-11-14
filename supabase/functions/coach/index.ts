// Análise avançada de perfil (Raio-X) e Histórias de reforço — Plus e Pro.
// O resumo enviado à IA é compacto e sem texto de livros: palavras, erros, práticas e nível.
import { adminClient, corsHeaders, getUser, json, log } from '../_shared/tts.ts'
import { AiError, llmJson, pickProvider } from '../_shared/ai.ts'
import { entitlements, measured, requireFeature } from '../_shared/billing.ts'

type Body = { action?: string; words?: string[]; focus?: string; level?: string }
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

async function learnerSummary(db: ReturnType<typeof adminClient>, userId: string) {
  const since = new Date(Date.now() - 60 * 86400_000).toISOString()
  const [{ data: review }, { data: learned }, { data: practice }, { data: errors }, { data: convo }, { data: prof }, { data: days }] = await Promise.all([
    db.from('vocabulary').select('text, created_at').eq('user_id', userId).eq('status', 'review').order('created_at', { ascending: true }).limit(40),
    db.from('vocabulary').select('text').eq('user_id', userId).eq('status', 'learned').limit(400),
    db.from('practice_sessions').select('kind, accuracy, missed, created_at').eq('user_id', userId).gte('created_at', since).order('created_at', { ascending: false }).limit(40),
    db.from('learner_errors').select('kind, example, correction').eq('user_id', userId).gte('created_at', since).order('created_at', { ascending: false }).limit(40),
    db.from('conversation_feedback').select('score, cefr, criteria, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    db.from('profiles').select('english_level, placement_level, goal').eq('user_id', userId).maybeSingle(),
    db.from('study_days').select('date, seconds').eq('user_id', userId).gte('date', since.slice(0, 10)),
  ])
  const missed = new Map<string, number>()
  for (const p of practice ?? []) for (const w of (p.missed ?? []) as string[]) missed.set(w.toLowerCase(), (missed.get(w.toLowerCase()) ?? 0) + 1)
  const errorKinds = new Map<string, number>()
  for (const e of errors ?? []) errorKinds.set(e.kind, (errorKinds.get(e.kind) ?? 0) + 1)
  const avg = (xs: number[]) => xs.length ? Math.round(xs.reduce((a, x) => a + x, 0) / xs.length) : null
  return {
    level: String(prof?.placement_level || prof?.english_level || 'B1').toUpperCase().slice(0, 2),
    goal: clean(prof?.goal, 160),
    words_in_review: (review ?? []).map((v) => v.text).slice(0, 30),
    words_learned_count: learned?.length ?? 0,
    most_missed_in_practice: [...missed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([w, n]) => `${w} (${n}x)`),
    practice_accuracy: { speak: avg((practice ?? []).filter((p) => p.kind === 'speak').map((p) => p.accuracy ?? 0)), write: avg((practice ?? []).filter((p) => p.kind !== 'speak').map((p) => p.accuracy ?? 0)) },
    error_types: [...errorKinds.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`),
    error_examples: (errors ?? []).slice(0, 10).map((e) => `"${e.example}" → "${e.correction}"`),
    conversation_scores: (convo ?? []).map((c) => ({ score: c.score, cefr: c.cefr, criteria: c.criteria })),
    study_days_last_60: days?.length ?? 0,
    study_minutes_last_60: Math.round((days ?? []).reduce((a, d) => a + (d.seconds ?? 0), 0) / 60),
  }
}

type SkillKey = 'speaking' | 'conversation' | 'vocabulary' | 'dictation' | 'consistency'
type SkillScores = { scores: Record<SkillKey, number | null>; overall: number | null; metrics: Record<string, number | null>; window_days: number }

/** Notas de 0 a 100 calculadas dos dados (sem IA), nos últimos 30 dias. Comparáveis entre avaliações. */
async function skillScores(db: ReturnType<typeof adminClient>, userId: string): Promise<SkillScores> {
  const days = 30
  const since = new Date(Date.now() - days * 86400_000).toISOString()
  const [{ data: practice }, { data: convo }, { data: vocab }, { data: study }] = await Promise.all([
    db.from('practice_sessions').select('kind, accuracy').eq('user_id', userId).gte('created_at', since),
    db.from('conversation_feedback').select('score').eq('user_id', userId).gte('created_at', since),
    db.from('vocabulary').select('status').eq('user_id', userId),
    db.from('study_days').select('date, seconds').eq('user_id', userId).gte('date', since.slice(0, 10)),
  ])
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, x) => a + x, 0) / xs.length) : null)
  const speak = (practice ?? []).filter((p) => p.kind === 'speak').map((p) => Number(p.accuracy ?? 0))
  const dict = (practice ?? []).filter((p) => p.kind !== 'speak').map((p) => Number(p.accuracy ?? 0))
  const learned = (vocab ?? []).filter((v) => v.status === 'learned').length
  const review = (vocab ?? []).filter((v) => v.status === 'review').length
  const totalWords = (vocab ?? []).length
  const studyDays = (study ?? []).filter((d) => (d.seconds ?? 0) > 0).length
  const minutes = Math.round((study ?? []).reduce((a, d) => a + (d.seconds ?? 0), 0) / 60)
  const scores: Record<SkillKey, number | null> = {
    speaking: avg(speak),
    conversation: avg((convo ?? []).map((c) => Number(c.score ?? 0))),
    vocabulary: totalWords ? Math.round(60 * (learned / Math.max(1, learned + review)) + 40 * Math.min(1, totalWords / 150)) : null,
    dictation: avg(dict),
    consistency: Math.round(50 * Math.min(1, studyDays / 20) + 50 * Math.min(1, minutes / 600)),
  }
  const present = Object.values(scores).filter((v): v is number => v !== null)
  return {
    scores,
    overall: present.length ? Math.round(present.reduce((a, x) => a + x, 0) / present.length) : null,
    metrics: { speak_sessions: speak.length, dictation_sessions: dict.length, conversations: (convo ?? []).length, words_total: totalWords, words_learned: learned, words_review: review, study_days: studyDays, study_minutes: minutes },
    window_days: days,
  }
}

async function handle(userId: string, b: Body) {
  const db = adminClient()
  const ent = await entitlements(userId)
  switch (b.action) {
    case 'insights': {
      requireFeature(ent, ent.limits.insights !== 'none', 'insights')
      const { data: last } = await db.from('profile_insights').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      const age = last ? Date.now() - new Date(last.created_at).getTime() : Infinity
      const minGap = ent.is_admin ? 0 : ent.limits.insights === 'on_demand' ? 86400_000 : 7 * 86400_000
      if (last && age < minGap) return { insight: last, next_at: new Date(new Date(last.created_at).getTime() + minGap).toISOString(), reused: true }
      // Nível oficial = o mesmo que o app mostra (palavras salvas + pontos). A IA não pode mudar.
      const level = LEVELS.includes(String(b.level)) ? String(b.level) : 'A1'
      const summary = await learnerSummary(db, userId)
      const skills = await skillScores(db, userId)
      const previous = (last?.summary as { skills?: SkillScores } | undefined)?.skills ?? null
      const report = await measured(userId, 'insights', async () => {
        const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
        return await llmJson<Record<string, unknown>>(provider, key, {
          prompt: `You are an expert English teacher for Brazilian learners. Write a short, honest and motivating diagnosis IN BRAZILIAN PORTUGUESE.
The learner's official level is ${level}. Do NOT change or contradict it; adjust your advice to ${level}.
Skill scores now (0-100, null = not practised yet): ${JSON.stringify(skills.scores)}
${previous ? `Previous assessment scores: ${JSON.stringify(previous.scores)}` : 'This is the first assessment.'}
Activity data: ${JSON.stringify({ ...summary, level: undefined })}
Return JSON only:
{"headline": "1 frase de resumo",
 "progress": "${previous ? '1-2 frases comparando com a avaliação anterior (o que subiu, o que caiu)' : 'string vazia'}",
 "strengths": ["2-3 pontos fortes concretos"],
 "difficulties": [{"title": "dificuldade", "evidence": "o que nos dados mostra isso", "tip": "como treinar"}] (exatamente 3, a mais importante primeiro),
 "focus_words": ["até 8 palavras em inglês que mais travam"],
 "grammar_focus": "estrutura gramatical para focar, em inglês curto (adequada ao nível ${level})",
 "study_plan": ["3 a 5 ações concretas para os próximos 7 dias, citando as áreas do app: Falar, Ditado, Conversar, Vocabulário, leitura"]}`,
        })
      }, ent.plan)
      const { data: row } = await db.from('profile_insights').insert({ user_id: userId, summary: { level, skills, activity: summary }, report }).select('*').single()
      return { insight: row, next_at: new Date(Date.now() + minGap).toISOString() }
    }

    case 'story': {
      requireFeature(ent, ent.limits.stories !== 0, 'stories')
      if (!ent.is_admin && ent.limits.stories != null && Number(ent.usage?.stories ?? 0) >= ent.limits.stories) throw new AiError('cap_reached', 402, 'cap_reached')
      const { data: last } = await db.from('profile_insights').select('report, summary').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      const report = (last?.report ?? {}) as { focus_words?: string[]; grammar_focus?: string }
      const summary = last ? null : await learnerSummary(db, userId)
      const targets = (b.words?.length ? b.words : report.focus_words ?? summary?.words_in_review ?? []).map((w) => clean(w, 40)).filter(Boolean).slice(0, 8)
      const grammar = clean(b.focus, 120) || report.grammar_focus || 'past simple'
      const level = LEVELS.includes(String(b.level)) ? String(b.level) : String((last?.summary as { level?: string } | null)?.level ?? 'A1')
      {
        const story = await measured(userId, 'reinforcement-story', async () => {
          const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
          return await llmJson<{ title?: string; body?: string; quiz?: { question?: string; options?: string[]; answer?: number }[]; used_words?: string[] }>(provider, key, {
            prompt: `Write a short, engaging original story (150-300 words) in English for a Brazilian learner at level ${level}.
It must naturally use these target words${targets.length ? `: ${targets.join(', ')}` : ' (choose useful everyday words)'} and repeatedly practise this grammar: ${grammar}.
Make it vivid and fun, with dialogue, suitable for all ages. Do not explain grammar inside the story.
Then write 4 multiple-choice comprehension questions in English (3 options each) that require using the target words or grammar.
Return JSON only: {"title": "...", "body": "story with paragraphs separated by \\n\\n", "used_words": ["target words actually used"], "quiz": [{"question": "...", "options": ["a", "b", "c"], "answer": 0}]}`,
          })
        }, ent.plan)
        const { data: row, error } = await db.from('reinforcement_stories').insert({
          user_id: userId, title: clean(story.title, 120) || 'Story', body: String(story.body ?? '').slice(0, 4000), level,
          target_words: (story.used_words ?? targets).slice(0, 10), grammar_focus: grammar,
          quiz: (story.quiz ?? []).slice(0, 5).map((q) => ({ question: clean(q.question, 200), options: (q.options ?? []).slice(0, 4).map((o) => clean(o, 120)), answer: Number(q.answer ?? 0) })),
        }).select('*').single()
        if (error) throw new AiError(error.message, 500, 'db_error')
        // Conta no teto do mês só depois de entregar a história.
        if (!ent.is_admin) await db.rpc('usage_bump', { p_user: userId, p_field: 'stories', p_cap: null })
        return { story: row }
      }
    }

    default:
      throw new AiError('unknown_action', 400, 'unknown_action')
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
    const err = e instanceof AiError ? e : new AiError(String((e as Error)?.message ?? e))
    log('coach', 'error', { action: body.action, code: err.code, msg: err.message.slice(0, 200) })
    return json({ error: err.code, detail: err.message }, err.status)
  }
})
