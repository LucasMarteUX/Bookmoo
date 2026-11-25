import { adminClient, corsHeaders, getUser, json, log } from '../_shared/tts.ts'
import { rateLimit } from '../_shared/rate.ts'
import {
  AiError, generateImageWithRetry, isTransient, llmJson, pickProvider, type ImageProvider, type ImageReference,
} from '../_shared/ai.ts'
import { entitlements, measured, metered, requireFeature } from '../_shared/billing.ts'
import { sentenceSpans } from '../_shared/comic.ts'
import { fullComicText } from '../_shared/comicText.ts'
import {
  STYLE_FIELDS, cleanText,
  type Character, type EditorialLayout, type GenerationRecord, type StyleDocument,
} from '../_shared/comicEditorial.ts'
import { briefFingerprint, researchArtBible } from './artBible.ts'
import { fitStyle, masterStyle, readyStyles, styleForCategory, stylePrompt, styleSample } from '../_shared/styleBank.ts'
import { imagePrompt } from './imagePrompt.ts'
import { loadReferences } from './references.ts'
import { composeRows, planPrompt, resolvePlan, type ModelPlan } from './storyboard.ts'
import { chooseLayout } from '../_shared/comicLayouts.ts'

const BUCKET = 'comic-pages'

type Body = {
  action?: string; bookId?: string; page?: number; pageText?: string; bookContext?: string
  referenceImages?: string[]; replan?: string; priorContext?: string; panelId?: string; mask?: string; editRevision?: string
  /** App novo: gera em segundo plano e devolve só o id do trabalho (o app acompanha pela tabela comic_jobs). */
  job?: boolean
  /** Correção automática de estilo do trabalho indicado: sem nova cobrança. */
  fixOf?: string
}

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

