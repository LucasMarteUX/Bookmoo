// Banco compartilhado de vocabulário: tudo que a IA gera para um termo (explicação, história,
// exemplos, imagens) fica salvo para todos os usuários. Só a Edge Function escreve (service role);
// o navegador lê direto das tabelas via RLS. Aqui também ficam a moderação mínima e os limites.
import { adminClient } from './tts.ts'
import { AiError, generateImage, llmJson, llmText, pickProvider, type Provider } from './ai.ts'

export const LANG_NAMES: Record<string, string> = { pt: 'Portuguese', es: 'Spanish', fr: 'French', de: 'German', ja: 'Japanese', zh: 'Chinese', en: 'English', it: 'Italian' }

/** Limites por termo: ao atingir, o app só alterna entre as variações existentes (sem gastar API). */
export const CAPS = { explanations: 6, stories: 8, images: 24, examples: 40 }
/** Limites por usuário a cada 24h (proteção do armazenamento compartilhado). */
export const DAILY = { text: 60, images: 16, examples: 80 }
const MAX_TERM = 120
const IMAGES_PER_CLICK = 1

// ---------------------------------------------------------------------------
// Normalização e moderação
// ---------------------------------------------------------------------------
export function normalizeTerm(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s"'“”«»().,;:!?¿¡\-–—]+|[\s"“”«»().,;:!?¿¡\-–—]+$/g, '')
}

export function normalizeLang(raw: unknown): string {
  const l = String(raw ?? 'en').slice(0, 2).toLowerCase()
  return /^[a-z]{2}$/.test(l) ? l : 'en'
}

export const uiLangOf = (raw: unknown): 'pt' | 'en' => (raw === 'pt' ? 'pt' : 'en')

const PII = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/,                       // e-mail
  /\b(?:https?:\/\/|www\.)\S+/i,                    // URL
  /(?:\+?\d[\s().-]?){8,}/,                         // telefone / documentos (8+ dígitos)
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/,               // CPF
]
export const hasPersonalData = (s: string) => PII.some((r) => r.test(s))

/** Remove trechos com dados pessoais de um texto gerado (a IA raramente os produz, mas não salvamos). */
function scrub(s: string, max: number): string {
  let out = s.slice(0, max)
  for (const r of PII) out = out.replace(new RegExp(r.source, r.flags.includes('g') ? r.flags : r.flags + 'g'), '[…]')
  return out.trim()
}

