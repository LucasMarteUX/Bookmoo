// "Estudar a página" (lição completa da página, como num livro de inglês) e "Desafio" (quiz). O texto da página vem SEMPRE do banco,
// nunca do aparelho. A gramática de livros da galeria é compartilhada: gerada uma vez, reaproveitada por todos.
import { adminClient, corsHeaders, getUser, json, log, sha256Hex } from '../_shared/tts.ts'
import { AiError, llmJson, pickProvider } from '../_shared/ai.ts'
import { entitlements, metered } from '../_shared/billing.ts'

type Body = { action?: string; bookId?: string; page?: number; lang?: string; level?: string; tier?: number; correct?: number; total?: number }
class GrammarError extends Error { constructor(public code: string, public status = 400) { super(code) } }

// Sem travessão nos textos do app: " — " vira vírgula.
const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+[—–]\s+/g, ', ').replace(/\s+/g, ' ').trim().slice(0, max)
const arr = <T,>(v: unknown, n: number): T[] => (Array.isArray(v) ? (v as T[]).slice(0, n) : [])

type Ctx = { userId: string; bookId: string; page: number; lang: 'pt' | 'en'; text: string; hash: string; catalogId: string | null; title: string; prevText: string }

async function loadContext(userId: string, b: Body): Promise<Ctx> {
  const db = adminClient()
  const bookId = String(b.bookId ?? '')
  const page = Number(b.page)
  if (!/^[\da-f-]{36}$/i.test(bookId) || !Number.isInteger(page) || page < 0 || page > 100000) throw new GrammarError('invalid_target')
  const { data: book } = await db.from('books').select('title, pages').eq('id', bookId).eq('user_id', userId).maybeSingle()
  if (!book) throw new GrammarError('book_not_found', 404)
  const pages = (Array.isArray(book.pages) ? book.pages : []) as unknown[]
  const raw = (i: number) => (typeof pages[i] === 'string' ? pages[i] as string : (pages[i] as { text?: string } | undefined)?.text ?? '')
  const text = raw(page).replace(/\s+/g, ' ').trim().slice(0, 6000)
  if (text.length < 20) throw new GrammarError('page_too_short')
  const { data: link } = await db.from('book_links').select('catalog_id').eq('book_id', bookId).eq('user_id', userId).maybeSingle()
  const catalogId = (link?.catalog_id as string | null) ?? null
  if (catalogId) {
    const { data: ok } = await db.rpc('has_book_access', { p_user: userId, p_catalog: catalogId })
    if (!ok) throw new AiError('plan_required:book', 402, 'plan_required')
  }
  return {
    userId, bookId, page, lang: b.lang === 'en' ? 'en' : 'pt', text, hash: (await sha256Hex(text)).slice(0, 32), catalogId,
    title: clean(book.title, 200), prevText: page > 0 ? raw(page - 1).replace(/\s+/g, ' ').trim().slice(0, 1800) : '',
  }
}

async function findGrammar(c: Ctx) {
  const db = adminClient()
  const q = db.from('page_grammar').select('id, content, created_by, created_at').eq('page', c.page).eq('text_hash', c.hash).eq('lang', c.lang)
  const { data } = c.catalogId
    ? await q.eq('catalog_id', c.catalogId).maybeSingle()
    : await q.eq('owner_id', c.userId).eq('book_id', c.bookId).maybeSingle()
  const row = data as { id: string; content: Record<string, unknown>; created_by: string | null; created_at: string } | null
  // Versão antiga (antes da lição completa): tratada como inexistente e regerada.
  if (row && row.content?.v !== LESSON_VERSION) { await db.from('page_grammar').delete().eq('id', row.id); return null }
  return row
}

const LESSON_VERSION = 2

