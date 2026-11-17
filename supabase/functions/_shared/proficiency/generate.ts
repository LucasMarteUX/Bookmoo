// Banco de questões: geração por IA → validação automática → revisão por IA → (aprovação humana no admin).
// Questões originais, inspiradas apenas no formato público dos tipos de tarefa. Nenhum texto oficial é copiado.
import { TASKS, type Stage, type TaskType } from './blueprint.ts'
import type { Answer, Choice, Segment } from './engine.ts'

export type Generated = {
  content: Record<string, unknown>
  answer: Answer
  script: Record<string, unknown> | null
  rubric: string | null
  cefr: string
  difficulty: number
  topic: string
}

const LEVEL_FOR: Record<Exclude<Stage, 'any'> | 'any', { cefr: string; difficulty: number; words: string }> = {
  easy: { cefr: 'A2-B1', difficulty: 2.5, words: 'high-frequency vocabulary, short sentences, concrete topics' },
  router: { cefr: 'B1-B2', difficulty: 3.5, words: 'everyday and general academic vocabulary, some complex sentences' },
  hard: { cefr: 'B2-C1', difficulty: 4.8, words: 'academic vocabulary, complex syntax, implicit meaning and inference' },
  any: { cefr: 'B1-B2', difficulty: 3.5, words: 'everyday and general academic vocabulary' },
}

// Vozes do Kokoro (as mesmas do leitor). Escolhidas pelo código, nunca pela IA.
const VOICES = { f: ['af_heart', 'af_bella', 'bf_emma', 'af_nicole'], m: ['am_michael', 'bm_george', 'am_fenrir', 'bm_fable'] }
const pick = <T,>(xs: T[], seed: number) => xs[Math.abs(seed) % xs.length]

const COMMON = `All content must be ORIGINAL (never copy real exam material), culturally neutral, inclusive, factually accurate, and free of trademarks, real living people, politics, religion, violence or sensitive topics. Use American English spelling.`

const MCQ_RULES = `Each question has exactly 4 options, exactly one is clearly correct, distractors are plausible but unambiguously wrong, options have similar length, and no question can be answered without the text/audio.`

