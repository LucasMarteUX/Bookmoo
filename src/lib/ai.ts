// Cliente das funções de IA. Nenhuma chave existe no navegador: cada chamada vai para uma
// Edge Function do Supabase, que usa a chave que o próprio usuário conectou em Configurações.
import type { ComicStyleDoc, ComicCharacter } from "@/store/useBookStore"
import type { ComicInspection, EditorialLayout, GenerationRecord, Rect, StoryContext, VisualBeat } from '../../supabase/functions/_shared/comicEditorial'
import { supabase } from "@/lib/supabase"

export const API_KEY_REQUIRED_MESSAGE =
  "Conecte sua chave de IA (OpenAI ou Gemini) em Configurações para usar esta função."

/** Erro de IA com código estável (ex.: 'no_api_key', 'invalid_key', 'quota'). */
export class AiRequestError extends Error {
  constructor(public code: string, message?: string) { super(message ?? code) }
}

export function isNoApiKeyError(e: unknown) {
  return e instanceof AiRequestError && e.code === "no_api_key"
}

/** Mensagem amigável para os erros mais comuns. */
export function aiErrorMessage(e: unknown): string {
  const code = e instanceof AiRequestError ? e.code : ""
  if (code === "no_api_key") return API_KEY_REQUIRED_MESSAGE
  if (code === "invalid_key") return "Sua chave de IA foi recusada pelo provedor. Atualize-a em Configurações."
  if (code === "quota") return "Sua conta no provedor de IA está sem créditos ou atingiu o limite. Verifique o painel do provedor."
  if (code === "blocked") return "O provedor de IA recusou este conteúdo."
  if (code === "comic_panel_key") return "Conecte sua chave OpenAI para regenerar um quadro individual."
  if (code === "book_not_found") return "O livro precisa estar sincronizado com sua conta para gerar quadrinhos."
  if (code === "comic_reference_key") return "Conecte sua chave OpenAI para gerar quadrinhos com referências visuais."
  if (code === "comic_reference_failed") return "Uma referência visual está inacessível. Verifique os arquivos nas configurações do livro."
  if (code === "comic_engine_outdated") return "O motor novo de quadrinhos ainda não está ativo no servidor. A geração foi interrompida antes de criar outra imagem no estilo antigo."
  if (code === "comic_bible_invalid") return "Não foi possível concluir a direção de arte. Confira a descrição do livro e tente novamente."
  if (code === "comic_response_invalid") return "O servidor devolveu um quadrinho incompleto. Tente gerar novamente."
  if (code === "comic_plan_invalid") return "O roteiro não passou na conferência do texto original. Tente gerar a página novamente."
  if (code === "comic_art_style") return "A arte ficou realista demais para o estilo ilustrado. Gere a página novamente."
  if (code === "comic_art_invalid") return "A arte não passou na conferência de estilo, quadros ou lettering. Tente gerar a página novamente."
  if (code === "comic_save_conflict") return "Este livro foi alterado em outra sessão. Confira a versão atual antes de tentar novamente."
  if (code === "comic_lettering_failed") return "O texto não coube na composição sem cobrir a arte. Tente gerar a página novamente."
  return "Não foi possível concluir a solicitação de IA. Tente novamente."
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new AiRequestError("supabase_not_configured")
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    let code = "request_failed"
    let detail = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === "function") {
      const j = await ctx.json().catch(() => null) as { error?: string; detail?: string } | null
      if (j?.error) code = j.error
      if (j?.detail) detail = j.detail
    }
    throw new AiRequestError(code, detail)
  }
  return data as T
}

const aiText = <T,>(action: string, payload: Record<string, unknown>) => invoke<T>("ai-text", { action, ...payload })

// ---------------------------------------------------------------------------
// Vocabulário
// ---------------------------------------------------------------------------
export interface VocabExplanation {
  definition: string
  ipa: string
  examples: string[]
  grammarExamples: {
    form: "affirmative" | "negative" | "interrogative"
    context: string
    english: string
    portuguese: string
  }[]
  usageNote: string
}

/** targetLanguageCode: ISO 639-1 (e.g. en, pt). Explanation and examples will be in this language. */
export async function generateExplanation(
  text: string,
  level: "A2" | "B1" | "B2" = "B1",
  targetLanguageCode?: string
): Promise<VocabExplanation> {
  try {
    return await aiText<VocabExplanation>("explain", { text, level, languageCode: targetLanguageCode || "en" })
  } catch (e) {
    return { definition: aiErrorMessage(e), ipa: "", examples: [], grammarExamples: [], usageNote: "" }
  }
}

export async function generateVariantStory(text: string, targetLanguageCode?: string): Promise<string | null> {
  if (!text.trim()) return null
  const r = await aiText<{ story: string }>("variant-story", { text, languageCode: targetLanguageCode })
  return r.story || null
}

// ---------------------------------------------------------------------------
// Quadrinhos
// ---------------------------------------------------------------------------
/** Referências visuais via busca (só com Gemini conectado). Vazio em caso de falha. */
export async function enrichComicPromptWithSearch(bookTitle: string, bookContext: string, pageText: string): Promise<string> {
  try {
    const r = await aiText<{ text: string }>("search-context", { bookTitle, bookContext, pageText })
    return r.text ?? ""
  } catch {
    return ""
  }
}

