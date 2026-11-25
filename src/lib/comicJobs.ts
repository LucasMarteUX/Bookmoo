// Geração de página ilustrada que não depende da tela aberta.
// O clique cria um trabalho no servidor (tabela comic_jobs), que desenha em segundo plano e só cobra quando a arte está
// guardada. Este executor fica no app inteiro (montado no Layout): acompanha o trabalho, encaixa os balões e grava a
// página, mesmo que a pessoa tenha saído do livro. Recarregou ou fechou a aba? Ao voltar, ele retoma de onde parou, sem
// gerar nem cobrar de novo. Antes a página só era gravada pela tela do leitor; saindo dela, o crédito ia e a imagem sumia.
import { create } from 'zustand'
import { toast } from '@/components/ui/toast'
import { AiRequestError, aiErrorMessage, inspectComicPage, locateComicFaces, type GeneratedComicPage, type GenerateComicOptions } from '@/lib/ai'
import { supabase } from '@/lib/supabase'
import { paywallForError } from '@/components/billing/Paywall'
import { refreshEntitlements } from '@/store/useEntitlements'
import { useBookStore, type Book, type ComicCharacter } from '@/store/useBookStore'
import { saveComicPage } from '@/lib/comicPersistence'
import { ensureBookFull } from '@/lib/supabaseSync'
import { browserMeasure, placePanelBoxes } from '@/lib/comicLettering'
import { resolveSpeakers } from '@/lib/speakerResolution'
import { letteringThemeFor } from '@/lib/comicThemes'
import { detectPanels } from '@/lib/comicPanels'
import { publishSharedImage } from '@/lib/catalog'
import { catalogStyleOptions } from '@/lib/comicStyles'
import { XP, useXpStore } from '@/store/useXpStore'
import { fullComicText } from '../../supabase/functions/_shared/comicText'
import type { EditorialLayout, PanelInspection, VisualBeat } from '../../supabase/functions/_shared/comicEditorial'

export type ComicJobStage = 'image' | 'layout'
type JobState = { jobId: string; stage: ComicJobStage; error?: string }
/** Página que acabou de ganhar imagem compartilhada na galeria (o leitor atualiza a lista dele). */
export const COMIC_SHARED_EVENT = 'upoonly:comic-shared'

const key = (bookId: string, page: number) => `${bookId}:${page}`
const LS = 'upoonly.comicJobs.v1'
type Pending = { jobId: string; bookId: string; page: number; fixOf?: string; at: number; tries?: number }

export const useComicJobs = create<{ jobs: Record<string, JobState>; errors: Record<string, string> }>(() => ({ jobs: {}, errors: {} }))
const setJob = (k: string, s: JobState | null) => useComicJobs.setState(st => {
  const jobs = { ...st.jobs }
  if (s) jobs[k] = s; else delete jobs[k]
  return { jobs }
})
const setError = (k: string, msg: string | null) => useComicJobs.setState(st => {
  const errors = { ...st.errors }
  if (msg) errors[k] = msg; else delete errors[k]
  return { errors }
})
/** Limpa o aviso de erro de uma página (a pessoa tentou de novo ou fechou o aviso). */
export function clearComicError(bookId: string, page: number) { setError(key(bookId, page), null) }

function loadPending(): Pending[] {
  try { return (JSON.parse(localStorage.getItem(LS) || '[]') as Pending[]).filter(p => Date.now() - p.at < 24 * 3600_000) } catch { return [] }
}
function savePending(list: Pending[]) { try { localStorage.setItem(LS, JSON.stringify(list)) } catch { /* ignore */ } }
const addPending = (p: Pending) => savePending([...loadPending().filter(x => x.jobId !== p.jobId), p])
const dropPending = (jobId: string) => savePending(loadPending().filter(x => x.jobId !== jobId))

const tracking = new Set<string>()
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const bookOf = (id: string) => useBookStore.getState().books.find(b => b.id === id)

type JobRow = { id: string; book_id: string; page: number; status: 'running' | 'rendered' | 'done' | 'failed'; result: GeneratedComicPage | null; error: string | null; fix_of: string | null }

async function readJob(jobId: string): Promise<JobRow | null> {
  if (!supabase) return null
  const { data } = await supabase.from('comic_jobs').select('id, book_id, page, status, result, error, fix_of').eq('id', jobId).maybeSingle()
  return data as JobRow | null
}
async function finishJob(jobId: string) {
  dropPending(jobId)
  if (supabase) await supabase.rpc('comic_job_finish', { p_job: jobId })
}