function grammarPrompt(c: Ctx, level: string) {
  const out = c.lang === 'pt' ? 'Brazilian Portuguese' : 'simple English'
  const basic = level === 'A1' || level === 'A2'
  return `You are an excellent English teacher writing ONE lesson of an English course book for a ${c.lang === 'pt' ? 'Brazilian ' : ''}learner (level ${level}).
The lesson teaches the English of ONE page of the book "${c.title}", so the learner understands it deeply before and while reading.
Write like a good textbook: clear, warm, progressive, concrete. ${basic ? 'The learner is a beginner: explain step by step, avoid jargon, always translate examples.' : 'Go deeper: nuance, register, contrasts between close forms.'}
All explanations in ${out}. English examples stay in English. Never use em dashes or en dashes (use commas, colons or periods) and no emojis. "from_page" examples must quote the page EXACTLY. "other" examples are NEW everyday situations (work, travel, home, friends) using the same structure.

PAGE TEXT:
"""
${c.text}
"""
${c.prevText ? `PREVIOUS PAGE (context only):\n"""\n${c.prevText.slice(0, 900)}\n"""` : ''}

Return JSON only:
{"title": "lesson title (short, catchy, in ${c.lang === 'pt' ? 'Portuguese' : 'English'})",
 "summary": "2-3 sentences: what happens on the page and what English it trains",
 "goals": ["3-4 short items: what the learner will be able to do after this lesson"],
 "vocabulary": [{"word": "key word or expression from the page", "meaning": "meaning in context", "example": "exact short quote from the page", "note": "optional: false friend, register, plural, pronunciation hint"}] (6 to 10, most useful first),
 "units": [{"title": "grammar point (e.g. Adjective before the noun; Past simple of 'to be')",
   "explanation": "3-5 sentences, teaching it from scratch at this level",
   "formula": "pattern like 'Subject + was/were + adjective' (or empty)",
   "from_page": [{"en": "exact quote", "pt": "translation"}] (1-3),
   "other": [{"en": "new example", "pt": "translation"}] (2-3),
   "mistake": {"wrong": "typical mistake of Brazilian learners", "right": "correct version", "why": "short reason"},
   "practice": {"prompt": "one short exercise (fill the gap / translate / transform)", "answer": "answer"}}] (3 to 6 units, most important first; always cover 'to be' if present, adjective/noun order, articles, plurals, word order, prepositions, auxiliary do/does/did when present),
 "tenses": [{"sentence": "exact clause from the page", "tense": "Past simple | Present simple | Present continuous | Past continuous | Future (will / going to) | Present perfect | Past perfect | Imperative | Modal ...", "time": "past | present | future", "why": "short reason"}] (up to 8),
 "questions_negatives": [{"sentence": "exact sentence from the page", "why": "why do/does/did/don't/not or inversion is used", "build": "how to build it step by step (short)"}] (up to 5; empty if none),
 "phrasal": [{"phrase": "phrasal verb, idiom or compound found on the page", "together": "meaning together", "apart": "meaning of the parts, if different", "example": "new example sentence"}] (up to 6; empty if none),
 "pronunciation": [{"word": "word from the page", "tip": "how to say it (simple phonetic hint for Brazilians)"}] (2 to 4),
 "recap": ["3 short bullets to remember"],
 "tip": "one practical tip to read this page more fluently"}`
}

type Pair = { en?: string; pt?: string }
function lessonFrom(raw: Record<string, unknown>) {
  const pairs = (v: unknown, n: number) => arr<Pair>(v, n).map(e => ({ en: clean(e?.en, 200), pt: clean(e?.pt, 200) })).filter(e => e.en)
  return {
    v: LESSON_VERSION,
    title: clean(raw.title, 90),
    summary: clean(raw.summary, 500),
    goals: arr<string>(raw.goals, 4).map(g => clean(g, 140)).filter(Boolean),
    vocabulary: arr<Record<string, unknown>>(raw.vocabulary, 10).map(v => ({ word: clean(v.word, 50), meaning: clean(v.meaning, 140), example: clean(v.example, 180), note: clean(v.note, 160) })).filter(v => v.word),
    units: arr<Record<string, unknown>>(raw.units, 6).map(u => {
      const m = (u.mistake ?? {}) as Record<string, unknown>
      const pr = (u.practice ?? {}) as Record<string, unknown>
      return {
        title: clean(u.title, 100), explanation: clean(u.explanation, 900), formula: clean(u.formula, 120),
        from_page: pairs(u.from_page, 3), other: pairs(u.other, 3),
        mistake: m.wrong ? { wrong: clean(m.wrong, 160), right: clean(m.right, 160), why: clean(m.why, 240) } : null,
        practice: pr.prompt ? { prompt: clean(pr.prompt, 240), answer: clean(pr.answer, 200) } : null,
      }
    }).filter(u => u.title),
    tenses: arr<Record<string, unknown>>(raw.tenses, 8).map(t => ({ sentence: clean(t.sentence, 200), tense: clean(t.tense, 60), time: ['past', 'present', 'future'].includes(String(t.time)) ? String(t.time) : 'present', why: clean(t.why, 240) })),
    questions_negatives: arr<Record<string, unknown>>(raw.questions_negatives, 5).map(t => ({ sentence: clean(t.sentence, 200), why: clean(t.why, 240), build: clean(t.build, 240) })),
    phrasal: arr<Record<string, unknown>>(raw.phrasal, 6).map(t => ({ phrase: clean(t.phrase, 60), together: clean(t.together, 160), apart: clean(t.apart, 160), example: clean(t.example, 180) })),
    pronunciation: arr<Record<string, unknown>>(raw.pronunciation, 4).map(t => ({ word: clean(t.word, 40), tip: clean(t.tip, 200) })).filter(t => t.word),
    recap: arr<string>(raw.recap, 4).map(r => clean(r, 200)).filter(Boolean),
    tip: clean(raw.tip, 300),
  }
}