export async function detectNewCharactersInPageText(pageText: string, existingCharacters: ComicCharacter[]): Promise<ComicCharacter[]> {
  try {
    const r = await aiText<{ characters: ComicCharacter[] }>("detect-characters", {
      pageText,
      existingNames: existingCharacters.map((c) => c.name),
    })
    return r.characters ?? []
  } catch {
    return []
  }
}

export interface ExtractComicResult {
  styleDoc: ComicStyleDoc
  characters: ComicCharacter[]
}

/** Analisa a primeira página para documentar estilo e personagens (consistência das próximas). */
export async function extractComicStyleAndCharacters(imageBase64: string, pageText?: string): Promise<ExtractComicResult | null> {
  try {
    return await aiText<ExtractComicResult>("style-extract", { imageDataUrl: `data:image/jpeg;base64,${imageBase64}`, pageText })
  } catch {
    return null
  }
}

export interface GenerateComicOptions {
  bookId: string
  page: number
  /** Texto EXATO da página (as posições dos balões são relativas a ele). */
  pageText: string
  bookTitle: string
  bookContext: string
  /** Até 2 imagens base64 (jpeg): [primeira página (estilo), página anterior]. */
  referenceImages?: string[]
  comicStyleDoc?: ComicStyleDoc
  comicCharacters?: ComicCharacter[]
  searchContext?: string
  languageCode?: string
  replan?: string
  priorContext?: string
}

export type ComicSegment = { charStart: number; charEnd: number; kind: "speech" | "caption" }
/** Quadro da página (0–1, relativo à imagem) com o trecho de texto da legenda. */
export type ComicPanel = ComicSegment & { x: number; y: number; w: number; h: number; anchor?: 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'bc' }
/** v2: grade de quadros + legendas desenhadas pelo app. (v1 antigo: balões detectados por IA.) */
export type ComicLayout = EditorialLayout | { v: 2; grid: number[]; panels: ComicPanel[]; detected?: boolean } | { v: 1; balloons: unknown[] }

export interface GeneratedComicPage {
  imageUrl: string
  grid: number[]
  /** Diagramação com proporções (alturas das linhas e larguras dos quadros). */
  rows?: { h: number; cols: number[]; rightStack?: true }[]
  /** Canto livre pedido ao modelo para a legenda de cada quadro. */
  corners?: string[]
  panels: ComicSegment[]
  /** Guia de estilo criado na primeira página (salvar no livro para as próximas). */
  styleDoc?: ComicStyleDoc
  beats: VisualBeat[]
  context: StoryContext
  editorialIssues?: string[]
  generation: GenerationRecord
  characters: ComicCharacter[]
  previousCharacters: ComicCharacter[]
  previousStyleRevision: string | null
}

export function inspectComicPage(generated: Pick<GeneratedComicPage, 'imageUrl' | 'generation' | 'beats' | 'characters'>, aspect: number, measuredBounds?: Rect[]) {
  return invoke<ComicInspection>('comic-layout', {
    action: 'inspect', imageUrl: generated.imageUrl, aspect, style: generated.generation.style,
    composition: generated.generation.composition, measuredBounds,
    referenceIds: generated.generation.references.map(reference => reference.id),
    expected: generated.beats.map(beat => ({
      panelId: beat.id,
      action: beat.action,
      period: beat.period,
      setting: beat.setting,
      expression: beat.expression,
      speakers: [...new Set(beat.dialogue.flatMap(line => line.speakerId && line.attribution === 'confirmed' ? [line.speakerId] : []))],
      cast: generated.characters.filter(c => c.id && beat.cast.includes(c.id)),
    })),
  })
}

export function regenerateComicPanel(options: { bookId: string; page: number; panelId: string; mask: string; editRevision?: string }) {
  return invoke<{ imageUrl: string; generation: GenerationRecord }>('comic-generate', options)
}

/** Gera a página (grade de quadros, sem texto na imagem) e devolve os trechos de cada quadro. */
export async function prepareComicArt(bookId: string): Promise<ComicStyleDoc> {
  // Probe both endpoints without book content. Older functions reject this
  // request before contacting the image provider.
  await Promise.all(['comic-generate', 'comic-layout'].map(async fn => {
    const status = await invoke<{ editorialVersion?: number }>(fn, { action: 'editorial-version' }).catch(error => {
      if (error instanceof AiRequestError && ['invalid_image_url', 'invalid_page_text', 'invalid_target'].includes(error.code)) {
        throw new AiRequestError('comic_engine_outdated')
      }
      throw error
    })
    if (status?.editorialVersion !== 3) throw new AiRequestError('comic_engine_outdated')
  }))
  const { styleDoc } = await invoke<{ styleDoc: ComicStyleDoc }>('comic-generate', { action: 'prepare-art', bookId })
  if (!styleDoc?.revision) throw new AiRequestError('comic_response_invalid')
  return styleDoc
}

export async function generateComicPage(options: GenerateComicOptions): Promise<GeneratedComicPage> {
  const data = await invoke<GeneratedComicPage>('comic-generate', options as unknown as Record<string, unknown>)
  if (!data?.imageUrl || !data.generation?.style || !Array.isArray(data.beats) || !Array.isArray(data.characters)) {
    throw new AiRequestError('comic_response_invalid')
  }
  return data
}

// ---------------------------------------------------------------------------
// Transcrição de página (foto → texto)
// ---------------------------------------------------------------------------
export async function transcribePageWithAi(imageDataUrl: string, languageCode?: string): Promise<string> {
  const r = await aiText<{ text: string }>("transcribe-page", { imageDataUrl, languageCode })
  return r.text
}