async function uploadImage(sb: ReturnType<typeof adminClient>, userId: string, bookId: string, page: number, id: string,
  img: { bytes: Uint8Array; mime: string }) {
  const ext = img.mime === 'image/png' ? 'png' : img.mime === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${bookId}/${page}-${id}.${ext}`
  const storage = sb.storage.from(BUCKET)
  // A imagem já foi paga ao provedor: uma oscilação do Storage não pode jogá-la fora. Tenta de novo com espera.
  let error: unknown = null
  for (let attempt = 0; attempt < 4; attempt++) {
    ;({ error } = await storage.upload(path, img.bytes, { contentType: img.mime, upsert: true }))
    if (!error) break
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
  }
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
  const { key } = await pickProvider(userId, ['openai'], { strict: true }).catch((e) => {
    if (e instanceof AiError && e.code === 'no_api_key') throw new AiError('Panel editing requires OpenAI', 412, 'comic_panel_key')
    throw e
  })
  const { dialogue: _planned, reservation: _reservation, ...direction } = beat
  const quietAreas = [...new Set(layout.balloons.filter(line => line.panelId === beat.id)
    .map(line => line.preferredPosition.replace('-', ' ')))]
  const { fonts: _fonts, lettering: _lettering, ...artStyle } = layout.generation.style
  // Mesmo estilo da geração: prompt exclusivo e amostra do estilo (antes ia só a arte antiga, que perpetuava defeitos).
  const styleId = layout.generation.styleId
  const bankPrompt = styleId ? await stylePrompt(sb, styleId) : null
  const sample = bankPrompt ? await styleSample(sb, styleId) : null
  const styleDirection = bankPrompt
    ? `MASTER STYLE — redraw the masked area exactly in this style${sample ? ' (image 2 is the style sample and the final authority on the look; use it only for how to draw, never copy its content)' : ''}:\n${fitStyle(masterStyle(bankPrompt), 9000)}`
    : `Art direction: ${JSON.stringify(artStyle).slice(0, 5200)}`
  // Edição responde na hora (sem fila): só novas tentativas curtas que caibam no tempo da requisição.
  const img = await generateImageWithRetry([{ provider: 'openai', key }],
    `Redraw ONLY the area inside the transparent mask of this full comic page (image 1). It corresponds to panel ${beat.id}, at normalized bounds ${JSON.stringify(panel.bounds)}.
Preserve panel boundaries, gutters, the entire original page geometry and the surrounding art. Make a fresh interpretation of the same action with the same people, costumes, place and historical period.
${styleDirection}
Story context: ${JSON.stringify(layout.context).slice(0, 2800)}
Beat: ${JSON.stringify(direction)}
Cast: ${JSON.stringify(cast.filter(c => c.id && beat.cast.includes(c.id))).slice(0, 4000)}
Keep these regions visually quiet with calm background scenery in the same style: ${quietAreas.join(', ')}. No cutouts or empty white shapes.
Return a full portrait page with the exact same framing and no text, lettering or balloons.`,
    [{ mime: data.type, blob: data }, ...(sample ? [sample] : [])], new Blob([Uint8Array.from(atob(mask), c => c.charCodeAt(0))], { type: 'image/png' }),
    { deadline: Date.now() + 140_000, retries: 1, onRetry: info => log('comic-generate', 'panel_image_retry', info) },
  )
  const generation: GenerationRecord = {
    ...layout.generation, id: crypto.randomUUID(), createdAt: new Date().toISOString(), provider: 'openai',
    references: [], panelId: beat.id,
  }
  const imageUrl = await uploadImage(sb, userId, bookId, page, generation.id, img)
  return { generation: { ...generation, imageUrl }, imageUrl }
}

const CONTINUITY_PAGES = 2

async function renderFingerprint(text: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(hash)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function loadContinuity(sb: ReturnType<typeof adminClient>, userId: string, bookId: string, page: number,
  pages: Record<string, string>, layouts: Record<string, EditorialLayout> = {}, styleId?: string | null, styleRender?: string | null): Promise<ImageReference[]> {
  const prefix = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/${BUCKET}/`
  const folder = `${userId}/${bookId}/`
  const candidates = Object.entries(pages)
    .map(([key, url]) => ({ index: Number(key), path: typeof url === 'string' && url.startsWith(prefix) ? url.slice(prefix.length) : '' }))
    .filter(c => Number.isInteger(c.index) && c.index !== page && c.path.startsWith(folder))
    // Com estilo do banco, só páginas desenhadas nesse mesmo estilo: uma página no visual antigo
    // como continuidade fazia a nova sair igual a ela.
    .filter(c => !styleId || layouts[String(c.index)]?.generation?.styleId === styleId)
    // E só páginas feitas com o prompt atual do estilo e sem desvio de estilo apontado: uma página antiga e feia como
    // continuidade puxava a paleta e o acabamento dela para a página nova.
    .filter(c => {
      const layout = layouts[String(c.index)]
      if (!styleRender) return true
      return layout?.generation?.styleRender === styleRender && !layout?.issues?.includes('art_style_mismatch')
    })
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

// ---------------------------------------------------------------------------------------------------------------------
// Fila (comic_jobs 'queued' → 'running'). O clique só enfileira; um trabalho começa quando há vaga no limite de
// simultâneas (app_settings.comic_max_concurrent, conferido em comic_job_claim). Quem pega a vaga: a própria invocação do
// clique, o fim de cada trabalho (acorda a função de novo) e o pg_cron a cada minuto (rede de segurança).
// ---------------------------------------------------------------------------------------------------------------------
type Admin = ReturnType<typeof adminClient>
/** Trabalho da fila sendo desenhado agora. `attempt` conta a partir de 1; `startedAt` é quando pegou a vaga. */
type RunCtx = { jobId: string; fixOf: string | null; attempt: number; startedAt: number }
/** Tempo útil de um trabalho dentro da função (folga para gravar e devolver crédito antes do limite da plataforma). */
const JOB_BUDGET_MS = 320_000
/** Falha passageira (429/5xx) que sobrou das novas tentativas na hora: volta para a fila com espera crescente. */
const MAX_ATTEMPTS = 3
const REQUEUE_DELAYS_S = [60, 180]

async function inBackground(p: Promise<unknown>) {
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p)
  else await p
}

const now = () => new Date().toISOString()

async function failJob(sb: Admin, jobId: string, code: string) {
  await sb.from('comic_jobs').update({ status: 'failed', error: code, updated_at: now(), finished_at: now() })
    .eq('id', jobId).eq('status', 'running')
}