type QuizQuestion = { type: 'choice' | 'order'; prompt: string; options?: string[]; answer: number | string; words?: string[]; explain: string }

function quizPrompt(c: Ctx, tier: number, level: string, grammar: Record<string, unknown> | null, words: string[]) {
  const guide = tier === 1
    ? 'EASY: recognise words and simple forms; choose the right word or tense for a short sentence; vocabulary from the page; very short sentences.'
    : tier === 2
      ? 'MEDIUM: fill in the correct verb form or tense, choose between do/does/did, spot the adjective/noun order, use phrasal verbs from the page.'
      : 'HARD: reorder words into a correct sentence, fix tense or word-order mistakes, choose between close forms (past simple vs present perfect), use the learner’s words in new sentences.'
  return `Create a gamified quiz of 6 questions in English for a learner (level ${level}) based on ONE book page, to practise its grammar and vocabulary. Difficulty tier ${tier}/3 — ${guide}
Use sentences adapted from the page or the previous page, plus the learner's words when natural: ${words.length ? words.join(', ') : '(none yet)'}.
${grammar ? `Grammar of this page (focus on these rules): ${JSON.stringify({ rules: arr<{ title?: string }>(grammar.units ?? grammar.rules, 6).map(r => r.title) })}` : ''}

PAGE TEXT:
"""
${c.text.slice(0, 2500)}
"""
${c.prevText ? `PREVIOUS PAGE (review its grammar and words too):\n"""\n${c.prevText.slice(0, 1200)}\n"""` : ''}

Rules: questions get progressively harder inside the quiz. Types: "choice" (3-4 options; "answer" = index of the correct option) and "order" (give the sentence split into "words" shuffled; "answer" = the correct full sentence). Use at most 2 "order" questions and only for tier 2-3. "explain" is a short explanation in ${c.lang === 'pt' ? 'Brazilian Portuguese' : 'English'} of why the answer is right. Never ask about content not covered by the page, previous page or the learner's words.
Return JSON only: {"title": "short title in ${c.lang === 'pt' ? 'Portuguese' : 'English'}", "questions": [{"type": "choice", "prompt": "...", "options": ["..."], "answer": 0, "explain": "..."}, {"type": "order", "prompt": "Put the words in order", "words": ["..."], "answer": "full sentence", "explain": "..."}]}`
}

