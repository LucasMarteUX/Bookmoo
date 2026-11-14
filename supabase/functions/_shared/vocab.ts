// Banco compartilhado de vocabulário: tudo que a IA gera para um termo (explicação, história,
// exemplos, imagens) fica salvo para todos os usuários. Só a Edge Function escreve (service role);
// o navegador lê direto das tabelas via RLS. Aqui também ficam a moderação mínima e os limites.
import { adminClient } from './tts.ts'
import { AiError, generateImage, llmJson, llmText, pickProvider, type Provider } from './ai.ts'
import { metered, type Entitlements } from './billing.ts'

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
export type Explanation = { definition: string; ipa: string; examples: string[]; grammarExamples: GrammarExample[]; usageNote: string; definitionTranslation?: string; usageNoteTranslation?: string; story?: string; storyTranslation?: string }

export async function explainTerm(provider: Provider, key: string, text: string, level: string, languageCode: string, avoid: string[] = [], nativeCode?: string): Promise<Explanation> {
  const langName = LANG_NAMES[languageCode] ?? 'English'
  const nativeName = nativeCode && nativeCode !== languageCode ? LANG_NAMES[nativeCode] ?? null : null
  const avoidHint = avoid.length
    ? `\nOther learners already saw explanations using these contexts; choose DIFFERENT contexts and different example sentences: ${avoid.slice(0, 12).join(' | ').slice(0, 800)}\n`
    : ''
  const native = nativeName ?? 'Portuguese'
  const r = await llmJson<Record<string, unknown>>(provider, key, {
    system: `You are a friendly ${langName} teacher for language learners. You answer with JSON only.`,
    prompt: `Teach the ${langName} word or expression "${text}" to a learner (level ${level}). Be concise and accurate.
${avoidHint}
Return:
- "definition": a simple definition in ${langName} (1-2 sentences).
- "ipa": an intuitive phonetic spelling (e.g., AP-uhl for apple), not IPA.
- "usageNote": one or two sentences in ${langName} specific to THIS word: its part of speech, typical position in a sentence, common prepositions or collocations, register, or a frequent learner mistake. Never describe generic auxiliary or word-order rules (do/does, will, inversion) unless the word itself is that auxiliary. If there is nothing specific and useful, use an empty string.
- "examples": exactly 3 short example sentences in ${langName}.
- "grammarExamples": exactly 3 items with forms affirmative, negative and interrogative, each in a distinct everyday context, with the sentence in ${langName} (term wrapped in **) and a fluent ${native} translation in "portuguese".
- "story": a short story in ${langName} (first line is a one-sentence title, then 80-130 words) in a fresh everyday situation, using the term naturally at least three times.
${nativeName ? `- "definitionTranslation", "usageNoteTranslation" and "storyTranslation": fluent ${nativeName} translations of the definition, the usage note (empty when it is empty) and the whole story (keep the target term in ${langName}).\n` : ''}Never include real people's names, e-mails, phone numbers or URLs.

Return JSON only with this exact shape:
{"definition": string, "ipa": string, "usageNote": string, "examples": [string, string, string], "grammarExamples": [{"form": "affirmative"|"negative"|"interrogative", "context": string, "english": string, "portuguese": string}], "story": string${nativeName ? ', "definitionTranslation": string, "usageNoteTranslation": string, "storyTranslation": string' : ''}}`,
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
    definitionTranslation: nativeName ? scrub(String(r.definitionTranslation ?? ''), 1500) : undefined,
    usageNoteTranslation: nativeName ? scrub(String(r.usageNoteTranslation ?? ''), 800) : undefined,
    story: scrub(String(r.story ?? ''), 2000),
    storyTranslation: nativeName ? scrub(String(r.storyTranslation ?? ''), 2500) : undefined,
  }
}

/** Tradução curta do termo, em poucas palavras, para revelar no cartão. */
export async function glossTerm(provider: Provider, key: string, text: string, languageCode: string): Promise<string> {
  const langName = LANG_NAMES[languageCode] ?? 'Portuguese'
  const out = await llmText(provider, key, {
    system: `You translate English expressions into ${langName} for language learners. Reply with only the short translation, no quotes and no explanation.`,
    prompt: `Translate this English word or expression into ${langName} in a few words: "${text.slice(0, 120)}"`,
  })
  return scrub(out, 160)
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

export async function sharedExplain(userId: string, b: Body, ent?: Entitlements) {
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
  const { e, provider } = await metered(userId, 'vocab-explain', async () => {
    const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
    return { e: await explainTerm(provider, key, term, level, uiLang, avoid), provider }
  }, { plan: ent?.plan, ref: term })
  const { data, error } = await db.from('vocab_explanations').insert({
    term_id: termId, ui_lang: uiLang, definition: e.definition, pronunciation: e.ipa, examples: e.examples,
    grammar_examples: e.grammarExamples, usage_note: e.usageNote, provider, created_by: userId,
  }).select(EXPL_COLS).single()
  if (error) throw new AiError(`insert_failed: ${error.message}`, 500, 'db_error')
  return { termId, explanation: data }
}

export async function sharedStory(userId: string, b: Body, ent?: Entitlements) {
  const term = validateTerm(b.text)
  const lang = normalizeLang(b.lang)
  const uiLang = uiLangOf(b.uiLang)
  const termId = await ensureTerm(term, lang)
  const db = adminClient()
  const { data: existing } = await db.from('vocab_stories').select('story').eq('term_id', termId).eq('ui_lang', uiLang)
  if ((existing?.length ?? 0) >= CAPS.stories) return { capped: true, termId }
  await assertDailyText(userId)
  const avoid = (existing ?? []).map((r) => String(r.story).split('\n').find((l) => l.trim()) ?? '').map((l) => l.slice(0, 90))
  const { story, provider } = await metered(userId, 'vocab-story', async () => {
    const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
    const story = await storyForTerm(provider, key, term, uiLang, avoid)
    if (!story) throw new AiError('empty_story', 502, 'provider_error')
    return { story, provider }
  }, { plan: ent?.plan, ref: term })
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
  'at home, a quiet everyday moment',
  'at work or school, in the middle of the task',
  'outdoors, in a park, street or on a trip',
  'with friends, sharing the moment around a table',
]

/** Gera um mosaico de HQ (quadrado, qualidade baixa) com usos do termo e salva no Storage + galeria do termo. */
export async function sharedImages(userId: string, b: Body, ent?: Entitlements) {
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
    const prompt = `Square mosaic for language learners studying the ${langName} term "${term}"${meaning ? ` (meaning: ${meaning})` : ''}.
Layout: a 2x2 grid of four equal panels, separated by thin clean gutters. Each panel is one complete scene.
Each panel shows a DIFFERENT real-life situation where someone uses or experiences "${term}", so the four scenes together show the range of its meaning. Emphasize this setting in one of the panels: ${concept}. The other three stay clearly different (home, work or school, outdoors, with friends).
Style: high-quality Pixar-style 3D animated characters. Expressive large eyes, charming facial features, soft rounded shapes, stylized proportions, detailed textures, vibrant yet harmonious colors, cinematic lighting, soft shadows, subtle subsurface scattering, global illumination, beautiful depth of field, polished 3D rendering, warm atmosphere, professional animated feature film quality. Keep each character recognizable within their own panel.
Strictly no text, letters, speech balloons, captions, watermarks or words anywhere. No real or famous people, no logos or brands, nothing violent or adult.`
    // Grátis: até N mosaicos por mês (teto do plano); pagos: 1 crédito cada.
    const img = await metered(userId, 'vocab-image', () => generateImage(provider, key, prompt, [], { square: true, quality: 'low' }),
      { plan: ent?.plan, ref: term, capField: ent?.limits.mosaic != null ? 'mosaic' : undefined, cap: ent?.is_admin ? null : ent?.limits.mosaic ?? null })
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
