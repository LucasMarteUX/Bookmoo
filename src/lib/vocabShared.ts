// Banco compartilhado de vocabulário. Leitura direta das tabelas (RLS: só usuários logados);
// geração e escrita passam pela Edge Function ai-text, que salva o resultado para todos.
import { supabase } from "@/lib/supabase"
import { AiRequestError } from "@/lib/ai"
import type { GrammarExample } from "@/store/useVocabularyStore"

export interface SharedExplanation {
  id: string
  definition: string
  pronunciation: string
  examples: string[]
  grammarExamples: GrammarExample[]
  usageNote: string
}
export interface SharedStory { id: string; story: string }
export interface SharedImage { id: string; path: string; concept: string; stars: number; createdAt: string; url?: string }
export interface SharedVocab {
  termId: string | null
  explanations: SharedExplanation[]
  stories: SharedStory[]
  examples: string[]
  images: SharedImage[]
}

export const EMPTY_SHARED: SharedVocab = { termId: null, explanations: [], stories: [], examples: [], images: [] }

/** Mesma normalização da Edge Function (_shared/vocab.ts). */
export function normalizeTerm(raw: string): string {
  return raw
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s"'“”«»().,;:!?¿¡\-–—]+|[\s"“”«»().,;:!?¿¡\-–—]+$/g, "")
}

export const normalizeLang = (raw?: string) => {
  const l = (raw || "en").slice(0, 2).toLowerCase()
  return /^[a-z]{2}$/.test(l) ? l : "en"
}

type ExplRow = { id: string; definition: string; pronunciation: string; examples: unknown; grammar_examples: unknown; usage_note: string }
type ImgRow = { id: string; storage_path: string; concept: string; star_count: number; created_at: string }

export const toExplanation = (r: ExplRow): SharedExplanation => ({
  id: r.id,
  definition: r.definition,
  pronunciation: r.pronunciation,
  examples: Array.isArray(r.examples) ? r.examples.map(String) : [],
  grammarExamples: Array.isArray(r.grammar_examples) ? (r.grammar_examples as GrammarExample[]) : [],
  usageNote: r.usage_note ?? "",
})
const toImage = (r: ImgRow): SharedImage => ({ id: r.id, path: r.storage_path, concept: r.concept, stars: r.star_count, createdAt: r.created_at })

export function sortImages(images: SharedImage[]) {
  return [...images].sort((a, b) => b.stars - a.stars || b.createdAt.localeCompare(a.createdAt))
}

/** Tudo que já existe para o termo — nenhuma chamada de IA. */
export async function fetchSharedVocab(text: string, lang: string, uiLang: "pt" | "en"): Promise<SharedVocab> {
  const term = normalizeTerm(text)
  if (!supabase || !term) return EMPTY_SHARED
  const { data: t } = await supabase.from("vocab_terms").select("id").eq("term_norm", term).eq("lang", normalizeLang(lang)).maybeSingle()
  if (!t) return EMPTY_SHARED
  const termId = t.id as string
  const [ex, st, eg, im] = await Promise.all([
    supabase.from("vocab_explanations").select("id, definition, pronunciation, examples, grammar_examples, usage_note").eq("term_id", termId).eq("ui_lang", uiLang).order("created_at"),
    supabase.from("vocab_stories").select("id, story").eq("term_id", termId).eq("ui_lang", uiLang).order("created_at"),
    supabase.from("vocab_examples").select("sentence").eq("term_id", termId).order("created_at").limit(40),
    supabase.from("vocab_images").select("id, storage_path, concept, star_count, created_at").eq("term_id", termId).order("star_count", { ascending: false }).order("created_at", { ascending: false }).limit(48),
  ])
  return {
    termId,
    explanations: ((ex.data ?? []) as ExplRow[]).map(toExplanation),
    stories: (st.data ?? []) as SharedStory[],
    examples: (eg.data ?? []).map((r) => String(r.sentence)),
    images: ((im.data ?? []) as ImgRow[]).map(toImage),
  }
}

/** URLs assinadas (bucket privado, leitura para logados). */
export async function signImageUrls(images: SharedImage[]): Promise<SharedImage[]> {
  const missing = images.filter((i) => !i.url)
  if (!supabase || !missing.length) return images
  const { data } = await supabase.storage.from("vocab-images").createSignedUrls(missing.map((i) => i.path), 60 * 60)
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
  return images.map((i) => (i.url ? i : { ...i, url: byPath.get(i.path) ?? undefined }))
}

export async function fetchMyStars(imageIds: string[]): Promise<Set<string>> {
  if (!supabase || !imageIds.length) return new Set()
  const { data } = await supabase.from("vocab_image_stars").select("image_id").in("image_id", imageIds)
  return new Set((data ?? []).map((r) => String(r.image_id)))
}

export async function setStar(imageId: string, on: boolean) {
  if (!supabase) return
  const q = on
    ? supabase.from("vocab_image_stars").insert({ image_id: imageId })
    : supabase.from("vocab_image_stars").delete().eq("image_id", imageId)
  const { error } = await q
  if (error && error.code !== "23505") throw error
}

// ---------------------------------------------------------------------------
// Geração (Edge Function ai-text)
// ---------------------------------------------------------------------------
async function invoke<T>(action: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new AiRequestError("supabase_not_configured")
  const { data, error } = await supabase.functions.invoke("ai-text", { body: { action, ...body } })
  if (error) {
    let code = "request_failed"
    let detail = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === "function") {
      const j = (await ctx.json().catch(() => null)) as { error?: string; detail?: string } | null
      if (j?.error) code = j.error
      if (j?.detail) detail = j.detail
    }
    throw new AiRequestError(code, detail)
  }
  return data as T
}

type Ctx = { text: string; lang: string; uiLang: "pt" | "en" }

export async function generateSharedExplanation(c: Ctx): Promise<SharedExplanation | null> {
  const r = await invoke<{ capped?: boolean; explanation?: ExplRow }>("vocab-explain", { ...c, lang: normalizeLang(c.lang), level: "B1" })
  return r.explanation ? toExplanation(r.explanation) : null
}

export async function generateSharedStory(c: Ctx): Promise<SharedStory | null> {
  const r = await invoke<{ capped?: boolean; story?: SharedStory }>("vocab-story", { ...c, lang: normalizeLang(c.lang) })
  return r.story ?? null
}

export async function shareExamples(text: string, lang: string, examples: string[]) {
  if (!examples.length) return
  await invoke("vocab-examples", { text, lang: normalizeLang(lang), examples })
}

export async function generateSharedImages(text: string, lang: string): Promise<{ images: SharedImage[]; capped: boolean }> {
  const r = await invoke<{ capped?: boolean; images?: ImgRow[] }>("vocab-images", { text, lang: normalizeLang(lang) })
  return { images: (r.images ?? []).map(toImage), capped: !!r.capped }
}