async function handle(userId: string, b: Body) {
  const db = adminClient()
  const ent = await entitlements(userId)
  const level = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(String(b.level)) ? String(b.level) : 'A1'

  switch (b.action) {
    case 'get': {
      const c = await loadContext(userId, b)
      const row = await findGrammar(c)
      return { found: !!row, content: row?.content ?? null, shared: !!(row && c.catalogId && row.created_by !== userId) }
    }

    case 'generate': {
      const c = await loadContext(userId, b)
      const existing = await findGrammar(c)
      if (existing) return { found: true, content: existing.content, shared: !!(c.catalogId && existing.created_by !== userId), charged: false }
      const raw = await metered(userId, 'page-grammar', async () => {
        const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
        return await llmJson<Record<string, unknown>>(provider, key, { prompt: grammarPrompt(c, level) })
      }, { plan: ent.plan, ref: `${c.bookId}:${c.page}` })
      const content = lessonFrom(raw)
      if (content.units.length < 2) throw new AiError('lesson_invalid', 502, 'lesson_invalid')
      const row = c.catalogId
        ? { catalog_id: c.catalogId, page: c.page, text_hash: c.hash, lang: c.lang, content, created_by: userId }
        : { owner_id: userId, book_id: c.bookId, page: c.page, text_hash: c.hash, lang: c.lang, content, created_by: userId }
      const { error } = await db.from('page_grammar').insert(row)
      if (error && !/duplicate/i.test(error.message)) throw new AiError(`insert_failed: ${error.message}`, 500, 'db_error')
      // Duas pessoas gerando juntas: devolve a versão que ficou guardada.
      const saved = await findGrammar(c)
      return { found: true, content: saved?.content ?? content, shared: false, charged: true }
    }

    case 'quiz-get':
    case 'quiz': {
      const c = await loadContext(userId, b)
      const tier = Math.max(1, Math.min(3, Math.round(Number(b.tier ?? 1))))
      const { data: saved } = await db.from('page_quizzes').select('content').eq('user_id', userId).eq('book_id', c.bookId).eq('page', c.page).eq('tier', tier).eq('text_hash', c.hash).maybeSingle()
      if (saved) return { quiz: saved.content, tier, charged: false }
      if (b.action === 'quiz-get') return { quiz: null, tier }
      const grammar = (await findGrammar(c))?.content ?? null
      const { data: vocab } = await db.from('vocabulary').select('text, status').eq('user_id', userId).eq('book_id', c.bookId).in('status', ['learned', 'review', 'important']).order('created_at', { ascending: false }).limit(20)
      const words = (vocab ?? []).map(v => clean(v.text, 40)).filter(Boolean)
      const raw = await metered(userId, 'page-quiz', async () => {
        const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
        return await llmJson<{ title?: string; questions?: Record<string, unknown>[] }>(provider, key, { prompt: quizPrompt(c, tier, level, grammar, words) })
      }, { plan: ent.plan, ref: `${c.bookId}:${c.page}:${tier}` })
      const questions: QuizQuestion[] = arr<Record<string, unknown>>(raw.questions, 8).flatMap((q) => {
        const prompt = clean(q.prompt, 300)
        const explain = clean(q.explain, 300)
        if (!prompt) return []
        if (q.type === 'order') {
          const w = arr<string>(q.words, 14).map(x => clean(x, 30)).filter(Boolean)
          const answer = clean(q.answer, 200)
          return w.length >= 3 && answer ? [{ type: 'order' as const, prompt, words: w, answer, explain }] : []
        }
        const options = arr<string>(q.options, 4).map(x => clean(x, 120)).filter(Boolean)
        const answer = Number(q.answer)
        return options.length >= 2 && Number.isInteger(answer) && answer >= 0 && answer < options.length ? [{ type: 'choice' as const, prompt, options, answer, explain }] : []
      }).slice(0, 6)
      if (questions.length < 3) throw new AiError('quiz_invalid', 502, 'quiz_invalid')
      const content = { title: clean(raw.title, 80) || 'Desafio', questions }
      await db.from('page_quizzes').upsert({ user_id: userId, book_id: c.bookId, page: c.page, tier, text_hash: c.hash, content }, { onConflict: 'user_id,book_id,page,tier,text_hash', ignoreDuplicates: true })
      return { quiz: content, tier, charged: true }
    }

    case 'quiz-result': {
      const bookId = String(b.bookId ?? '')
      if (!/^[\da-f-]{36}$/i.test(bookId)) throw new GrammarError('invalid_target')
      const total = Math.max(1, Math.min(12, Number(b.total ?? 1)))
      const correct = Math.max(0, Math.min(total, Number(b.correct ?? 0)))
      await db.from('quiz_results').insert({ user_id: userId, book_id: bookId, page: Number(b.page ?? 0), tier: Math.max(1, Math.min(3, Number(b.tier ?? 1))), correct, total })
      return { ok: true }
    }

    case 'quiz-history': {
      const bookId = String(b.bookId ?? '')
      const { data } = await db.from('quiz_results').select('correct, total, tier, page').eq('user_id', userId).eq('book_id', bookId).order('created_at', { ascending: false }).limit(10)
      return { results: data ?? [] }
    }

    default:
      throw new GrammarError('unknown_action')
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
    if (e instanceof GrammarError) return json({ error: e.code }, e.status)
    const err = e instanceof AiError ? e : new AiError(String((e as Error)?.message ?? e))
    log('grammar', 'error', { action: body.action, code: err.code, msg: err.message.slice(0, 200) })
    return json({ error: err.code, detail: err.message }, err.status)
  }
})