/** Espera o servidor terminar o desenho (consulta a cada 3 s; desiste depois de 9 min, quando o servidor já marcou falha). */
async function waitRendered(jobId: string): Promise<JobRow> {
  const t0 = Date.now()
  let delay = 2500
  while (Date.now() - t0 < 9 * 60_000) {
    const row = await readJob(jobId).catch(() => null)
    if (row && row.status !== 'running') return row
    await sleep(delay)
    delay = Math.min(5000, delay + 500)
  }
  throw new AiRequestError('comic_job_timeout')
}

/** Troca os rostos de cada quadro pelos localizados no recorte (quando a visão encontrar algum). */
export async function withLocatedFaces(imageUrl: string, panels: PanelInspection[], beats: VisualBeat[], characters: ComicCharacter[]) {
  try {
    const faces = await locateComicFaces(imageUrl, panels.map(panel => {
      const beat = beats.find(b => b.id === panel.panelId)
      return {
        bounds: panel.bounds,
        cast: characters.filter(c => c.id && beat?.cast.includes(c.id)),
        speakers: [...new Set((beat?.dialogue ?? []).flatMap(line => line.speakerId ? [line.speakerId] : []))],
      }
    }))
    return panels.map((panel, i) => faces[i]?.length ? { ...panel, faces: faces[i] } : panel)
  } catch (error) {
    console.warn('face pass failed', error)
    return panels
  }
}

/** Inspeção com nova tentativa: falha de rede repete só a avaliação, nunca o desenho. */
async function inspectWithRetry(generated: GeneratedComicPage, aspect: number, measured?: Parameters<typeof inspectComicPage>[2]) {
  let last: unknown
  for (let i = 0; i < 3; i++) {
    try { return await inspectComicPage(generated, aspect, measured) } catch (e) {
      last = e
      if (e instanceof AiRequestError && ['no_credits', 'cap_reached', 'plan_required'].includes(e.code)) throw e
      await sleep(1500 * (i + 1))
    }
  }
  throw last
}

async function letter(generated: GeneratedComicPage, pageText: string, book: Book) {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = generated.imageUrl
  await img.decode()
  const aspect = img.naturalWidth / img.naturalHeight
  const rows = generated.generation.composition
  // Diagramação livre (frames): as posições já vêm exatas do plano; a detecção por faixas só serve às páginas antigas.
  const measured = !generated.generation.frames?.length && rows?.length && !rows.some(row => row.rightStack) ? await detectPanels(generated.imageUrl, rows, true).catch(() => null) : null
  const inspected = await inspectWithRetry(generated, aspect, measured?.detected ? measured.panels : undefined)
  const inspection = { ...inspected, panels: await withLocatedFaces(generated.imageUrl, inspected.panels, generated.beats, generated.characters) }
  const dialogue = resolveSpeakers(fullComicText(pageText, generated.beats), generated.beats, generated.characters, pageText)
  const lettering = placePanelBoxes(inspection, dialogue, browserMeasure(letteringThemeFor(generated.styleDoc ?? book.comicStyleDoc).font))
  lettering.issues.push(...(generated.editorialIssues ?? []))
  return { generated, inspection, lettering }
}