/** Acorda outra invocação desta função para pegar o próximo da fila (cada trabalho roda na sua própria invocação). */
async function kick() {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/comic-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}`, apikey: key } : {}) },
    body: JSON.stringify({ action: 'dispatch' }),
    signal: AbortSignal.timeout(15_000),
  }).then(r => r.body?.cancel(), e => log('comic-generate', 'kick_failed', { msg: String(e).slice(0, 160) }))
}

async function kickIfQueued(sb: Admin) {
  const { count } = await sb.from('comic_jobs').select('id', { count: 'exact', head: true })
    .eq('status', 'queued').lte('run_after', now())
  if (count) await kick()
}

/** Pega o próximo da fila se houver vaga e o desenha nesta invocação, em segundo plano. */
async function dispatch(): Promise<string | null> {
  const sb = adminClient()
  const { data, error } = await sb.rpc('comic_job_claim')
  if (error) {
    log('comic-generate', 'claim_failed', { msg: error.message.slice(0, 200) })
    return null
  }
  const jobId = (data as string | null) ?? null
  if (!jobId) return null
  await inBackground((async () => {
    await kickIfQueued(sb) // ainda há fila (e talvez vaga): a próxima invocação confere e pega
    await runJob(sb, jobId)
  })())
  return jobId
}

/** Refaz o pedido guardado no trabalho e desenha. Qualquer saída sem entrega marca falha (a reserva já voltou). */
async function runJob(sb: Admin, jobId: string) {
  try {
    const { data: job } = await sb.from('comic_jobs').select('user_id, book_id, page, request, fix_of, attempts, started_at')
      .eq('id', jobId).maybeSingle()
    if (!job) return
    const request = job.request as Body | null
    if (!request) return await failJob(sb, jobId, 'comic_job_failed')
    const ctx: RunCtx = {
      jobId, fixOf: job.fix_of as string | null, attempt: Math.max(1, Number(job.attempts) || 1),
      startedAt: Date.parse(job.started_at as string) || Date.now(),
    }
    const res = await handle(job.user_id as string, { ...request, bookId: job.book_id as string, page: job.page as number, job: true, fixOf: undefined }, ctx)
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      log('comic-generate', 'job_failed', { job: jobId, code: body.error ?? 'comic_job_failed' })
      await failJob(sb, jobId, body.error ?? 'comic_job_failed')
    }
  } catch (e) {
    log('comic-generate', 'job_crashed', { job: jobId, msg: String((e as Error)?.message ?? e).slice(0, 200) })
    await failJob(sb, jobId, e instanceof AiError ? e.code : 'comic_job_failed')
  } finally {
    await kickIfQueued(sb).catch(() => undefined) // vaga liberada: puxa o próximo
  }
}

/** Provedores de reserva para a página (app_settings.comic_image_fallback = 'gemini'), além da OpenAI. */
async function imageFallback(sb: Admin, userId: string): Promise<ImageProvider[]> {
  const { data } = await sb.from('app_settings').select('value').eq('key', 'comic_image_fallback').maybeSingle()
  if (data?.value !== 'gemini') return []
  const gemini = await pickProvider(userId, ['gemini'], { strict: true }).catch(() => null)
  return gemini ? [gemini] : []
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const b = await req.json().catch(() => null) as Body | null
  if (!b) return json({ error: 'invalid_json' }, 400)
  // Despachante (pg_cron, fim de um trabalho): não recebe dados, só pega o que já está na fila e respeita o limite.
  if (b.action === 'dispatch') return json({ claimed: await dispatch() })
  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized' }, 401)
  const limited = await rateLimit(req, user.id, 'comic-generate', 6)
  if (limited) return limited
  return handle(user.id, b)
})

async function handle(userId: string, b: Body, runCtx?: RunCtx): Promise<Response> {
  const user = { id: userId }
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
    const ent = await entitlements(user.id)
    if (b.panelId) {
      const layout = book.comic_layouts?.[page] as EditorialLayout | undefined
      if (layout?.v !== 3) return json({ error: 'invalid_target' }, 400)
      requireFeature(ent, ent.limits.custom_style, 'panel_edit')
      return json(await metered(user.id, 'comic-panel',
        () => editPanel(sb, user.id, bookId, page, b, layout, book.comic_pages?.[page], cast), { plan: ent.plan, ref: `${bookId}:${page}` }))
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
        const textAi = await pickProvider(user.id, ['openai', 'gemini'])
        const about = [cleanText(book.title, 200), cleanText(book.author, 120), cleanText(book.description, 1200),
          cleanText(book.context || b.bookContext, 1200), cleanText(pageText, 1500)].filter(Boolean).join('\n')
        const answer = await measured(user.id, 'suggest-style', () => llmJson<{ styleId?: unknown; reason?: unknown }>(textAi.provider, textAi.key, {
          prompt: `Choose the illustration style that best fits this book for a reader app. Judge by genre, audience, era and tone (for example: children's tales and fables, epic fantasy, gothic horror, science fiction, romance, detective noir, historical fiction).
Book:
${about}
${category ? `Gallery category: ${category}` : ''}
Styles: ${JSON.stringify(ready.map(item => ({ id: item.id, look: item.look, use: item.use })))}
Return JSON {"styleId": one id from the list, "reason": one short sentence in Portuguese}.`,
        }), ent.plan)
        const picked = cleanText(answer.styleId, 40)
        if (isReady(picked)) return json({ styleId: picked, source: 'ai', reason: cleanText(answer.reason, 200) })
      } catch (e) {
        log('comic-generate', 'suggest_style_failed', { reason: e instanceof Error ? e.message : String(e) })
      }
      return json({ styleId: styleForCategory(category, ready) ?? ready[0]?.id ?? null, source: 'category' })
    }
    // Estilo próprio num livro da galeria (diferente do padrão da comunidade) é recurso pago.
    if (link?.catalog_id && catalogStyle && fixedStyle && fixedStyle !== catalogStyle) requireFeature(ent, ent.limits.custom_style, 'custom_style')
    const generatePage = b.action !== 'prepare-art'
    // Página nova: 10 créditos (Grátis: até 3 por mês). Preparar a direção de arte só mede o custo.
    const run = <T,>(fn: () => Promise<T>) => generatePage
      ? metered(user.id, b.replan ? 'comic-replan' : 'comic-page', fn, {
        plan: ent.plan, ref: `${bookId}:${page}`, capField: ent.limits.pages != null ? 'pages' : undefined,
        cap: ent.is_admin ? null : ent.limits.pages,
      })
      : measured(user.id, 'prepare-art', fn, ent.plan)
    // Da fila: conta desde que pegou a vaga. Pedido direto (app antigo, sem fila): o limite da própria requisição.
    const deadline = runCtx ? runCtx.startedAt + JOB_BUDGET_MS : Date.now() + 140_000
    const work = async () => {
    const brief = { ...book, category: (catalog as { category?: string | null } | null)?.category ?? null, styleId: fixedStyle }
    const fingerprint = await briefFingerprint(brief)
    const imgAi = await pickProvider(user.id, ['openai'], { strict: true })
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
    if (b.action === 'prepare-art') return { styleDoc: style }
    const spans = sentenceSpans(pageText)
    if (!spans.length) throw new AiError('invalid_page_text', 400, 'invalid_page_text')
    const { references, images } = await loadReferences(sb, user.id, bookId, style)
    const textAi = await pickProvider(user.id, ['openai', 'gemini'])
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
    // Diagramação de HQ: formatos e tamanhos pelo que cada momento pede, variando entre páginas.
    const previousLayout = (book.comic_layouts ?? {})[String(page - 1)]?.generation?.layoutId ?? null
    const nextLayout = (book.comic_layouts ?? {})[String(page + 1)]?.generation?.layoutId ?? null
    const pageLayout = chooseLayout(plan.beats, page, { rhythm: cleanText(raw.pageRhythm, 20), previousId: previousLayout, nextId: nextLayout })
    // Quadro com inset por cima: o texto dele vai para o canto oposto ao inset.
    pageLayout.frames.forEach(frame => {
      if (frame.over == null) return
      const parent = pageLayout.frames[frame.over]
      const right = frame.x + frame.w / 2 > parent.x + parent.w / 2
      const bottom = frame.y + frame.h / 2 > parent.y + parent.h / 2
      const corner = `${bottom ? 'top' : 'bottom'}-${right ? 'left' : 'right'}` as const
      for (const line of plan.beats[frame.over]?.dialogue ?? []) line.preferredPosition = corner
    })
    // Continuity: the nearest pages already drawn for this book (earlier first) go to the image
    // model as real images, so recurring characters keep the same face, hair and clothing.
    const bankPrompt = await stylePrompt(sb, plan.style.styleId)
    const styleRender = bankPrompt ? await renderFingerprint(bankPrompt) : null
    const continuity = await loadContinuity(sb, user.id, bookId, page, book.comic_pages ?? {}, book.comic_layouts ?? {}, plan.style.styleId, styleRender)
    // A miniatura do estilo vai como primeira imagem: é ela que mostra à IA o visual escolhido
    // (o texto sozinho deixava livros famosos voltarem ao visual das edições conhecidas).
    const sample = bankPrompt ? await styleSample(sb, plan.style.styleId) : null
    // 429/5xx: novas tentativas com espera crescente enquanto couber no tempo do trabalho; depois o Gemini, se ligado.
    const img = await generateImageWithRetry([imgAi, ...await imageFallback(sb, user.id)],
      imagePrompt(plan, pageLayout.frames, references, continuity.length, b.replan, bankPrompt, !!sample),
      [...(sample ? [sample] : []), ...images, ...continuity], undefined,
      { deadline, onRetry: info => log('comic-generate', 'image_retry', { job: runCtx?.jobId, page, ...info }) })
    const generation: GenerationRecord = {
      id: crypto.randomUUID(), createdAt: new Date().toISOString(), provider: img.provider,
      styleRevision: plan.style.revision!,
      styleId: plan.style.styleId,
      ...(styleRender ? { styleRender } : {}),
      style: Object.fromEntries(STYLE_FIELDS.flatMap(key => plan.style[key] ? [[key, plan.style[key]]] : [])),
      references, frames: pageLayout.frames, layoutId: pageLayout.id,
    }
    const imageUrl = await uploadImage(sb, user.id, bookId, page, generation.id, img)
    generation.imageUrl = imageUrl
    return {
      imageUrl, rows, grid: rows.map(r => r.rightStack ? 3 : r.cols.length), beats: plan.beats,
      context: plan.context, editorialIssues: plan.editorialIssues, characters: plan.cast, styleDoc: plan.style, generation,
      previousCharacters: cast, previousStyleRevision: style.revision ?? null,
      panels: plan.beats.map(beat => ({
        charStart: spans[beat.sourceSentenceIds[0]][0], charEnd: spans[beat.sourceSentenceIds.at(-1)!][1], kind: 'caption',
      })),
    }
    }
    if (!b.job || !generatePage) return json(await run(work))

    if (runCtx) {
      // Chegou a vez deste trabalho na fila. O crédito é reservado só agora (cada tentativa com a sua reserva) e confirmado
      // só depois que a arte e o storyboard estão guardados; se nada puder ser entregue, a reserva volta.
      const { jobId, fixOf, attempt } = runCtx
      const deliver = async () => {
        const out = await work()
        // Mesma proteção na gravação do trabalho: o banco pode oscilar por alguns segundos.
        let saved = false
        for (let i = 0; i < 5 && !saved; i++) {
          const { data, error: saveError } = await sb.from('comic_jobs')
            .update({ status: 'rendered', result: out, error: null, updated_at: now(), finished_at: now() })
            .eq('id', jobId).eq('status', 'running').select('id')
          if (!saveError) {
            // Ninguém atualizado: a limpeza já marcou falha por tempo. Sem entrega, sem cobrança.
            if (!data?.length) throw new AiError('Job expired before saving', 500, 'comic_job_save_failed')
            saved = true
          } else await new Promise(r => setTimeout(r, 2000 * (i + 1)))
        }
        if (!saved) throw new AiError('Could not save the illustration', 500, 'comic_job_save_failed')
        return out
      }
      await (fixOf
        ? measured(user.id, 'comic-autofix', deliver, ent.plan)
        : metered(user.id, b.replan ? 'comic-replan' : 'comic-page', deliver, {
          plan: ent.plan, ref: `${bookId}:${page}`, key: `comic-job:${jobId}:${attempt}`, capField: ent.limits.pages != null ? 'pages' : undefined,
          cap: ent.is_admin ? null : ent.limits.pages,
        })
      ).catch(async (e) => {
        const err = e instanceof AiError ? e : new AiError(String((e as Error)?.message ?? e))
        // Falha passageira do provedor (as novas tentativas na hora não bastaram): volta para a fila com espera crescente.
        if (isTransient(e) && attempt < MAX_ATTEMPTS) {
          const delay = REQUEUE_DELAYS_S[attempt - 1] ?? REQUEUE_DELAYS_S.at(-1)!
          const { data: back } = await sb.from('comic_jobs')
            .update({ status: 'queued', error: err.code, started_at: null, run_after: new Date(Date.now() + delay * 1000).toISOString(), updated_at: now() })
            .eq('id', jobId).eq('status', 'running').select('id')
          if (back?.length) {
            log('comic-generate', 'job_requeued', { job: jobId, attempt, delay, code: err.code })
            return
          }
        }
        log('comic-generate', 'job_failed', { job: jobId, attempt, code: err.code, msg: err.message.slice(0, 200) })
        await failJob(sb, jobId, err.code)
      })
      return json({ jobId })
    }

    // Clique: valida (livro, estilo, plano) e entra na fila. O desenho começa quando houver vaga, nesta ou em outra
    // invocação, e continua mesmo se a pessoa sair da tela.
    let fixOf: string | null = null
    if (b.fixOf) {
      const { data: parent } = await sb.from('comic_jobs').select('id, status, created_at')
        .eq('id', String(b.fixOf)).eq('user_id', user.id).eq('book_id', bookId).eq('page', page).maybeSingle()
      if (!parent || !['rendered', 'done'].includes(parent.status) || Date.now() - Date.parse(parent.created_at) > 30 * 60_000) {
        return json({ error: 'invalid_target' }, 400)
      }
      fixOf = parent.id
    }
    // O pedido fica guardado no trabalho: quem pegar a vaga refaz tudo a partir dele (o texto da página vai sem cortes).
    const text = (value: unknown, max: number) => typeof value === 'string' && value ? value.slice(0, max) : undefined
    const request: Body = {
      pageText, bookContext: text(b.bookContext, 4000), replan: text(b.replan, 600), priorContext: text(b.priorContext, 3000),
    }
    const { data: job, error: jobError } = await sb.from('comic_jobs')
      .insert({ user_id: user.id, book_id: bookId, page, fix_of: fixOf, status: 'queued', request }).select('id').single()
    if (jobError) {
      // Já há um trabalho desta página na fila ou andando (dois cliques, duas abas) ou a correção já foi pedida: devolve o mesmo.
      if (jobError.code === '23505') {
        const { data: active } = await sb.from('comic_jobs').select('id')
          .eq('user_id', user.id).eq('book_id', bookId).eq('page', page).in('status', ['queued', 'running']).maybeSingle()
        if (active) return json({ jobId: active.id, existing: true })
        if (fixOf) {
          const { data: fix } = await sb.from('comic_jobs').select('id').eq('fix_of', fixOf).maybeSingle()
          if (fix) return json({ jobId: fix.id, existing: true })
        }
      }
      throw new AiError('Could not start the illustration', 500, 'comic_job_failed')
    }
    // Há vaga? Esta invocação já pega o próximo da fila (o mais antigo, que pode ser de outra pessoa) e desenha.
    await dispatch()
    return json({ jobId: job.id, queued: true })
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError(String((e as Error)?.message ?? e))
    log('comic-generate', 'error', { code: err.code, msg: err.code === 'comic_plan_invalid' ? 'Storyboard rejected' : err.message.slice(0, 200) })
    return json({ error: err.code, detail: err.message }, err.status)
  }
}