export function validateTerm(raw: unknown): string {
  const term = normalizeTerm(raw)
  if (!term) throw new AiError('empty_term', 400, 'invalid_term')
  if (term.length > MAX_TERM) throw new AiError('term_too_long', 413, 'term_too_long')
  if (term.split(' ').length > 12) throw new AiError('term_too_long', 413, 'term_too_long')
  if (hasPersonalData(term)) throw new AiError('personal_data', 422, 'personal_data')
  return term
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------
export async function ensureTerm(term: string, lang: string): Promise<string> {
  const db = adminClient()
  const { data, error } = await db.from('vocab_terms').upsert({ term_norm: term, lang }, { onConflict: 'term_norm,lang', ignoreDuplicates: false }).select('id').single()
  if (error || !data) throw new AiError(`term_upsert_failed: ${error?.message ?? ''}`, 500, 'db_error')
  return data.id as string
}

async function countSince(table: string, userId: string, hours = 24): Promise<number> {
  const since = new Date(Date.now() - hours * 3600_000).toISOString()
  const { count } = await adminClient().from(table).select('id', { count: 'exact', head: true }).eq('created_by', userId).gte('created_at', since)
  return count ?? 0
}

async function assertDailyText(userId: string) {
  const n = (await countSince('vocab_explanations', userId)) + (await countSince('vocab_stories', userId))
  if (n >= DAILY.text) throw new AiError('daily_limit', 429, 'daily_limit')
}

// ---------------------------------------------------------------------------
// Prompts (reaproveitados pelas ações antigas 'explain' e 'variant-story')
// ---------------------------------------------------------------------------
export type GrammarExample = { form: 'affirmative' | 'negative' | 'interrogative'; context: string; english: string; portuguese: string }
export type Explanation = { definition: string; ipa: string; examples: string[]; grammarExamples: GrammarExample[]; usageNote: string }

export async function explainTerm(provider: Provider, key: string, text: string, level: string, languageCode: string, avoid: string[] = []): Promise<Explanation> {
  const langName = LANG_NAMES[languageCode] ?? 'English'
  const avoidHint = avoid.length
    ? `\nOther learners already saw explanations using these contexts; choose DIFFERENT contexts and different example sentences: ${avoid.slice(0, 12).join(' | ').slice(0, 800)}\n`
    : ''
  const r = await llmJson<Record<string, unknown>>(provider, key, {
    system: `You are a ${langName} teacher. Provide a simple definition in ${langName}, an intuitive phonetic spelling (e.g., AP-uhl for apple) instead of IPA, and exactly 3 example sentences in ${langName}.`,
    prompt: `Explain clearly in ${langName} the meaning of "${text}".
Level: ${level}
Be concise.
${avoidHint}
You are a language teacher focused on practical English for business and career. In addition to the definition and pronunciation, create exactly three practical examples using different business contexts:
1. affirmative
2. negative
3. interrogative

For each example, include the grammatical form, a distinct context, the sentence in English with the analyzed term wrapped in **, and a fluent Portuguese translation. Add a short usage note when the negative or interrogative form changes an auxiliary, verb tense, word order, or another grammatical element.
Never include real people's names, e-mails, phone numbers or URLs.

Return JSON only with this exact shape:
{"definition": string, "ipa": string, "examples": [string, string, string], "grammarExamples": [{"form": "affirmative"|"negative"|"interrogative", "context": string, "english": string, "portuguese": string}], "usageNote": string}`,
  })
  const forms = ['affirmative', 'negative', 'interrogative']
  return {
    definition: scrub(String(r.definition ?? 'No definition found.'), 1500),
    ipa: String(r.ipa ?? '').slice(0, 120),
    examples: (Array.isArray(r.examples) ? r.examples : []).slice(0, 5).map((e) => scrub(String(e), 300)),
    grammarExamples: (Array.isArray(r.grammarExamples) ? r.grammarExamples as Record<string, unknown>[] : [])
      .filter((g) => forms.includes(String(g?.form)))
      .slice(0, 3)
      .map((g) => ({ form: String(g.form) as GrammarExample['form'], context: scrub(String(g.context ?? ''), 120), english: scrub(String(g.english ?? ''), 300), portuguese: scrub(String(g.portuguese ?? ''), 300) })),
    usageNote: scrub(String(r.usageNote ?? ''), 800),
  }
}

export async function storyForTerm(provider: Provider, key: string, text: string, languageCode: string, avoid: string[] = []): Promise<string> {
  const language = languageCode === 'pt' ? 'Portuguese' : "the learner's interface language"
  const avoidHint = avoid.length
    ? `\nOther stories about this term already exist with these titles/openings; write about a clearly DIFFERENT situation: ${avoid.slice(0, 10).join(' | ').slice(0, 800)}`
    : ''
  const story = await llmText(provider, key, {
    prompt: `Create a short parallel story for a language learner based on the English term "${text}".
The story must be independent from any book context, use a fresh everyday or professional situation, and demonstrate the term naturally at least three times in different sentences. Write the story in ${language}, but keep the target term and its example sentences in English. Add a one-sentence title. Keep it between 80 and 130 words. Never include real people's names, e-mails, phone numbers or URLs. Return plain text only.${avoidHint}`,
  })
  return scrub(story, 2000)
}

// ---------------------------------------------------------------------------
// Ações compartilhadas
// ---------------------------------------------------------------------------
type Body = Record<string, unknown>

const EXPL_COLS = 'id, ui_lang, definition, pronunciation, examples, grammar_examples, usage_note, created_at'

export async function sharedExplain(userId: string, b: Body) {
  const term = validateTerm(b.text)
  const lang = normalizeLang(b.lang)
  const uiLang = uiLangOf(b.uiLang)
  const level = ['A2', 'B1', 'B2'].includes(String(b.level)) ? String(b.level) : 'B1'
  const termId = await ensureTerm(term, lang)
  const db = adminClient()
  const { data: existing } = await db.from('vocab_explanations').select('grammar_examples').eq('term_id', termId).eq('ui_lang', uiLang)
  if ((existing?.length ?? 0) >= CAPS.explanations) return { capped: true, termId }
  await assertDailyText(userId)
  const avoid = (existing ?? []).flatMap((r) => ((r.grammar_examples ?? []) as GrammarExample[]).map((g) => g.context)).filter(Boolean)
  const { provider, key } = await pickProvider(userId, ['gemini', 'openai'])
  const e = await explainTerm(provider, key, term, level, uiLang, avoid)
  const { data, error } = await db.from('vocab_explanations').insert({
    term_id: termId, ui_lang: uiLang, definition: e.definition, pronunciation: e.ipa, examples: e.examples,
    grammar_examples: e.grammarExamples, usage_note: e.usageNote, provider, created_by: userId,
  }).select(EXPL_COLS).single()
  if (error) throw new AiError(`insert_failed: ${error.message}`, 500, 'db_error')
  return { termId, explanation: data }
}

export async function sharedStory(userId: string, b: Body) {
  const term = validateTerm(b.text)
  const lang = normalizeLang(b.lang)
  const uiLang = uiLangOf(b.uiLang)
  const termId = await ensureTerm(term, lang)
  const db = adminClient()
  const { data: existing } = await db.from('vocab_stories').select('story').eq('term_id', termId).eq('ui_lang', uiLang)
  if ((existing?.length ?? 0) >= CAPS.stories) return { capped: true, termId }
  await assertDailyText(userId)
  const avoid = (existing ?? []).map((r) => String(r.story).split('\n').find((l) => l.trim()) ?? '').map((l) => l.slice(0, 90))
  const { provider, key } = await pickProvider(userId, ['gemini', 'openai'])
  const story = await storyForTerm(provider, key, term, uiLang, avoid)
  if (!story) throw new AiError('empty_story', 502, 'provider_error')
  const { data, error } = await db.from('vocab_stories').insert({ term_id: termId, ui_lang: uiLang, story, provider, created_by: userId })
    .select('id, ui_lang, story, created_at').single()
  if (error) throw new AiError(`insert_failed: ${error.message}`, 500, 'db_error')
  return { termId, story: data }
}

/** Exemplos editáveis enviados pelo usuário: ignora os com dados pessoais, tamanho inválido ou repetidos. */
export async function sharedExamples(userId: string, b: Body) {
  const term = validateTerm(b.text)
  const lang = normalizeLang(b.lang)
  const raw = Array.isArray(b.examples) ? (b.examples as unknown[]).map((s) => String(s).replace(/\s+/g, ' ').trim()) : []
  const clean = raw.filter((s) => s.length >= 3 && s.length <= 300 && !hasPersonalData(s)).slice(0, 10)
  const rejected = raw.length - clean.length
  if (!clean.length) return { added: 0, rejected }
  const termId = await ensureTerm(term, lang)
  const db = adminClient()
  const { count } = await db.from('vocab_examples').select('id', { count: 'exact', head: true }).eq('term_id', termId)
  const room = Math.max(0, CAPS.examples - (count ?? 0))
  if (!room) return { added: 0, rejected, capped: true }
  if ((await countSince('vocab_examples', userId)) >= DAILY.examples) throw new AiError('daily_limit', 429, 'daily_limit')
  const seen = new Set<string>()
  const rows = clean
    .map((sentence) => ({ term_id: termId, sentence, sentence_norm: sentence.toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, '').trim(), created_by: userId }))
    .filter((r) => r.sentence_norm && !seen.has(r.sentence_norm) && seen.add(r.sentence_norm))
    .slice(0, room)
  const { data, error } = await db.from('vocab_examples').upsert(rows, { onConflict: 'term_id,sentence_norm', ignoreDuplicates: true }).select('id')
  if (error) throw new AiError(`insert_failed: ${error.message}`, 500, 'db_error')
  return { added: data?.length ?? 0, rejected }
}

