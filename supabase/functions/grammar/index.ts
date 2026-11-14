// "Decifrar a página" (gramática da página) e "Desafio" (quiz). O texto da página vem SEMPRE do banco,
// nunca do aparelho. A gramática de livros da galeria é compartilhada: gerada uma vez, reaproveitada por todos.
import { adminClient, corsHeaders, getUser, json, log, sha256Hex } from '../_shared/tts.ts'
import { AiError, llmJson, pickProvider } from '../_shared/ai.ts'
import { entitlements, metered } from '../_shared/billing.ts'

type Body = { action?: string; bookId?: string; page?: number; lang?: string; level?: string; tier?: number; correct?: number; total?: number }
class GrammarError extends Error { constructor(public code: string, public status = 400) { super(code) } }

const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
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
  const q = db.from('page_grammar').select('content, created_by, created_at').eq('page', c.page).eq('text_hash', c.hash).eq('lang', c.lang)
  const { data } = c.catalogId
    ? await q.eq('catalog_id', c.catalogId).maybeSingle()
    : await q.eq('owner_id', c.userId).eq('book_id', c.bookId).maybeSingle()
  return data as { content: Record<string, unknown>; created_by: string | null; created_at: string } | null
}

function grammarPrompt(c: Ctx, level: string) {
  const out = c.lang === 'pt' ? 'Brazilian Portuguese' : 'simple English'
  return `You are an expert English teacher helping a ${c.lang === 'pt' ? 'Brazilian' : ''} learner (level ${level}) understand the grammar of ONE page of the book "${c.title}" BEFORE reading it.
Explain only what actually appears in the text below. Be concrete, short and friendly. Write all explanations in ${out}; keep English examples in English, quoting exact words from the page.

PAGE TEXT:
"""
${c.text}
"""

Return JSON only:
{"summary": "1-2 sentences: what this page trains and what to watch for",
 "rules": [{"title": "rule name (e.g. Adjective before the noun)", "explanation": "2-3 short sentences", "examples": ["exact short quotes from the page"]}] (3 to 6 rules, most important first; always include how "to be" is used if it appears; adjective/noun order, plurals, articles, word order, prepositions when present),
 "tenses": [{"sentence": "exact sentence or clause from the page", "tense": "Past simple | Present simple | Present continuous | Future (will / going to) | Present perfect | Imperative | ...", "why": "short reason"}] (up to 8, covering past/present/future found on the page),
 "questions_negatives": [{"sentence": "exact sentence from the page", "why": "why 'do/does/did/don't/not' or inversion is used here"}] (up to 5; empty if none),
 "phrasal": [{"phrase": "multi-word expression found on the page (phrasal verb, idiom, compound)", "together": "meaning together", "apart": "meaning of the words separately, if different"}] (up to 6; empty if none),
 "tip": "one practical tip to read this page more fluently"}`
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
${grammar ? `Grammar of this page (focus on these rules): ${JSON.stringify({ rules: arr<{ title?: string }>(grammar.rules, 6).map(r => r.title) })}` : ''}

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
      const content = {
        summary: clean(raw.summary, 400),
        rules: arr<{ title?: string; explanation?: string; examples?: string[] }>(raw.rules, 6).map(r => ({ title: clean(r.title, 100), explanation: clean(r.explanation, 500), examples: arr<string>(r.examples, 3).map(e => clean(e, 160)) })),
        tenses: arr<{ sentence?: string; tense?: string; why?: string }>(raw.tenses, 8).map(t => ({ sentence: clean(t.sentence, 200), tense: clean(t.tense, 60), why: clean(t.why, 240) })),
        questions_negatives: arr<{ sentence?: string; why?: string }>(raw.questions_negatives, 5).map(t => ({ sentence: clean(t.sentence, 200), why: clean(t.why, 240) })),
        phrasal: arr<{ phrase?: string; together?: string; apart?: string }>(raw.phrasal, 6).map(t => ({ phrase: clean(t.phrase, 60), together: clean(t.together, 160), apart: clean(t.apart, 160) })),
        tip: clean(raw.tip, 300),
      }
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
