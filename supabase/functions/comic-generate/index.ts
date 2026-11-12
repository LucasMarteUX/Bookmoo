import { adminClient, corsHeaders, getUser, json, log } from '../_shared/tts.ts'
import { AiError, generateImage, llmJson, pickProvider, type ImageReference } from '../_shared/ai.ts'
import { sentenceSpans } from '../_shared/comic.ts'
import { fullComicText } from '../_shared/comicText.ts'
import {
  STYLE_FIELDS, cleanText,
  type Character, type EditorialLayout, type GenerationRecord, type StyleDocument,
} from '../_shared/comicEditorial.ts'
import { briefFingerprint, researchArtBible } from './artBible.ts'
import { readyStyles, styleForCategory, stylePrompt, styleSample } from '../_shared/styleBank.ts'
import { imagePrompt } from './imagePrompt.ts'
import { loadReferences } from './references.ts'
import { composeRows, planPrompt, resolvePlan, type ModelPlan } from './storyboard.ts'

const BUCKET = 'comic-pages'

type Body = {
  action?: string; bookId?: string; page?: number; pageText?: string; bookContext?: string
  referenceImages?: string[]; replan?: string; priorContext?: string; panelId?: string; mask?: string; editRevision?: string
}

async function uploadImage(sb: ReturnType<typeof adminClient>, userId: string, bookId: string, page: number, id: string,
  img: Awaited<ReturnType<typeof generateImage>>) {
  const ext = img.mime === 'image/png' ? 'png' : img.mime === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${bookId}/${page}-${id}.${ext}`
  const storage = sb.storage.from(BUCKET)
  const { error } = await storage.upload(path, img.bytes, { contentType: img.mime })
  if (error) throw new AiError('Could not save comic image', 500, 'upload_failed')
  return storage.getPublicUrl(path).data.publicUrl
}

async function editPanel(sb: ReturnType<typeof adminClient>, userId: string, bookId: string, page: number, b: Body,
  layout: EditorialLayout, baseImageUrl: string | undefined, cast: Character[]) {
  const beat = layout.beats.find(beat => beat.id === b.panelId)
  const panel = layout.panels.find(panel => panel.panelId === b.panelId)
  const source = panel?.replacement?.imageUrl ?? baseImageUrl
  const prefix = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/${BUCKET}/`
  const path = typeof source === 'string' && source.startsWith(prefix) ? source.slice(prefix.length) : ''
  const folder = `${userId}/${bookId}/`
  const mask = b.mask ?? ''
  if (!beat || !panel || layout.editRevision !== b.editRevision || !path.startsWith(folder)
    || !/^\d+-[\da-f-]+\.(jpg|png|webp)$/i.test(path.slice(folder.length))
    || typeof mask !== 'string' || mask.length > 500_000 || !/^[a-z0-9+/]+={0,2}$/i.test(mask)) {
    throw new AiError('Invalid or outdated panel edit', 400, 'invalid_target')
  }
  const { data, error } = await sb.storage.from(BUCKET).download(path)
  if (error || !data || data.size > 12 * 1024 * 1024) throw new AiError('Could not read the source artwork', 502, 'image_fetch_failed')
  const { key } = await pickProvider(userId, ['openai']).catch((e) => {
    if (e instanceof AiError && e.code === 'no_api_key') throw new AiError('Panel editing requires OpenAI', 412, 'comic_panel_key')
    throw e
  })
  const { dialogue: _planned, reservation: _reservation, ...direction } = beat
  const quietAreas = [...new Set(layout.balloons.filter(line => line.panelId === beat.id)
    .map(line => line.preferredPosition.replace('-', ' ')))]
  const { fonts: _fonts, lettering: _lettering, ...artStyle } = layout.generation.style
  const img = await generateImage('openai', key,
    `Redraw ONLY the area inside the transparent mask of this full comic page. It corresponds to panel ${beat.id}, at normalized bounds ${JSON.stringify(panel.bounds)}.
Preserve panel boundaries, gutters, the entire original page geometry and the visual identity of surrounding art. Make a fresh interpretation of the same action with the same people, costumes, place and historical period. Maintain the original technique, palette and stylization.
Art direction: ${JSON.stringify(artStyle).slice(0, 5200)}
Story context: ${JSON.stringify(layout.context).slice(0, 2800)}
Beat: ${JSON.stringify(direction)}
Cast: ${JSON.stringify(cast.filter(c => c.id && beat.cast.includes(c.id))).slice(0, 4000)}
Keep these regions visually quiet with fully painted background scenery: ${quietAreas.join(', ')}. No cutouts or empty white shapes.
Return a full portrait page with the exact same framing and no text, lettering or balloons.`,
    [{ mime: data.type, blob: data }], new Blob([Uint8Array.from(atob(mask), c => c.charCodeAt(0))], { type: 'image/png' }),
  )
  const generation: GenerationRecord = {
    ...layout.generation, id: crypto.randomUUID(), createdAt: new Date().toISOString(), provider: 'openai',
    references: [], panelId: beat.id,
  }
  const imageUrl = await uploadImage(sb, userId, bookId, page, generation.id, img)
  return { generation: { ...generation, imageUrl }, imageUrl }
}