/** Grava a página pronta no livro e, se for o estilo padrão de um livro da galeria, publica para a comunidade. */
async function savePage(bookId: string, page: number, done: Awaited<ReturnType<typeof letter>>) {
  const book = bookOf(bookId)
  if (!book) throw new AiRequestError('book_not_found')
  const { generated, inspection, lettering } = done
  const old = book.comicLayouts?.[page]
  const layout: EditorialLayout = {
    v: 3, panels: inspection.panels, beats: generated.beats, context: generated.context,
    generation: generated.generation, ...lettering, lettering: 'lines',
    quality: lettering.issues.length ? 'needs-review' : 'validated',
    history: old?.v === 3 ? [...(old.history ?? []), old.generation] : undefined,
  }
  const save = () => saveComicPage(bookOf(bookId) ?? book, page, generated.imageUrl, layout, {
    style: generated.styleDoc, styleRevision: generated.previousStyleRevision,
    characters: generated.characters, previousCharacters: generated.previousCharacters,
  })
  // Conflito: a cópia local estava velha. saveComicPage já atualizou o livro; tenta uma vez com a versão nova.
  try { await save() } catch (e) {
    if (!(e instanceof AiRequestError && e.code === 'comic_save_conflict')) throw e
    await save()
  }
  const publishStyle = generated.styleDoc?.styleId
  const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
  const userId = session?.user.id
  if (!book.catalogId || !publishStyle || book.imageMode === 'personal' || !userId || !/^https?:\/\//.test(generated.imageUrl)) return
  try {
    const defaultStyle = (await catalogStyleOptions(book.catalogId).catch(() => [])).find(option => option.isDefault)?.styleId
    if (defaultStyle && publishStyle !== defaultStyle) return
    const published = await publishSharedImage(book.catalogId, publishStyle, page, generated.imageUrl, userId)
    if (published) {
      window.dispatchEvent(new CustomEvent(COMIC_SHARED_EVENT, { detail: { bookId, page, imageUrl: generated.imageUrl } }))
      useXpStore.getState().award(`community:page:${book.catalogId}:${publishStyle}:${page}`, XP.communityImage)
    }
  } catch (error) {
    console.warn('shared comic image', error)
  }
}

/** Tenta terminar de novo em 1 min (a arte já está paga e guardada no trabalho). */
function retryLater(p: Pending) {
  const tries = (p.tries ?? 0) + 1
  if (tries > 5) return // a próxima abertura do app tenta de novo
  window.setTimeout(() => { void track({ ...p, tries }) }, 60_000 * tries)
}

const STYLE_FIX = 'The first render drifted from the MASTER STYLE. Match the style sample (image 1) much more closely in line quality, color treatment, facial construction, shading and level of detail. Keep the same story, panels and characters.'

/** Acompanha um trabalho até a página estar gravada (ou falhar), em qualquer tela do app. */
async function track(p: Pending) {
  if (tracking.has(p.jobId)) return
  tracking.add(p.jobId)
  const k = key(p.bookId, p.page)
  setJob(k, { jobId: p.jobId, stage: 'image' })
  try {
    const row = await waitRendered(p.jobId)
    if (row.status === 'done') { dropPending(p.jobId); return }
    if (row.status === 'failed' || !row.result) {
      const err = new AiRequestError(row.error || 'request_failed')
      await finishJob(p.jobId)
      refreshEntitlements()
      if (!p.fixOf) paywallForError(err.code)
      // Correção automática que falhou: a primeira versão (já paga) é que vale.
      if (p.fixOf) return
      throw err
    }
    setJob(k, { jobId: p.jobId, stage: 'layout' })
    let book = bookOf(p.bookId)
    // Livro ainda sem o texto (carregamento leve): busca agora, antes de encaixar os balões.
    if (book?.stub && supabase) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) await ensureBookFull(supabase, session.user.id, book.id, useBookStore.getState().updateBook)
      book = bookOf(p.bookId)
    }
    const pageText = book?.pages[p.page]
    if (!book || pageText == null) throw new AiRequestError('book_not_found')
    refreshEntitlements()
    let done
    try { done = await letter(row.result, pageText, book) } catch (e) {
      // A arte está guardada e paga: fica pendente e o app tenta encaixar os balões de novo ao voltar (sem gerar outra).
      console.warn('lettering deferred', e)
      setError(k, 'A ilustração está pronta e guardada, mas não deu para encaixar os balões agora. Ela aparece aqui assim que terminar; nada será cobrado de novo.')
      retryLater(p)
      return
    }
    // Arte claramente fora do estilo: uma correção automática, sem nova cobrança. Se ela não ficar melhor, vale a primeira.
    if (!p.fixOf && done.inspection.issues.includes('art_style_mismatch')) {
      try {
        const problems = done.inspection.issues.filter(issue => issue.startsWith('style_problem:')).map(issue => issue.slice(14)).join('; ')
        const fix = await invokeStart({ ...baseOptions(book, p.page, pageText), replan: problems ? `${STYLE_FIX} Fix: ${problems}`.slice(0, 300) : STYLE_FIX }, p.jobId)
        addPending({ jobId: fix, bookId: p.bookId, page: p.page, fixOf: p.jobId, at: Date.now() })
        setJob(k, { jobId: fix, stage: 'image' })
        const fixed = await waitRendered(fix)
        if (fixed.status === 'rendered' && fixed.result) {
          setJob(k, { jobId: fix, stage: 'layout' })
          const second = await letter(fixed.result, pageText, book).catch(() => null)
          if (second && !second.inspection.issues.includes('art_style_mismatch')) done = second
        }
        await finishJob(fix)
      } catch (e) {
        console.warn('style fix skipped', e)
      }
    }
    await savePage(p.bookId, p.page, done)
    await finishJob(p.jobId)
    setError(k, null)
    const here = location.pathname.includes(p.bookId)
    if (!here) toast(`Ilustração pronta: ${book.title}, página ${p.page + 1}`, { tone: 'success', action: { label: 'Ver', onClick: () => {
      history.pushState({}, '', `/book/${p.bookId}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } } })
  } catch (e) {
    const code = e instanceof AiRequestError ? e.code : ''
    console.error('comic job', e)
    // Arte guardada mas sem conseguir encaixar os balões agora: fica pendente e tenta de novo depois, sem gerar outra.
    if (!['no_credits', 'cap_reached', 'plan_required'].includes(code)) setError(k, aiErrorMessage(e))
    // Erro ao gravar com a arte já pronta: tenta de novo daqui a pouco.
    if (code !== 'comic_job_timeout' && !p.fixOf) { const row = await readJob(p.jobId).catch(() => null); if (row?.status === 'rendered') retryLater(p) }
  } finally {
    tracking.delete(p.jobId)
    setJob(k, null)
  }
}

function baseOptions(book: Book, page: number, pageText: string): GenerateComicOptions {
  return {
    bookId: book.id, page, pageText, bookTitle: book.title,
    bookContext: book.context?.trim() || book.pages.slice(0, 2).join('\n\n') || book.content,
    priorContext: book.pages[page - 1]?.slice(-1500),
    languageCode: book.languageCode,
  }
}

async function invokeStart(options: GenerateComicOptions, fixOf?: string): Promise<string> {
  if (!supabase) throw new AiRequestError('supabase_not_configured')
  const { data, error } = await supabase.functions.invoke('comic-generate', { body: { ...options, job: true, fixOf } })
  if (error) {
    let code = 'request_failed'
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const j = await ctx.json().catch(() => null) as { error?: string } | null
      if (j?.error) code = j.error
    }
    paywallForError(code)
    throw new AiRequestError(code)
  }
  const jobId = (data as { jobId?: string } | null)?.jobId
  if (!jobId) throw new AiRequestError('comic_response_invalid')
  return jobId
}

/** Começa a ilustrar uma página. Volta assim que o servidor aceitou; o resto acontece em segundo plano. */
export async function startComicJob(book: Book, page: number) {
  const k = key(book.id, page)
  if (useComicJobs.getState().jobs[k]) return
  setError(k, null)
  setJob(k, { jobId: 'starting', stage: 'image' })
  try {
    const pageText = book.pages[page] ?? ''
    const jobId = await invokeStart(baseOptions(book, page, pageText))
    addPending({ jobId, bookId: book.id, page, at: Date.now() })
    void track({ jobId, bookId: book.id, page, at: Date.now() })
  } catch (e) {
    setJob(k, null)
    throw e
  }
}

let resumed = false
/** Ao abrir o app: retoma trabalhos desta conta que ficaram no meio (outra aba, aba fechada, recarga). */
export async function resumeComicJobs() {
  if (resumed || !supabase) return
  resumed = true
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { resumed = false; return }
  const local = loadPending()
  const { data } = await supabase.from('comic_jobs').select('id, book_id, page, fix_of, status, created_at')
    .in('status', ['running', 'rendered']).is('fix_of', null).gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
  const rows = (data ?? []) as { id: string; book_id: string; page: number; fix_of: string | null }[]
  const all = new Map<string, Pending>()
  for (const p of local) if (!p.fixOf) all.set(p.jobId, p)
  for (const r of rows) if (!all.has(r.id)) all.set(r.id, { jobId: r.id, bookId: r.book_id, page: r.page, at: Date.now() })
  // Espera os livros carregarem (a página precisa do texto do livro para encaixar os balões).
  for (let i = 0; i < 20 && !useBookStore.getState().books.length; i++) await sleep(500)
  for (const p of all.values()) void track(p)
}