const IMAGE_CONCEPTS = [
  'a clear, literal everyday scene that shows the meaning',
  'a memorable visual metaphor that helps remember the meaning',
  'a workplace or business situation where the term is used',
  'a playful cartoon mnemonic with exaggerated, funny details',
  'a minimalist icon-like composition with one strong symbol',
  'a before-and-after split scene that contrasts the meaning',
  'a cozy hand-drawn storybook scene',
  'a bold paper-cut collage style association',
]

/** Gera um mosaico de HQ (quadrado, qualidade baixa) com usos do termo e salva no Storage + galeria do termo. */
export async function sharedImages(userId: string, b: Body) {
  const term = validateTerm(b.text)
  const lang = normalizeLang(b.lang)
  const termId = await ensureTerm(term, lang)
  const db = adminClient()
  const { count } = await db.from('vocab_images').select('id', { count: 'exact', head: true }).eq('term_id', termId)
  const have = count ?? 0
  const room = Math.min(IMAGES_PER_CLICK, CAPS.images - have)
  if (room <= 0) return { capped: true, termId, images: [] }
  const today = await countSince('vocab_images', userId)
  if (today >= DAILY.images) throw new AiError('daily_limit', 429, 'daily_limit')
  const n = Math.min(room, DAILY.images - today)

  // Uma definição já existente ajuda a desambiguar o termo sem gastar outra chamada.
  const { data: ex } = await db.from('vocab_explanations').select('definition').eq('term_id', termId).order('ui_lang').limit(1)
  const meaning = String(ex?.[0]?.definition ?? '').slice(0, 300)
  const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
  const langName = LANG_NAMES[lang] ?? 'English'

  const jobs = Array.from({ length: n }, (_, i) => IMAGE_CONCEPTS[(have + i) % IMAGE_CONCEPTS.length]).map(async (concept) => {
    // Mosaico de HQ (padrão do sistema, igual para toda a comunidade): 4 quadros com usos diferentes.
    const prompt = `Square comic-strip mosaic for language learners studying the ${langName} term "${term}"${meaning ? ` (meaning: ${meaning})` : ''}.
Layout: a 2x2 grid of four equal panels separated by clean white gutters, each panel with a thin black border.
Each panel shows a DIFFERENT real-life situation where someone uses or experiences "${term}" (for example: at home, at work, outdoors, with friends), so together they illustrate the range of its meaning. Variation for this mosaic: ${concept}.
Style: minimalist comic illustration — clean confident black ink outlines, flat colors from a limited soft palette (cream, sky blue, coral, mustard, sage), simple backgrounds, expressive simple faces, no gradients or photorealism.
Strictly no text, letters, speech balloons, captions or words anywhere. No real or famous people, no logos or brands, nothing violent or adult.`
    const img = await generateImage(provider, key, prompt, [], { square: true, quality: 'low' })
    if (img.bytes.length > 5_000_000) throw new AiError('image_too_large', 413, 'image_too_large')
    const ext = img.mime === 'image/png' ? 'png' : img.mime === 'image/webp' ? 'webp' : 'jpg'
    const path = `${termId}/${crypto.randomUUID()}.${ext}`
    const up = await db.storage.from('vocab-images').upload(path, img.bytes, { contentType: img.mime, upsert: false })
    if (up.error) throw new AiError(`upload_failed: ${up.error.message}`, 500, 'storage_error')
    const { data, error } = await db.from('vocab_images').insert({
      term_id: termId, storage_path: path, mime: img.mime, bytes: img.bytes.length, concept, provider, created_by: userId,
    }).select('id, storage_path, mime, concept, star_count, created_at').single()
    if (error) { await db.storage.from('vocab-images').remove([path]); throw new AiError(`insert_failed: ${error.message}`, 500, 'db_error') }
    return data
  })
  const settled = await Promise.allSettled(jobs)
  const images = settled.flatMap((s) => (s.status === 'fulfilled' ? [s.value] : []))
  if (!images.length) {
    const first = settled.find((s) => s.status === 'rejected') as PromiseRejectedResult | undefined
    throw first?.reason instanceof AiError ? first.reason : new AiError(String(first?.reason ?? 'image_failed'))
  }
  return { termId, images }
}