/** Prompt de geração de `count` questões de um tipo. */
export function generationPrompt(task: TaskType, stage: Stage, count: number, avoid: string[]): string {
  const lvl = LEVEL_FOR[stage]
  const head = `You write items for an English proficiency test for adult learners. Target level ${lvl.cefr} (${lvl.words}). ${COMMON}
Write ${count} different items with clearly different topics.${avoid.length ? ` Avoid these topics already in the bank: ${avoid.slice(0, 40).join('; ')}.` : ''}
Return JSON only: {"items": [ ... ]}. Each item has "topic" (2-5 words).`
  switch (task) {
    case 'complete_words':
      return `${head}
Task "Complete the Words": a short academic-style paragraph of 70-95 words (4-6 sentences) on a general science, history, arts or social topic. The first sentence must be short and self-contained. Use mostly words of 3+ letters after the first sentence. No numbers, no proper nouns after the first sentence, no quotes, no lists.
Item format: {"topic": "...", "title": "...", "text": "..."}`
    case 'daily_life':
      return `${head}
Task "Read in Daily Life": a short real-life text (40-110 words) such as a notice, email, text message chain, menu, schedule, product label, advertisement or social media post, followed by 2 comprehension questions (main idea, detail, inference or purpose). ${MCQ_RULES}
Item format: {"topic": "...", "genre": "notice|email|text_messages|menu|schedule|label|advertisement|post", "title": "short heading", "body": "the text; use \\n for line breaks", "questions": [{"prompt": "...", "options": ["...","...","...","..."], "answer": 0-3}]}`
    case 'academic_passage':
      return `${head}
Task "Read an Academic Passage": an expository passage of 180-220 words (introductory university level) followed by 5 questions: main idea, two details, one vocabulary-in-context (quote the word), one inference. ${MCQ_RULES}
Item format: {"topic": "...", "title": "...", "passage": "...", "questions": [{"prompt": "...", "options": [4 strings], "answer": 0-3}]}`
    case 'choose_response':
      return `${head}
Task "Listen and Choose a Response": one person says ONE short sentence or question in a campus, work or daily-life situation (6-16 words). The learner hears it (audio only) and picks the most natural spoken reply. The 4 reply options are short (2-10 words); distractors use words from the prompt but do not answer it appropriately. ${MCQ_RULES}
Item format: {"topic": "...", "speaker": "female|male", "says": "...", "options": [4 replies], "answer": 0-3}`
    case 'conversation':
      return `${head}
Task "Listen to a Conversation": a natural conversation between two people (a woman "W" and a man "M") in a campus or daily-life situation, 8-12 turns, 120-180 words in total, then 2 questions (gist, detail, speaker purpose or what will happen next). Questions must refer to "the woman"/"the man", never to names. ${MCQ_RULES}
Item format: {"topic": "...", "context": "one sentence describing the situation, e.g. Listen to a conversation between two students.", "lines": [{"speaker": "W|M", "text": "..."}], "questions": [{"prompt": "...", "options": [4], "answer": 0-3}]}`
    case 'announcement':
      return `${head}
Task "Listen to an Announcement": one speaker makes a campus, workplace or public announcement of 80-130 words, then 2 questions (purpose, detail or instruction). ${MCQ_RULES}
Item format: {"topic": "...", "speaker": "female|male", "context": "e.g. Listen to an announcement in a university library.", "text": "...", "questions": [{"prompt": "...", "options": [4], "answer": 0-3}]}`
    case 'academic_talk':
      return `${head}
Task "Listen to an Academic Talk": part of a short lecture (200-280 words) by a professor in an introductory course, with a clear structure (topic, explanation, example). Then 4 questions: main idea, two details, one about the purpose of an example or the speaker's attitude. ${MCQ_RULES}
Item format: {"topic": "...", "speaker": "female|male", "context": "e.g. Listen to part of a talk in a biology class.", "text": "...", "questions": [{"prompt": "...", "options": [4], "answer": 0-3}]}`
    case 'build_sentence':
      return `${head}
Task "Build a Sentence": person A says a short line in a daily or campus situation; person B replies with ONE grammatical sentence of 7-13 words. Split B's reply into 5-7 fragments (each 1-3 words) whose ONLY grammatical, natural order is the original sentence. Do not put the final punctuation in a fragment.
Item format: {"topic": "...", "a_says": "...", "reply": "the full correct reply without final punctuation", "punctuation": "." or "?", "fragments": ["in correct order", "..."]}`
    case 'write_email':
      return `${head}
Task "Write an Email": a realistic situation (e.g. to a professor, a landlord, a manager, a club organizer) that asks the learner to write an email that covers 3 specific points. The learner has 7 minutes.
Item format: {"topic": "...", "scenario": "2-4 sentences describing the situation in second person", "to": "recipient role or name", "subject": "short subject", "tasks": ["point 1", "point 2", "point 3"]}`
    case 'academic_discussion':
      return `${head}
Task "Write for an Academic Discussion": a professor posts a question on an online class discussion board about a debatable topic (3-5 sentences), and two students reply with different opinions (2-4 sentences each). The learner must write their own contribution in 10 minutes.
Item format: {"topic": "...", "course": "e.g. Sociology", "professor": {"name": "Dr. Lastname", "post": "..."}, "students": [{"name": "first name", "post": "..."}, {"name": "first name", "post": "..."}]}`
    case 'listen_repeat':
      return `${head}
Task "Listen and Repeat": ONE sentence the learner hears and must repeat exactly, as if training to be a campus tour guide, a museum guide or a receptionist. Vary length across items: 6-16 words; longer and more complex at higher levels. Natural spoken English, no names or numbers.
Item format: {"topic": "...", "context": "e.g. You are learning to welcome visitors to a science museum.", "text": "..."}`
    case 'interview':
      return `${head}
Task "Take an Interview": an interviewer asks 4 questions on one theme (e.g. a research study about study habits, technology, city life). Question 1 is personal and simple, 2 asks for an experience, 3 asks for an opinion with reasons, 4 asks to discuss a broader issue or hypothetical. Each question is 1-2 sentences, spoken style.
Item format: {"topic": "...", "context": "one sentence, e.g. You agreed to take part in a research study about how people use public spaces.", "questions": ["q1", "q2", "q3", "q4"]}`
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Complete the Words: as lacunas são feitas pelo código (determinístico), não pela IA.
const WORD = /[A-Za-z]+(?:'[A-Za-z]+)?/g

export function buildGaps(text: string, total = 10): { segments: Segment[]; gaps: Record<string, string> } | null {
  const clean = text.replace(/\s+/g, ' ').trim()
  const firstEnd = clean.search(/[.!?]\s/)
  if (firstEnd < 0) return null
  const startAt = firstEnd + 2
  const segments: Segment[] = []
  const gaps: Record<string, string> = {}
  const pushText = (v: string) => {
    if (!v) return
    const last = segments[segments.length - 1]
    if (last && last.t === 'text') last.v += v
    else segments.push({ t: 'text', v })
  }
  pushText(clean.slice(0, startAt))
  const rest = clean.slice(startAt)
  let cursor = 0, turn = false, n = 0
  for (const m of rest.matchAll(WORD)) {
    const w = m[0], at = m.index ?? 0
    pushText(rest.slice(cursor, at))
    cursor = at + w.length
    // Segunda metade de cada segunda palavra; palavras de 1 letra, com maiúscula ou com apóstrofo passam a vez adiante.
    const eligible = w.length >= 2 && !/[A-Z]/.test(w) && !w.includes("'")
    if (n < total && turn && eligible) {
      const keep = Math.floor(w.length / 2)
      const id = `g${++n}`
      gaps[id] = w.slice(keep)
      segments.push({ t: 'gap', id, prefix: w.slice(0, keep), len: w.length - keep })
      turn = false
    } else {
      pushText(w)
      if (eligible || !turn) turn = !turn
    }
  }
  pushText(rest.slice(cursor))
  return n === total ? { segments, gaps } : null
}

// ---------------------------------------------------------------------------------------------------------------------
// Normalização e validação estrutural de cada item gerado.
// Sem emojis no conteúdo da prova (o modelo às vezes coloca em avisos e posts).
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]\s?/gu
const str = (v: unknown, max = 4000) => String(v ?? '').replace(EMOJI, '').replace(/[ \t]+/g, ' ').trim().slice(0, max)
const wc = (s: string) => s.split(/\s+/).filter(Boolean).length

function choices(raw: unknown, need: number, issues: string[]): { qs: Choice[]; key: Record<string, number> } {
  const list = Array.isArray(raw) ? raw : []
  if (list.length !== need) issues.push(`expected ${need} questions, got ${list.length}`)
  const qs: Choice[] = []
  const key: Record<string, number> = {}
  list.slice(0, need).forEach((q: Record<string, unknown>, i: number) => {
    const options = Array.isArray(q?.options) ? (q.options as unknown[]).map(o => str(o, 300)) : []
    const ans = Number(q?.answer)
    if (options.length !== 4 || options.some(o => !o)) issues.push(`q${i + 1}: needs 4 non-empty options`)
    if (new Set(options.map(o => o.toLowerCase())).size !== options.length) issues.push(`q${i + 1}: duplicated options`)
    if (!Number.isInteger(ans) || ans < 0 || ans > 3) issues.push(`q${i + 1}: invalid answer index`)
    if (!str(q?.prompt)) issues.push(`q${i + 1}: empty prompt`)
    const id = `q${i + 1}`
    qs.push({ id, prompt: str(q?.prompt, 400), options })
    key[id] = ans
  })
  return { qs, key }
}

/** Embaralha as opções de forma determinística por semente, para o gabarito não cair sempre na mesma letra. */
function shuffleChoices(qs: Choice[], key: Record<string, number>, seed: number) {
  qs.forEach((q, i) => {
    const target = (seed + i * 7) % 4
    const cur = key[q.id]
    if (cur === target || cur == null) return
    const o = [...q.options];
    [o[cur], o[target]] = [o[target], o[cur]]
    q.options = o
    key[q.id] = target
  })
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }

export function normalizeItem(task: TaskType, stage: Stage, raw: Record<string, unknown>): { item: Generated | null; issues: string[] } {
  const issues: string[] = []
  const lvl = LEVEL_FOR[stage]
  const topic = str(raw?.topic, 80) || 'general'
  const seed = hash(JSON.stringify(raw ?? {}))
  const base = { cefr: lvl.cefr.split('-')[stage === 'hard' ? 1 : 0], difficulty: lvl.difficulty, topic, rubric: null as string | null }
  let content: Record<string, unknown> = {}
  let answer: Answer = {}
  let script: Record<string, unknown> | null = null

  switch (task) {
    case 'complete_words': {
      const text = str(raw.text, 1200)
      if (wc(text) < 60 || wc(text) > 110) issues.push(`text has ${wc(text)} words (60-110)`)
      const g = buildGaps(text)
      if (!g) { issues.push('could not build 10 gaps'); break }
      content = { title: str(raw.title, 120), segments: g.segments }
      answer = { gaps: g.gaps }
      break
    }
    case 'daily_life': {
      const body = String(raw.body ?? '').replace(EMOJI, '').slice(0, 1500).trim()
      if (wc(body) < 25 || wc(body) > 140) issues.push(`body has ${wc(body)} words (25-140)`)
      const c = choices(raw.questions, 2, issues)
      shuffleChoices(c.qs, c.key, seed)
      content = { genre: str(raw.genre, 30) || 'notice', title: str(raw.title, 120), body, questions: c.qs }
      answer = { choices: c.key }
      break
    }
    case 'academic_passage': {
      const passage = str(raw.passage, 2400)
      if (wc(passage) < 150 || wc(passage) > 260) issues.push(`passage has ${wc(passage)} words (150-260)`)
      const c = choices(raw.questions, 5, issues)
      shuffleChoices(c.qs, c.key, seed)
      content = { title: str(raw.title, 120), passage, questions: c.qs }
      answer = { choices: c.key }
      break
    }
    case 'choose_response': {
      const says = str(raw.says, 300)
      if (wc(says) < 3 || wc(says) > 22) issues.push('prompt sentence length')
      const c = choices([{ prompt: 'Choose the best response.', options: raw.options, answer: raw.answer }], 1, issues)
      shuffleChoices(c.qs, c.key, seed)
      const voice = pick(raw.speaker === 'male' ? VOICES.m : VOICES.f, seed)
      content = { context: 'Listen to the speaker and choose the best response.', questions: c.qs }
      answer = { choices: c.key }
      script = { lines: [{ speaker: 'A', voice, text: says }] }
      break
    }
    case 'conversation': {
      const lines = (Array.isArray(raw.lines) ? raw.lines : []).map((l: Record<string, unknown>) => ({ speaker: l?.speaker === 'M' ? 'M' : 'W', text: str(l?.text, 400) })).filter((l: { text: string }) => l.text)
      const words = lines.reduce((n: number, l: { text: string }) => n + wc(l.text), 0)
      if (lines.length < 6 || words < 80 || words > 230) issues.push(`conversation has ${lines.length} turns / ${words} words`)
      const c = choices(raw.questions, 2, issues)
      shuffleChoices(c.qs, c.key, seed)
      const w = pick(VOICES.f, seed), m = pick(VOICES.m, seed >> 3)
      content = { context: str(raw.context, 200) || 'Listen to a conversation.', questions: c.qs }
      answer = { choices: c.key }
      script = { lines: lines.map((l: { speaker: string; text: string }) => ({ ...l, voice: l.speaker === 'M' ? m : w })) }
      break
    }
    case 'announcement': case 'academic_talk': {
      const text = str(raw.text, 2600)
      const [lo, hi, nq] = task === 'announcement' ? [60, 160, 2] : [170, 320, 4]
      if (wc(text) < lo || wc(text) > hi) issues.push(`talk has ${wc(text)} words (${lo}-${hi})`)
      const c = choices(raw.questions, nq, issues)
      shuffleChoices(c.qs, c.key, seed)
      const voice = pick(raw.speaker === 'male' ? VOICES.m : VOICES.f, seed)
      content = { context: str(raw.context, 200) || (task === 'announcement' ? 'Listen to an announcement.' : 'Listen to part of a talk.'), questions: c.qs }
      answer = { choices: c.key }
      script = { lines: [{ speaker: 'A', voice, text }] }
      break
    }
    case 'build_sentence': {
      const fragments = (Array.isArray(raw.fragments) ? raw.fragments : []).map((f: unknown) => str(f, 60)).filter(Boolean)
      const reply = str(raw.reply, 200).replace(/[.?!]+$/, '')
      if (fragments.length < 4 || fragments.length > 8) issues.push(`${fragments.length} fragments (4-8)`)
      if (fragments.join(' ').toLowerCase().replace(/\s+/g, ' ') !== reply.toLowerCase().replace(/\s+/g, ' ')) issues.push('fragments do not rebuild the reply')
      // Fragmentos embaralhados de forma determinística (nunca na ordem certa).
      const shuffled = [...fragments].sort((a, b) => hash(a + seed) - hash(b + seed))
      if (shuffled.join('|') === fragments.join('|') && shuffled.length > 1) shuffled.push(shuffled.shift()!)
      content = { a_says: str(raw.a_says, 240), fragments: shuffled, punctuation: raw.punctuation === '?' ? '?' : '.' }
      answer = { order: fragments }
      break
    }
    case 'write_email': {
      const tasks = (Array.isArray(raw.tasks) ? raw.tasks : []).map((t: unknown) => str(t, 200)).filter(Boolean)
      if (tasks.length !== 3) issues.push('email needs 3 tasks')
      if (!str(raw.scenario)) issues.push('empty scenario')
      content = { scenario: str(raw.scenario, 800), to: str(raw.to, 80), subject: str(raw.subject, 120), tasks }
      base.rubric = 'email'
      break
    }
    case 'academic_discussion': {
      const prof = (raw.professor ?? {}) as Record<string, unknown>
      const students = (Array.isArray(raw.students) ? raw.students : []).slice(0, 2).map((s: Record<string, unknown>) => ({ name: str(s?.name, 40), post: str(s?.post, 700) }))
      if (!str(prof.post) || students.length !== 2 || students.some((s: { post: string }) => !s.post)) issues.push('discussion needs professor post and 2 students')
      content = { course: str(raw.course, 60), professor: { name: str(prof.name, 60), post: str(prof.post, 900) }, students }
      base.rubric = 'discussion'
      break
    }
    case 'listen_repeat': {
      const text = str(raw.text, 240)
      const n = wc(text)
      if (n < 5 || n > 18) issues.push(`sentence has ${n} words (5-18)`)
      // Gravação de 8 a 12 s, proporcional ao tamanho da frase.
      const seconds = Math.max(8, Math.min(12, Math.round(6 + n * 0.4)))
      content = { context: str(raw.context, 200) || 'Listen and repeat what you hear.', seconds }
      answer = { text }
      script = { lines: [{ speaker: 'A', voice: pick(VOICES.f, seed), text }] }
      base.difficulty = Math.max(1, Math.min(6, 1 + (n - 5) * 0.4))
      break
    }
    case 'interview': {
      const qs = (Array.isArray(raw.questions) ? raw.questions : []).map((q: unknown) => str(q, 300)).filter(Boolean)
      if (qs.length !== 4) issues.push('interview needs 4 questions')
      const voice = pick(VOICES.f, seed)
      content = { context: str(raw.context, 240), questions: qs.slice(0, 4).map((_: string, i: number) => ({ id: `q${i + 1}`, seconds: 45 })) }
      script = { questions: qs.slice(0, 4).map((text: string, i: number) => ({ id: `q${i + 1}`, voice, text })) }
      base.rubric = 'interview'
      break
    }
  }
  if (issues.length) return { item: null, issues }
  return { item: { ...base, content, answer, script }, issues }
}

// ---------------------------------------------------------------------------------------------------------------------
// Revisão por IA: um segundo modelo resolve as questões sem o gabarito e aponta problemas.
export function reviewPrompt(task: TaskType, items: Generated[]): string {
  const view = items.map((it, i) => ({ n: i, task, content: it.content, spoken: it.script ?? undefined, ...(task === 'build_sentence' ? { intended: it.answer.order } : {}) }))
  return `You are a senior assessment reviewer for an English proficiency test (${TASKS[task].label}). For each item below:
1. If it has multiple-choice questions, answer each one yourself (index 0-3) using only the text/audio script shown.
2. Check: exactly one defensible answer, no ambiguity, no answer leaking from the question, level appropriate (A2-C1), natural English, original content, nothing offensive or sensitive, no cultural bias. For Build a Sentence, check that the intended order is the only natural grammatical one. For Complete the Words, check that the paragraph is coherent and the missing letters are recoverable from context.
Items: ${JSON.stringify(view)}
Return JSON only: {"reviews": [{"n": 0, "answers": {"q1": 0}, "verdict": "pass" | "fail", "issues": ["short issue"], "cefr": "B1"}]}`
}

export type Review = { n: number; answers?: Record<string, number>; verdict?: string; issues?: string[]; cefr?: string }

/** Junta a revisão da IA com o gabarito: se ela respondeu diferente, a questão vai para "rejeitada" com o motivo. */
export function applyReview(item: Generated, review: Review | undefined): { status: 'review' | 'rejected'; validation: Record<string, unknown> } {
  const issues = [...(review?.issues ?? [])].map(s => String(s).slice(0, 200)).slice(0, 6)
  let keyOk = true
  if (item.answer.choices && review?.answers) {
    for (const [q, want] of Object.entries(item.answer.choices)) {
      if (review.answers[q] !== want) { keyOk = false; issues.push(`reviewer chose ${review.answers[q]} for ${q}, key is ${want}`) }
    }
  }
  const pass = !!review && review.verdict === 'pass' && keyOk
  return { status: pass ? 'review' : 'rejected', validation: { structural: 'ok', reviewer: review?.verdict ?? 'missing', key_check: keyOk, issues, reviewer_cefr: review?.cefr ?? null, topic: item.topic } }
}