const CONTINUITY_PAGES = 2

async function loadContinuity(sb: ReturnType<typeof adminClient>, userId: string, bookId: string, page: number,
  pages: Record<string, string>, layouts: Record<string, EditorialLayout> = {}, styleId?: string | null): Promise<ImageReference[]> {
  const prefix = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/${BUCKET}/`
  const folder = `${userId}/${bookId}/`
  const candidates = Object.entries(pages)
    .map(([key, url]) => ({ index: Number(key), path: typeof url === 'string' && url.startsWith(prefix) ? url.slice(prefix.length) : '' }))
    .filter(c => Number.isInteger(c.index) && c.index !== page && c.path.startsWith(folder))
    // Com estilo do banco, só páginas desenhadas nesse mesmo estilo: uma página no visual antigo
    // como continuidade fazia a nova sair igual a ela.
    .filter(c => !styleId || layouts[String(c.index)]?.generation?.styleId === styleId)
    // Earlier pages first (closest to this one), then later pages if nothing earlier exists.
    .sort((a, b) => (a.index > page ? 1 : 0) - (b.index > page ? 1 : 0) || Math.abs(a.index - page) - Math.abs(b.index - page))
    .slice(0, CONTINUITY_PAGES)
  const parts = await Promise.all(candidates.map(async ({ path }) => {
    const { data, error } = await sb.storage.from(BUCKET).download(path)
    if (error || !data || data.size > 8 * 1024 * 1024) return null
    return { mime: data.type || 'image/jpeg', blob: data } as ImageReference
  }))
  return parts.filter((part): part is ImageReference => part !== null)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized' }, 401)
  const b = await req.json().catch(() => null) as Body | null
  if (!b) return json({ error: 'invalid_json' }, 400)
  if (b.action === 'editorial-version') return json({ editorialVersion: 3 })
  const bookId = String(b.bookId ?? '')
  const page = Number(b.page)
  const pageText = String(b.pageText ?? '')
  if (!/^[\da-f-]{36}$/i.test(bookId) || (b.action !== 'prepare-art' && b.action !== 'suggest-style' && (!Number.isInteger(b.page) || page < 0 || page > 100000))) return json({ error: 'invalid_target' }, 400)

  try {
    const sb = adminClient()
    const { data: book, error } = await sb.from('books').select(b.panelId
      ? 'title, comic_style_doc, comic_characters, comic_layouts, comic_pages'
      : 'title, author, description, context, comic_style_doc, comic_characters, comic_pages, comic_layouts')
      .eq('id', bookId).eq('user_id', user.id).maybeSingle()
      .overrideTypes<{
        title: string; author?: string | null; description?: string | null; context?: string | null
        comic_style_doc: StyleDocument | null; comic_characters: Character[] | null
        comic_layouts?: Record<string, EditorialLayout>; comic_pages?: Record<string, string>
      }, { merge: false }>()
    if (error) throw new AiError('Could not read book', 500, 'book_read_failed')
    if (!book) return json({ error: 'book_not_found' }, 404)
    const savedStyle = (book.comic_style_doc ?? {}) as StyleDocument
    // Legacy documents were inferred from the old image pipeline. Keep the
    // references, but rebuild art direction unless it has an editorial revision.
    // Sem revisão (livro novo ou estilo trocado): refaz a direção, mantendo referências e o estilo escolhido.
    let style: StyleDocument = savedStyle.revision ? savedStyle : { references: savedStyle.references, styleId: savedStyle.styleId }
    const cast = (Array.isArray(book.comic_characters) ? book.comic_characters : []) as Character[]
    if (b.panelId) {
      const layout = book.comic_layouts?.[page] as EditorialLayout | undefined
      if (layout?.v !== 3) return json({ error: 'invalid_target' }, 400)
      return json(await editPanel(sb, user.id, bookId, page, b, layout, book.comic_pages?.[page], cast))
    }
    if (b.action !== 'prepare-art' && b.action !== 'suggest-style' && (pageText.length > 12000 || !pageText.trim())) return json({ error: 'invalid_page_text' }, 400)
    // Estilo: a escolha da pessoa (styleId no documento); senão o da galeria, definido pela primeira
    // pessoa que gerou; senão categoria e leitura do modelo, só entre estilos com prompt.
    const { data: link } = await sb.from('book_links').select('catalog_id, style_id').eq('book_id', bookId).eq('user_id', user.id).maybeSingle()
    const { data: catalog } = link?.catalog_id
      ? await sb.from('catalog_books').select('category, style_id').eq('id', link.catalog_id).maybeSingle()
      : { data: null }
    const ready = await readyStyles(sb)
    const isReady = (id: unknown) => typeof id === 'string' && ready.some(item => item.id === id)
    const catalogStyle = (catalog as { style_id?: string | null } | null)?.style_id ?? null
    const fixedStyle = isReady(style.styleId) ? style.styleId! : isReady(link?.style_id) ? link!.style_id as string : isReady(catalogStyle) ? catalogStyle : null
    // Sugestão antes da primeira geração (não grava nada): o estilo da comunidade para livros da
    // galeria; para livros enviados pela pessoa, a IA lê o livro e escolhe entre os estilos prontos.
    if (b.action === 'suggest-style') {
      if (isReady(catalogStyle)) return json({ styleId: catalogStyle, source: 'community' })
      const category = (catalog as { category?: string | null } | null)?.category ?? null
      try {
        const textAi = await pickProvider(user.id, ['gemini', 'openai'])
        const about = [cleanText(book.title, 200), cleanText(book.author, 120), cleanText(book.description, 1200),
          cleanText(book.context || b.bookContext, 1200), cleanText(pageText, 1500)].filter(Boolean).join('\n')
        const answer = await llmJson<{ styleId?: unknown; reason?: unknown }>(textAi.provider, textAi.key, {
          prompt: `Choose the illustration style that best fits this book for a reader app. Judge by genre, audience, era and tone (for example: children's tales and fables, epic fantasy, gothic horror, science fiction, romance, detective noir, historical fiction).
Book:
${about}
${category ? `Gallery category: ${category}` : ''}
Styles: ${JSON.stringify(ready.map(item => ({ id: item.id, look: item.look, use: item.use })))}
Return JSON {"styleId": one id from the list, "reason": one short sentence in Portuguese}.`,
        })
        const picked = cleanText(answer.styleId, 40)
        if (isReady(picked)) return json({ styleId: picked, source: 'ai', reason: cleanText(answer.reason, 200) })
      } catch (e) {
        log('comic-generate', 'suggest_style_failed', { reason: e instanceof Error ? e.message : String(e) })
      }
      return json({ styleId: styleForCategory(category, ready) ?? ready[0]?.id ?? null, source: 'category' })
    }
    const brief = { ...book, category: (catalog as { category?: string | null } | null)?.category ?? null, styleId: fixedStyle }
    const fingerprint = await briefFingerprint(brief)
    const imgAi = await pickProvider(user.id, ['openai'])
    if (style.research?.fingerprint !== fingerprint) {
      const researched = await researchArtBible(imgAi.key, brief, style, fingerprint, ready, fixedStyle)
      const update = sb.from('books').update({ comic_style_doc: researched }).eq('id', bookId).eq('user_id', user.id)
      const { data: saved, error: writeError } = await (savedStyle.revision
        ? update.eq('comic_style_doc->>revision', savedStyle.revision)
        : update.is('comic_style_doc->>revision', null)).select('id').maybeSingle()
      if (writeError) throw new AiError('Could not save art direction', 500, 'book_write_failed')
      if (!saved) throw new AiError('Art direction changed while researching', 409, 'comic_save_conflict')
      style = researched
    }
    // A primeira pessoa que gera um livro da galeria define o estilo dele para todo mundo.
    if (link?.catalog_id && style.styleId) {
      if (!catalogStyle) await sb.from('catalog_books').update({ style_id: style.styleId }).eq('id', link.catalog_id).is('style_id', null)
      if (link.style_id !== style.styleId) await sb.from('book_links').update({ style_id: style.styleId }).eq('book_id', bookId).eq('user_id', user.id)
    }
    if (b.action === 'prepare-art') return json({ styleDoc: style })
    const spans = sentenceSpans(pageText)
    if (!spans.length) return json({ error: 'invalid_page_text' }, 400)
    const { references, images } = await loadReferences(sb, user.id, bookId, style)
    const textAi = await pickProvider(user.id, ['gemini', 'openai'])
    const context = [cleanText(book.description, 1800), cleanText(book.context || b.bookContext, 1200)].filter(Boolean).join('\n\n')
    const ask = (feedback?: string) => planPrompt(cleanText(book.title, 200), context,
      style, cast, spans.map(([a, z]) => pageText.slice(a, z)), pageText, feedback, cleanText(b.priorContext, 1500))
    const draft = (feedback?: string) => llmJson<ModelPlan>(textAi.provider, textAi.key, { prompt: ask(feedback) })
    const resolve = (raw: ModelPlan, repair = false) => resolvePlan(raw, style, cast, spans, pageText, page, repair)
    let raw: ModelPlan
    try {
      raw = await draft(cleanText(b.replan, 300))
    } catch (e) {
      if (!(e instanceof AiError) || e.code !== 'invalid_json') throw e
      raw = await draft('Return one valid JSON object in the specified format.')
    }
    let plan
    try {
      plan = resolve(raw)
    } catch (e) {
      if (!(e instanceof AiError) || e.code !== 'comic_plan_invalid') throw e
      log('comic-generate', 'storyboard_repaired', { reason: e.message.split('. Include its full wording:')[0], page })
      plan = resolve(raw, true)
    }
    const lettering = fullComicText(pageText, plan.beats)
    for (const beat of plan.beats) beat.dialogue = lettering.filter(line => line.panelId === beat.id)
    const rows = composeRows(plan.beats)
    // Continuity: the nearest pages already drawn for this book (earlier first) go to the image
    // model as real images, so recurring characters keep the same face, hair and clothing.
    const continuity = await loadContinuity(sb, user.id, bookId, page, book.comic_pages ?? {}, book.comic_layouts ?? {}, plan.style.styleId)
    const bankPrompt = await stylePrompt(sb, plan.style.styleId)
    // A miniatura do estilo vai como primeira imagem: é ela que mostra à IA o visual escolhido
    // (o texto sozinho deixava livros famosos voltarem ao visual das edições conhecidas).
    const sample = bankPrompt ? await styleSample(sb, plan.style.styleId) : null
    const img = await generateImage(imgAi.provider, imgAi.key, imagePrompt(plan, rows, references, continuity.length, b.replan, bankPrompt, !!sample),
      [...(sample ? [sample] : []), ...images, ...continuity])
    const generation: GenerationRecord = {
      id: crypto.randomUUID(), createdAt: new Date().toISOString(), provider: imgAi.provider,
      styleRevision: plan.style.revision!,
      styleId: plan.style.styleId,
      style: Object.fromEntries(STYLE_FIELDS.flatMap(key => plan.style[key] ? [[key, plan.style[key]]] : [])),
      references, composition: rows,
    }
    const imageUrl = await uploadImage(sb, user.id, bookId, page, generation.id, img)
    generation.imageUrl = imageUrl
    return json({
      imageUrl, rows, grid: rows.map(r => r.rightStack ? 3 : r.cols.length), beats: plan.beats,
      context: plan.context, editorialIssues: plan.editorialIssues, characters: plan.cast, styleDoc: plan.style, generation,
      previousCharacters: cast, previousStyleRevision: style.revision ?? null,
      panels: plan.beats.map(beat => ({
        charStart: spans[beat.sourceSentenceIds[0]][0], charEnd: spans[beat.sourceSentenceIds.at(-1)!][1], kind: 'caption',
      })),
    })
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError(String((e as Error)?.message ?? e))
    log('comic-generate', 'error', { code: err.code, msg: err.code === 'comic_plan_invalid' ? 'Storyboard rejected' : err.message.slice(0, 200) })
    return json({ error: err.code, detail: err.message }, err.status)
  }
})
