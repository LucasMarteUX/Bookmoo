// English Proficiency Test (docs/PROVA-DE-PROFICIENCIA.md). Prova completa das 4 habilidades, inspirada no formato público
// do TOEFL iBT 2026; não oficial e sem vínculo com a ETS. Exclusiva do plano premium.
// Esta função é a autoridade de tudo: monta as sessões, controla cronômetros e reproduções de áudio, guarda as respostas,
// decide o caminho adaptativo e calcula a nota. Gabarito, roteiros de áudio e notas nunca vão para o aparelho.
import { adminClient, corsHeaders, getUser, json, log } from '../_shared/tts.ts'
import { rateLimit } from '../_shared/rate.ts'
import { AiError } from '../_shared/ai.ts'
import { entitlements, measured, type Entitlements } from '../_shared/billing.ts'
import {
  BLUEPRINT_VERSION, DEFAULT_MIN_PLAN_RANK, DIFFICULTY_MODEL, GRACE_MS, MAX_PLAYS, MODULES,
  ROUTER_TIME_SHARE, RUBRIC_VERSION, SCORING_VERSION, SECTION_SECONDS, SECTIONS, TASK_SECONDS, TASKS,
  type Module, type Section, type Stage, type TaskType,
} from '../_shared/proficiency/blueprint.ts'
import {
  adaptiveBand, cefrOf, insufficient, overallBand, partScore, route, scoredParts, speakingBand, writingBand,
  type Answer,
} from '../_shared/proficiency/engine.ts'
import { adminActions } from './admin.ts'
import { evaluateInterview, evaluateWriting, transcribe, writeReport, type SectionSummary } from '../_shared/proficiency/evaluate.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

export class ProfError extends Error { constructor(public code: string, public status = 400, public extra: Record<string, unknown> = {}) { super(code) } }
export type Db = ReturnType<typeof adminClient>
type Body = Record<string, unknown> & { action?: string }

const DAY = 86_400_000
const INTRO_MS = 5 * 60_000
const MONTHLY_ATTEMPTS = 2
/** Início do mês atual e do próximo, no horário de Brasília (UTC-3). */
function monthWindow(at = Date.now()) {
  const br = new Date(at - 3 * 3_600_000)
  const start = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), 1, 3))
  const next = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth() + 1, 1, 3))
  return { start, next }
}
const AUDIO_BUCKET = 'proficiency-audio'
const REC_BUCKET = 'proficiency-recordings'
const ADAPTIVE = (s: Section) => s === 'reading' || s === 'listening'
const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const nowIso = () => new Date().toISOString()

type ItemRow = { id: string; version_id: string; section: Section; task_type: TaskType; stage: Stage; difficulty: number; points: number; content: Record<string, unknown>; answer: Answer; script: Record<string, unknown> | null }
type SessionRow = {
  id: string; user_id: string; version_id: string; status: string; section: Section | 'done'; module: Module | 'done'
  section_started_at: string; section_deadline: string; path: Record<string, Record<string, unknown>>; started_at: string
  scoring_started_at: string | null; scoring_attempts: number
}
type SItem = { id: string; session_id: string; item_id: string; section: Section; module: Module; position: number; opened_at: string | null; deadline_at: string | null; plays: Record<string, { n: number; at: string }> }

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs]
  const r = new Uint32Array(a.length)
  crypto.getRandomValues(r)
  for (let i = a.length - 1; i > 0; i--) { const j = r[i] % (i + 1); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// ---------------------------------------------------------------------------------------------------------------------
// Acesso e banco de questões
async function minPlanRank(db: Db) {
  const { data } = await db.from('app_settings').select('value').eq('key', 'proficiency_min_plan_rank').maybeSingle()
  const n = Number(data?.value)
  return Number.isFinite(n) ? n : DEFAULT_MIN_PLAN_RANK
}

async function publishedVersion(db: Db) {
  const { data } = await db.from('prof_versions').select('id, code, difficulty_model, rubric_version').eq('status', 'published').maybeSingle()
  return data as { id: string; code: string; difficulty_model: string; rubric_version: string } | null
}

/** Questões aprovadas de uma versão (com áudio, quando o tipo precisa). */
export async function approvedPool(db: Db, versionId: string): Promise<ItemRow[]> {
  const { data: items } = await db.from('prof_items').select('id, version_id, section, task_type, stage, difficulty, points, content, answer, script').eq('version_id', versionId).eq('status', 'approved').limit(5000)
  const ids = (items ?? []).map(i => i.id)
  const assets = new Map<string, Set<string>>()
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await db.from('prof_assets').select('item_id, key').in('item_id', ids.slice(i, i + 300))
    for (const a of data ?? []) { if (!assets.has(a.item_id)) assets.set(a.item_id, new Set()); assets.get(a.item_id)!.add(a.key) }
  }
  return ((items ?? []) as ItemRow[]).filter(it => {
    if (!TASKS[it.task_type].audio) return true
    const have = assets.get(it.id) ?? new Set()
    if (it.task_type === 'interview') return ((it.script?.questions ?? []) as { id: string }[]).every(q => have.has(q.id))
    return have.has('main')
  })
}

const stageMatches = (it: ItemRow, module: Module) => module === 'fixed' ? true : it.stage === module

/** Escolhe as questões de um módulo. Prefere as que a pessoa nunca viu; usa estágio "any" só se faltar. */
function pickModule(pool: ItemRow[], section: Section, module: Module, exclude: Set<string>, seen: Set<string>): ItemRow[] | { missing: string[] } {
  const out: ItemRow[] = []
  const missing: string[] = []
  for (const slot of MODULES[section][module] ?? []) {
    const fits = pool.filter(it => it.task_type === slot.task && !exclude.has(it.id))
    const primary = fits.filter(it => stageMatches(it, module))
    const fallback = fits.filter(it => !stageMatches(it, module) && it.stage === 'any')
    const ordered = [...shuffle(primary.filter(i => !seen.has(i.id))), ...shuffle(primary.filter(i => seen.has(i.id))), ...shuffle(fallback.filter(i => !seen.has(i.id))), ...shuffle(fallback.filter(i => seen.has(i.id)))]
    if (ordered.length < slot.count) { missing.push(`${section}/${module}/${slot.task}: ${ordered.length}/${slot.count}`); continue }
    for (const it of ordered.slice(0, slot.count)) { out.push(it); exclude.add(it.id) }
  }
  return missing.length ? { missing } : out
}

/** O banco consegue montar uma prova inteira (todos os módulos, com áudio)? */
export function bankShortfalls(pool: ItemRow[]): string[] {
  const missing: string[] = []
  for (const section of SECTIONS) {
    const mods: Module[] = ADAPTIVE(section) ? ['router', 'easy', 'hard'] : ['fixed']
    // Router e segundo módulo nunca repetem questão: confere router + fácil e router + difícil.
    const combos: Module[][] = ADAPTIVE(section) ? [['router', 'easy'], ['router', 'hard']] : [mods]
    for (const combo of combos) {
      const exclude = new Set<string>()
      for (const m of combo) {
        const r = pickModule(pool, section, m, exclude, new Set())
        if ('missing' in r) missing.push(...r.missing)
      }
    }
  }
  return [...new Set(missing)]
}

async function serveModule(db: Db, s: SessionRow, section: Section, module: Module) {
  const pool = await approvedPool(db, s.version_id)
  const { data: already } = await db.from('prof_session_items').select('item_id').eq('session_id', s.id)
  const exclude = new Set((already ?? []).map(r => r.item_id))
  const { data: prior } = await db.from('prof_sessions').select('id').eq('user_id', s.user_id).neq('id', s.id).limit(20)
  const seen = new Set<string>()
  if (prior?.length) {
    const { data } = await db.from('prof_session_items').select('item_id').in('session_id', prior.map(p => p.id)).limit(2000)
    for (const r of data ?? []) seen.add(r.item_id)
  }
  const picked = pickModule(pool, section, module, exclude, seen)
  if ('missing' in picked) throw new ProfError('bank_incomplete', 503, { missing: picked.missing })
  const rows = picked.map((it, position) => ({ session_id: s.id, item_id: it.id, section, module, position }))
  const { error } = await db.from('prof_session_items').insert(rows)
  if (error && !/duplicate/.test(error.message)) throw new ProfError('serve_failed', 500)
}

// ---------------------------------------------------------------------------------------------------------------------
// Sessão
async function loadSession(db: Db, userId: string, id: unknown): Promise<SessionRow> {
  const { data } = await db.from('prof_sessions').select('*').eq('id', String(id ?? '')).eq('user_id', userId).maybeSingle()
  if (!data) throw new ProfError('session_not_found', 404)
  return data as SessionRow
}

function moduleDeadline(section: Section, module: Module, sectionStart: number): number {
  const total = SECTION_SECONDS[section] * 1000
  if (module === 'router' && ROUTER_TIME_SHARE[section]) return sectionStart + Math.round(total * ROUTER_TIME_SHARE[section]!)
  return sectionStart + total
}

/** Passa para o próximo módulo/seção. Só um pedido vence a corrida (update condicional). */
async function advance(db: Db, s: SessionRow, ent: Entitlements): Promise<SessionRow> {
  if (s.status !== 'active' || s.section === 'done') return s
  const section = s.section as Section
  const module = s.module as Module
  const path = { ...(s.path ?? {}) }
  let next: { section: Section | 'done'; module: Module | 'done'; deadline: number; started: number }

  if (ADAPTIVE(section) && module === 'router') {
    const router = await routerScore(db, s.id, section)
    const decision = route(router.correct, router.total, DIFFICULTY_MODEL)
    path[section] = { ...(path[section] ?? {}), router: decision }
    const sectionStart = new Date(s.section_started_at).getTime()
    next = { section, module: decision.module, deadline: moduleDeadline(section, decision.module, sectionStart), started: sectionStart }
  } else {
    const i = SECTIONS.indexOf(section)
    const ns = SECTIONS[i + 1]
    path[section] = { ...(path[section] ?? {}), finished_at: nowIso() }
    if (!ns) next = { section: 'done', module: 'done', deadline: Date.now(), started: Date.now() }
    else {
      const nm: Module = ADAPTIVE(ns) ? 'router' : 'fixed'
      // A próxima seção começa quando a pessoa toca em "Começar" (ação begin) ou, no máximo, depois do intervalo de
      // instruções: o cronômetro nunca corre enquanto ela lê a introdução, e parar no intervalo não congela a prova.
      const t = Date.now() + INTRO_MS
      next = { section: ns, module: nm, deadline: moduleDeadline(ns, nm, t), started: t }
      path[ns] = { pending: true, started_at: new Date(t).toISOString(), section_end: new Date(t + SECTION_SECONDS[ns] * 1000).toISOString() }
    }
  }

  const patch: Record<string, unknown> = { section: next.section, module: next.module, section_deadline: new Date(next.deadline).toISOString(), section_started_at: new Date(next.started).toISOString(), path }
  if (next.section === 'done') Object.assign(patch, { status: 'scoring', submitted_at: nowIso(), scoring_started_at: nowIso() })
  const { data: won } = await db.from('prof_sessions').update(patch).eq('id', s.id).eq('section', s.section).eq('module', s.module).eq('status', 'active').select('*').maybeSingle()
  if (!won) {
    const { data } = await db.from('prof_sessions').select('*').eq('id', s.id).single()
    return data as SessionRow
  }
  const updated = won as SessionRow
  if (next.section !== 'done') await serveModule(db, updated, next.section as Section, next.module as Module)
  else kickScoring(updated, ent)
  return updated
}

/** Cronômetro esgotado (mesmo com o app fechado): avança sozinho até o módulo atual estar no prazo. */
async function catchUp(db: Db, s: SessionRow, ent: Entitlements): Promise<SessionRow> {
  let cur = s
  for (let guard = 0; guard < 8 && cur.status === 'active' && Date.now() > new Date(cur.section_deadline).getTime() + GRACE_MS; guard++) {
    cur = await advance(db, cur, ent)
  }
  return cur
}

async function routerScore(db: Db, sessionId: string, section: Section) {
  const { data: sitems } = await db.from('prof_session_items').select('id, item_id, prof_items(task_type, content, answer)').eq('session_id', sessionId).eq('section', section).eq('module', 'router')
  const { data: resp } = await db.from('prof_responses').select('session_item_id, part, auto_score').eq('session_id', sessionId)
  const got = new Map((resp ?? []).map(r => [`${r.session_item_id}|${r.part}`, Number(r.auto_score) || 0]))
  let correct = 0, total = 0
  for (const si of sitems ?? []) {
    const it = (si as unknown as { prof_items: { task_type: TaskType; content: Record<string, unknown> } }).prof_items
    for (const part of scoredParts(it.task_type, it.content)) { total++; correct += got.get(`${si.id}|${part}`) ?? 0 }
  }
  return { correct, total }
}

/** Estado público da sessão: questões do módulo atual sem gabarito, respostas já salvas e prazos. */
async function publicState(db: Db, s: SessionRow) {
  const base = {
    id: s.id, status: s.status, section: s.section, module: s.module, deadline: s.section_deadline,
    startsAt: s.section_started_at, pending: s.section !== 'done' && !!s.path?.[s.section]?.pending && Date.now() < new Date(s.section_started_at).getTime(),
    sectionEnd: s.section !== 'done' ? (s.path?.[s.section]?.section_end as string | undefined) ?? s.section_deadline : null,
    serverNow: nowIso(), sections: SECTIONS.map(x => ({ id: x, seconds: SECTION_SECONDS[x], done: !!s.path?.[x]?.finished_at })),
  }
  if (s.status !== 'active' || s.section === 'done') return { session: base, items: [], responses: {} }
  const { data: sitems } = await db.from('prof_session_items').select('id, item_id, section, module, position, opened_at, deadline_at, plays, prof_items(task_type, content, points)').eq('session_id', s.id).eq('section', s.section).eq('module', s.module).order('position')
  const ids = (sitems ?? []).map(x => x.id)
  const { data: resp } = ids.length ? await db.from('prof_responses').select('session_item_id, part, response').in('session_item_id', ids) : { data: [] }
  const responses: Record<string, Record<string, unknown>> = {}
  for (const r of resp ?? []) (responses[r.session_item_id] ??= {})[r.part] = r.response
  return {
    session: base,
    items: (sitems ?? []).map(si => {
      const it = (si as unknown as { prof_items: { task_type: TaskType; content: Record<string, unknown>; points: number } }).prof_items
      return { sid: si.id, task: it.task_type, position: si.position, points: it.points, content: it.content, openedAt: si.opened_at, deadlineAt: si.deadline_at, plays: Object.fromEntries(Object.entries((si.plays ?? {}) as Record<string, { n: number }>).map(([k, v]) => [k, v.n])) }
    }),
    responses,
  }
}

async function currentItem(db: Db, s: SessionRow, sid: unknown) {
  if (s.status !== 'active') throw new ProfError('session_closed', 409)
  const { data } = await db.from('prof_session_items').select('*, prof_items(task_type, content, answer, script)').eq('id', String(sid ?? '')).eq('session_id', s.id).maybeSingle()
  if (!data) throw new ProfError('item_not_found', 404)
  if (data.section !== s.section || data.module !== s.module) throw new ProfError('item_not_current', 409)
  return data as SItem & { prof_items: { task_type: TaskType; content: Record<string, unknown>; answer: Answer; script: Record<string, unknown> | null } }
}

function assertOnTime(s: SessionRow, si: SItem) {
  const now = Date.now()
  if (now > new Date(s.section_deadline).getTime() + GRACE_MS) throw new ProfError('time_up', 409)
  if (si.deadline_at && now > new Date(si.deadline_at).getTime() + GRACE_MS) throw new ProfError('time_up', 409)
}

/** Cronômetro de cada tarefa de Writing e Speaking (começa quando a pessoa abre a tarefa). */
function taskSeconds(task: TaskType, content: Record<string, unknown>, audioMs = 0): number {
  switch (task) {
    case 'build_sentence': return TASK_SECONDS.build_sentence_block
    case 'write_email': return TASK_SECONDS.write_email
    case 'academic_discussion': return TASK_SECONDS.academic_discussion
    case 'listen_repeat': return Math.ceil(audioMs / 1000) + Number(content.seconds ?? 12) + 12
    case 'interview': return 4 * (TASK_SECONDS.interview_answer + 25)
    default: return 0
  }
}

/** Limpa a resposta conforme o tipo (nada além do formato esperado é guardado). */
function sanitize(task: TaskType, content: Record<string, unknown>, part: string, r: Record<string, unknown>, userId: string, sessionId: string, sid: string) {
  switch (task) {
    case 'complete_words': return { letters: clean(r.letters, 30) }
    case 'build_sentence': {
      const frags = (content.fragments ?? []) as string[]
      const order = Array.isArray(r.order) ? (r.order as unknown[]).map(x => String(x)).slice(0, frags.length) : []
      const pool = [...frags]
      for (const f of order) { const i = pool.indexOf(f); if (i < 0) throw new ProfError('invalid_response'); pool.splice(i, 1) }
      return { order }
    }
    case 'write_email': case 'academic_discussion': return { text: String(r.text ?? '').slice(0, 6000), words: String(r.text ?? '').split(/\s+/).filter(Boolean).length }
    case 'listen_repeat': case 'interview': {
      const path = String(r.audioPath ?? '')
      if (path && !path.startsWith(`${userId}/${sessionId}/${sid}-${part}.`)) throw new ProfError('invalid_audio_path')
      return { audioPath: path || null, durationMs: Math.max(0, Math.min(120_000, Number(r.durationMs) || 0)), mime: clean(r.mime, 40), deviceTranscript: clean(r.deviceTranscript, 1500) }
    }
    default: {
      const c = Number(r.choice)
      return { choice: Number.isInteger(c) && c >= 0 && c <= 3 ? c : null }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Nota (roda em segundo plano depois do envio; o app mostra "avaliação em andamento" e consulta o resultado)
function kickScoring(s: SessionRow, ent: Entitlements) {
  const p = scoreSession(s.id, ent.plan).catch(e => log('proficiency', 'score_failed', { session: s.id, msg: String((e as Error)?.message ?? e).slice(0, 200) }))
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p)
}

type Full = { id: string; section: Section; module: Module; position: number; item_id: string; prof_items: ItemRow }

export async function scoreSession(sessionId: string, plan?: string) {
  const db = adminClient()
  const { data: s } = await db.from('prof_sessions').select('*').eq('id', sessionId).single()
  if (!s || s.status !== 'scoring') return
  await db.from('prof_sessions').update({ scoring_started_at: nowIso(), scoring_attempts: (s.scoring_attempts ?? 0) + 1 }).eq('id', sessionId)
  try {
    await measured(s.user_id, 'proficiency-score', () => scoreInner(db, s as SessionRow), plan)
  } catch (e) {
    // IA fora do ar (sem cota, sem chave, teto diário, sobrecarga): a sessão continua "em avaliação" e tenta de novo na
    // próxima consulta; só erros de outro tipo contam para marcar como falha.
    const code = e instanceof AiError ? e.code : ''
    const msg = String((e as Error)?.message ?? e)
    const aiDown = ['quota', 'no_api_key', 'ai_paused', 'invalid_key'].includes(code) || /_(quota|error_5\d\d)|high demand|unavailable/i.test(msg)
    const attempts = aiDown ? (s.scoring_attempts ?? 0) : (s.scoring_attempts ?? 0) + 1
    await db.from('prof_sessions').update({ error: msg.slice(0, 300), scoring_attempts: attempts, ...(attempts >= 4 ? { status: 'failed' } : {}) }).eq('id', sessionId)
    throw e
  }
}

async function scoreInner(db: Db, s: SessionRow) {
  const { data: sitems } = await db.from('prof_session_items').select('id, section, module, position, item_id, prof_items(id, task_type, content, answer, script, points, section)').eq('session_id', s.id)
  const { data: resp } = await db.from('prof_responses').select('id, session_item_id, part, response, audio_path, transcript, auto_score').eq('session_id', s.id)
  const items = (sitems ?? []) as unknown as Full[]
  const byItem = new Map<string, { id: string; part: string; response: Record<string, unknown>; audio_path: string | null; transcript: string | null; auto_score: number | null }[]>()
  for (const r of resp ?? []) { if (!byItem.has(r.session_item_id)) byItem.set(r.session_item_id, []); byItem.get(r.session_item_id)!.push(r as never) }
  const respOf = (sid: string, part: string) => byItem.get(sid)?.find(r => r.part === part)

  // 1) Transcrição das gravações (no servidor), 4 por vez.
  const recs = items.filter(i => i.section === 'speaking').flatMap(i => (byItem.get(i.id) ?? []).filter(r => r.response?.audioPath && !r.transcript))
  for (let i = 0; i < recs.length; i += 4) {
    await Promise.all(recs.slice(i, i + 4).map(async r => {
      let text = ''
      try {
        const { data: blob } = await db.storage.from(REC_BUCKET).download(String(r.response.audioPath))
        if (blob && blob.size > 1500) text = await transcribe(s.user_id, blob, (Number(r.response.durationMs) || 10_000) / 1000)
      } catch (e) {
        log('proficiency', 'transcribe_failed', { msg: String((e as Error)?.message ?? e).slice(0, 160) })
        text = String(r.response.deviceTranscript ?? '') // reserva: o que o aparelho reconheceu
      }
      r.transcript = text
      await db.from('prof_responses').update({ transcript: text }).eq('id', r.id)
    }))
  }

  const sections: Record<string, SectionSummary> = {}
  const evalRows: Record<string, unknown>[] = []
  const bands: Record<string, number | null> = {}

  // 2) Reading e Listening: objetivas + caminho adaptativo.
  for (const section of ['reading', 'listening'] as const) {
    const breakdown: Record<string, { correct: number; total: number }> = {}
    const acc = { router: [0, 0], module: [0, 0] }
    let answered = 0
    const module = (s.path?.[section]?.router as { module?: 'easy' | 'hard' } | undefined)?.module ?? 'easy'
    for (const it of items.filter(i => i.section === section)) {
      const p = it.prof_items
      for (const part of scoredParts(p.task_type, p.content)) {
        const r = respOf(it.id, part)
        const sc = r ? (partScore(p.task_type, p.answer, part, r.response) ?? 0) : 0
        if (r && (r.response?.choice != null || String(r.response?.letters ?? '').length > 0)) answered++
        const b = (breakdown[TASKS[p.task_type].label] ??= { correct: 0, total: 0 })
        b.correct += sc; b.total++
        const slot = it.module === 'router' ? acc.router : acc.module
        slot[0] += sc; slot[1]++
      }
    }
    const total = acc.router[1] + acc.module[1]
    const why = insufficient(section, { answered, total })
    const band = why ? null : adaptiveBand(acc.router[1] ? acc.router[0] / acc.router[1] : 0, acc.module[1] ? acc.module[0] / acc.module[1] : 0, module)
    bands[section] = band
    sections[section] = { band, cefr: band ? cefrOf(band) : null, status: why ? 'inconclusive' : 'ok', reason: why, breakdown }
  }

  // 3) Writing: Build a Sentence objetivo + e-mail e discussão pela IA.
  {
    const breakdown: Record<string, { correct: number; total: number }> = {}
    const evals: SectionSummary['evals'] = []
    let basC = 0, basT = 0, answered = 0, words = 0, email = 0, disc = 0
    for (const it of items.filter(i => i.section === 'writing').sort((a, b) => a.position - b.position)) {
      const p = it.prof_items
      if (p.task_type === 'build_sentence') {
        const r = respOf(it.id, 'order')
        const sc = r ? partScore('build_sentence', p.answer, 'order', r.response) ?? 0 : 0
        if (r && (r.response?.order as unknown[] | undefined)?.length) answered++
        basC += sc; basT++
        continue
      }
      const r = respOf(it.id, 'text')
      const text = String(r?.response?.text ?? '')
      const n = text.split(/\s+/).filter(Boolean).length
      if (n > 0) answered++
      words += n
      const kind = p.task_type === 'write_email' ? 'email' : 'discussion'
      const ev = await evaluateWriting(s.user_id, kind, p.content, text)
      if (kind === 'email') email = ev.score; else disc = ev.score
      breakdown[TASKS[p.task_type].label] = { correct: ev.score, total: 5 }
      evals.push({ task: TASKS[p.task_type].label, score: ev.score, rationale: ev.rationale, strengths: ev.strengths, improve: ev.improve, evidence: ev.evidence })
      evalRows.push({ session_id: s.id, session_item_id: it.id, section: 'writing', task_type: p.task_type, rubric_version: RUBRIC_VERSION, score: ev.score, criteria: ev.criteria, rationale: ev.rationale, evidence: ev.evidence, status: ev.insufficient ? 'insufficient' : 'ok' })
    }
    breakdown['Build a Sentence'] = { correct: basC, total: basT }
    const why = insufficient('writing', { answered, total: basT + 2, words })
    const band = why ? null : writingBand(basT ? basC / basT : 0, email, disc)
    bands.writing = band
    sections.writing = { band, cefr: band ? cefrOf(band) : null, status: why ? 'inconclusive' : 'ok', reason: why, breakdown, evals }
  }

  // 4) Speaking: repetição pela transcrição + entrevista pela IA.
  {
    const breakdown: Record<string, { correct: number; total: number }> = {}
    const evals: SectionSummary['evals'] = []
    let rep = 0, repN = 0, spoken = 0, interview = 0
    const spokenText = (t: string | null | undefined) => String(t ?? '').split(/\s+/).filter(Boolean).length >= 2
    for (const it of items.filter(i => i.section === 'speaking').sort((a, b) => a.position - b.position)) {
      const p = it.prof_items
      if (p.task_type === 'listen_repeat') {
        const r = respOf(it.id, 'say')
        const sc = r ? partScore('listen_repeat', p.answer, 'say', { transcript: r.transcript ?? '' }) ?? 0 : 0
        if (r && spokenText(r.transcript)) spoken++
        rep += sc; repN++
        if (r) await db.from('prof_responses').update({ auto_score: sc }).eq('id', r.id)
        continue
      }
      const qs = ((p.script?.questions ?? []) as { id: string; text: string }[])
      const answers = qs.map(q => {
        const r = respOf(it.id, q.id)
        if (r && spokenText(r.transcript)) spoken++
        return { question: q.text, transcript: String(r?.transcript ?? ''), seconds: (Number(r?.response?.durationMs) || 0) / 1000 }
      })
      const ev = await evaluateInterview(s.user_id, String(p.content.context ?? ''), answers)
      interview = ev.score
      breakdown['Take an Interview'] = { correct: ev.score, total: 5 }
      evals.push({ task: 'Take an Interview', score: ev.score, rationale: ev.rationale, strengths: ev.strengths, improve: ev.improve, evidence: ev.evidence })
      evalRows.push({ session_id: s.id, session_item_id: it.id, section: 'speaking', task_type: 'interview', rubric_version: RUBRIC_VERSION, score: ev.score, criteria: { ...ev.criteria, per_question: ev.perQuestion }, rationale: ev.rationale, evidence: ev.evidence, status: ev.insufficient ? 'insufficient' : 'ok' })
    }
    breakdown['Listen and Repeat'] = { correct: Math.round(rep * 100) / 100, total: repN }
    const why = insufficient('speaking', { answered: spoken, total: 11, spoken })
    const band = why ? null : speakingBand(repN ? rep / repN : 0, interview)
    bands.speaking = band
    sections.speaking = { band, cefr: band ? cefrOf(band) : null, status: why ? 'inconclusive' : 'ok', reason: why, breakdown, evals }
  }

  const all = SECTIONS.map(x => bands[x])
  const complete = all.every(b => b != null)
  const overall = complete ? overallBand(all as number[]) : null
  const report = await writeReport(s.user_id, overall, sections)

  await db.from('prof_evaluations').delete().eq('session_id', s.id)
  if (evalRows.length) await db.from('prof_evaluations').insert(evalRows)
  await db.from('prof_results').upsert({
    session_id: s.id, user_id: s.user_id, status: complete ? 'final' : 'inconclusive', overall, cefr: overall ? cefrOf(overall) : null,
    sections, report, scoring_version: SCORING_VERSION, rubric_version: RUBRIC_VERSION,
  })
  await db.from('prof_sessions').update({ status: complete ? 'scored' : 'inconclusive', scored_at: nowIso(), error: null }).eq('id', s.id)
  if (complete && overall) {
    // Selo CEFR no perfil (o nível da pessoa no app continua com os nomes próprios; o selo vem só da prova).
    const { data: prof } = await db.from('profiles').select('proficiency_band, proficiency_at').eq('user_id', s.user_id).maybeSingle()
    const sameMonth = prof?.proficiency_at && new Date(prof.proficiency_at) >= monthWindow().start
    if (!sameMonth || Number(prof?.proficiency_band ?? 0) <= overall) {
      await db.from('profiles').update({ proficiency_cefr: cefrOf(overall), proficiency_band: overall, proficiency_at: nowIso() }).eq('user_id', s.user_id)
    }
  }
  await rememberProficiency(db, s, overall, sections, report)
}

const TUTOR_IDS = ['bookmoo-mulher', 'bookmoo-homem', 'bookmoo-yuno', 'bookmoo-yuri']
/**
 * Junta o resultado da prova à memória do tutor que acompanhou (tutor_memory, lida pela função `conversation`): resumo com
 * data e notas, pontos a melhorar, acertos e o tópico. Soma ao que o tutor já sabia e nunca quebra a prova.
 */
async function rememberProficiency(db: Db, s: SessionRow & { client?: { tutor?: string | null } | null }, overall: number | null, sections: Record<string, SectionSummary>, report: { skills?: Record<string, { strengths?: string[]; improve?: string[] }> }) {
  const tutor = String(s.client?.tutor ?? '')
  if (!TUTOR_IDS.includes(tutor)) return
  try {
    const { data: prev } = await db.from('tutor_memory').select('*').eq('user_id', s.user_id).eq('character_id', tutor).maybeSingle()
    const merge = (a: string[] | null | undefined, b: string[], n: number) => [...new Set([...b, ...(a ?? [])])].slice(0, n)
    const band = (k: string) => sections[k]?.band ?? 'inconclusive'
    const pick = (field: 'strengths' | 'improve') => SECTIONS.flatMap(k => (report.skills?.[k]?.[field] ?? []).slice(0, 1).map(x => clean(`${k}: ${x}`, 140)))
    const improve = pick('improve')
    const note = `Proficiency test (${new Date().toISOString().slice(0, 10)}): overall ${overall ?? 'inconclusive'}/6 (reading ${band('reading')}, listening ${band('listening')}, writing ${band('writing')}, speaking ${band('speaking')}). To practise: ${improve.join('; ') || 'n/a'}.`
    await db.from('tutor_memory').upsert({
      user_id: s.user_id, character_id: tutor,
      summary: clean(`${note} ${prev?.summary ?? ''}`, 480),
      strengths: merge(prev?.strengths, pick('strengths'), 4), weaknesses: merge(prev?.weaknesses, improve, 4),
      topics: merge(prev?.topics, ['proficiency test'], 5),
      sessions: Number(prev?.sessions ?? 0), last_at: nowIso(), updated_at: nowIso(),
    })
  } catch (e) { log('proficiency', 'memory_failed', { msg: String((e as Error)?.message ?? e).slice(0, 120) }) }
}

// ---------------------------------------------------------------------------------------------------------------------
async function eligibility(db: Db, userId: string, ent: Entitlements) {
  const min = await minPlanRank(db)
  const premium = ent.is_admin || ent.plan_rank >= min
  const version = await publishedVersion(db)
  // Duas tentativas por mês (mês do calendário, horário de Brasília). Toda prova iniciada conta, inclusive a abandonada:
  // quem viu as questões já usou a tentativa. O selo fica com a maior nota do mês.
  const { start, next } = monthWindow()
  const { count } = await db.from('prof_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('started_at', start.toISOString())
  const used = count ?? 0
  const full = !ent.is_admin && used >= MONTHLY_ATTEMPTS
  return { premium, version, minRank: min, monthUsed: used, monthLimit: MONTHLY_ATTEMPTS, nextAvailableAt: full ? next.toISOString() : null }
}

async function handle(userId: string, b: Body) {
  const db = adminClient()
  const ent = await entitlements(userId)
  if (String(b.action ?? '').startsWith('admin_')) {
    if (!ent.is_admin) throw new ProfError('forbidden', 403)
    return await adminActions(db, userId, b, { approvedPool, bankShortfalls, scoreSession, ProfError, plan: ent.plan })
  }
  switch (b.action) {
    case 'overview': {
      const e = await eligibility(db, userId, ent)
      const { data: active } = await db.from('prof_sessions').select('id, section, module, started_at, status').eq('user_id', userId).eq('status', 'active').order('started_at', { ascending: false }).limit(1).maybeSingle()
      const { data: scoringRow } = await db.from('prof_sessions').select('id, started_at, submitted_at').eq('user_id', userId).eq('status', 'scoring').order('started_at', { ascending: false }).limit(1).maybeSingle()
      const { data: results } = await db.from('prof_results').select('session_id, status, overall, cefr, sections, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
      return {
        premium: e.premium, available: !!e.version, nextAvailableAt: e.nextAvailableAt, minPlanRank: e.minRank,
        monthUsed: e.monthUsed, monthLimit: e.monthLimit,
        monthBest: (results ?? []).filter(r => r.status === 'final' && new Date(r.created_at) >= monthWindow().start).reduce<number | null>((m, r) => Math.max(m ?? 0, Number(r.overall) || 0), null),
        active: active ?? null,
        scoring: scoringRow ?? null,
        history: (results ?? []).map(r => ({ id: r.session_id, status: r.status, overall: r.overall, cefr: r.cefr, created_at: r.created_at, bands: Object.fromEntries(Object.entries((r.sections ?? {}) as Record<string, { band: number | null }>).map(([k, v]) => [k, v.band])) })),
        blueprint: { version: BLUEPRINT_VERSION, sections: SECTIONS.map(x => ({ id: x, seconds: SECTION_SECONDS[x] })) },
      }
    }

    case 'start': {
      if (b.consent !== true) throw new ProfError('consent_required')
      const checks = (b.checks ?? {}) as Record<string, unknown>
      if (checks.mic !== true || checks.audio !== true) throw new ProfError('checks_required')
      const e = await eligibility(db, userId, ent)
      if (!e.premium) throw new ProfError('plan_required', 402, { detail: 'plan_required:proficiency' })
      if (!e.version) throw new ProfError('not_available', 503)
      const { data: open } = await db.from('prof_sessions').select('*').eq('user_id', userId).eq('status', 'active').maybeSingle()
      if (open) return await publicState(db, await catchUp(db, open as SessionRow, ent))
      if (e.nextAvailableAt) throw new ProfError('cooldown', 429, { availableAt: e.nextAvailableAt })
      const pool = await approvedPool(db, e.version.id)
      const short = bankShortfalls(pool)
      if (short.length) { log('proficiency', 'bank_incomplete', { missing: short.slice(0, 10) }); throw new ProfError('not_available', 503) }
      const t = Date.now()
      const { data: row, error } = await db.from('prof_sessions').insert({
        user_id: userId, version_id: e.version.id, section: 'reading', module: 'router', section_started_at: new Date(t).toISOString(),
        section_deadline: new Date(moduleDeadline('reading', 'router', t)).toISOString(), consent_at: nowIso(),
        checks: { mic: true, audio: true, at: nowIso() }, client: { ua: clean(b.ua, 200), tutor: TUTOR_IDS.includes(String(b.characterId)) ? String(b.characterId) : null },
        path: { versions: { blueprint: BLUEPRINT_VERSION, difficulty: DIFFICULTY_MODEL, rubric: RUBRIC_VERSION, scoring: SCORING_VERSION }, reading: { started_at: new Date(t).toISOString(), section_end: new Date(t + SECTION_SECONDS.reading * 1000).toISOString() } },
      }).select('*').single()
      if (error || !row) throw new ProfError(/one_active/.test(error?.message ?? '') ? 'already_active' : 'start_failed', 409)
      await serveModule(db, row as SessionRow, 'reading', 'router')
      return await publicState(db, row as SessionRow)
    }

    case 'state': {
      const s = await catchUp(db, await loadSession(db, userId, b.sessionId), ent)
      return await publicState(db, s)
    }

    case 'open': {
      // Começa o cronômetro de uma tarefa de Writing/Speaking (uma vez; recarregar a página não zera).
      const s = await catchUp(db, await loadSession(db, userId, b.sessionId), ent)
      const si = await currentItem(db, s, b.sid)
      const task = si.prof_items.task_type
      if (!si.opened_at && (s.section === 'writing' || s.section === 'speaking')) {
        const now = Date.now()
        let audioMs = 0
        if (task === 'listen_repeat') {
          const { data: a } = await db.from('prof_assets').select('duration_ms').eq('item_id', si.item_id).eq('key', 'main').maybeSingle()
          audioMs = Number(a?.duration_ms) || 6000
        }
        const secs = taskSeconds(task, si.prof_items.content, audioMs)
        let deadline = new Date(Math.min(now + secs * 1000, new Date(s.section_deadline).getTime())).toISOString()
        if (task === 'build_sentence') {
          // As 10 frases dividem um cronômetro só: a primeira aberta define o prazo de todas.
          const { data: first } = await db.from('prof_session_items').select('deadline_at').eq('session_id', s.id).eq('section', 'writing').not('deadline_at', 'is', null).limit(1)
          const { data: bas } = await db.from('prof_session_items').select('id, prof_items(task_type)').eq('session_id', s.id).eq('section', 'writing')
          if (first?.[0]?.deadline_at) deadline = first[0].deadline_at
          const ids = (bas ?? []).filter(x => (x as unknown as { prof_items: { task_type: string } }).prof_items.task_type === 'build_sentence').map(x => x.id)
          await db.from('prof_session_items').update({ opened_at: nowIso(), deadline_at: deadline }).in('id', ids).is('opened_at', null)
        } else {
          await db.from('prof_session_items').update({ opened_at: nowIso(), deadline_at: deadline }).eq('id', si.id).is('opened_at', null)
        }
      }
      return await publicState(db, s)
    }

    case 'save': {
      const s = await loadSession(db, userId, b.sessionId)
      const si = await currentItem(db, s, b.sid)
      assertOnTime(s, si)
      const task = si.prof_items.task_type
      const part = clean(b.part, 12)
      if (!scoredParts(task, si.prof_items.content).includes(part)) throw new ProfError('invalid_part')
      const response = sanitize(task, si.prof_items.content, part, (b.response ?? {}) as Record<string, unknown>, userId, s.id, si.id)
      const auto = partScore(task, si.prof_items.answer, part, response)
      const { error } = await db.from('prof_responses').upsert({
        session_id: s.id, session_item_id: si.id, part, response, saved_at: nowIso(),
        audio_path: (response as { audioPath?: string | null }).audioPath ?? null,
        auto_score: task === 'listen_repeat' ? null : auto,
      }, { onConflict: 'session_item_id,part' })
      if (error) throw new ProfError('save_failed', 500)
      return { ok: true, savedAt: nowIso() }
    }

    case 'audio': {
      // URL assinada e curta. Cada áudio toca uma vez; se o carregamento falhar, dá para pedir de novo em até 20 s.
      const s = await loadSession(db, userId, b.sessionId)
      const si = await currentItem(db, s, b.sid)
      assertOnTime(s, si)
      const key = clean(b.key, 12) || 'main'
      const plays = { ...(si.plays ?? {}) }
      const prev = plays[key]
      if (prev && prev.n >= MAX_PLAYS && Date.now() - new Date(prev.at).getTime() > 20_000) throw new ProfError('no_replays', 409)
      const { data: asset } = await db.from('prof_assets').select('storage_path, duration_ms, mime').eq('item_id', si.item_id).eq('key', key).maybeSingle()
      if (!asset) throw new ProfError('audio_missing', 500)
      const { data: signed } = await db.storage.from(AUDIO_BUCKET).createSignedUrl(asset.storage_path, 180)
      if (!signed?.signedUrl) throw new ProfError('audio_failed', 500)
      if (!prev) { plays[key] = { n: 1, at: nowIso() }; await db.from('prof_session_items').update({ plays }).eq('id', si.id) }
      return { url: signed.signedUrl, durationMs: asset.duration_ms, mime: asset.mime }
    }

    case 'upload': {
      const s = await loadSession(db, userId, b.sessionId)
      const si = await currentItem(db, s, b.sid)
      assertOnTime(s, si)
      if (si.section !== 'speaking') throw new ProfError('invalid_part')
      const part = clean(b.part, 12)
      if (!scoredParts(si.prof_items.task_type, si.prof_items.content).includes(part)) throw new ProfError('invalid_part')
      const mime = clean(b.mime, 40)
      const ext = /mp4|m4a|aac/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : 'webm'
      const path = `${userId}/${s.id}/${si.id}-${part}.${ext}`
      const { data, error } = await db.storage.from(REC_BUCKET).createSignedUploadUrl(path, { upsert: true })
      if (error || !data) throw new ProfError('upload_failed', 500)
      return { path, token: data.token, signedUrl: data.signedUrl }
    }

    case 'begin': {
      // Começa agora a seção que estava no intervalo de instruções.
      const s = await catchUp(db, await loadSession(db, userId, b.sessionId), ent)
      if (s.status === 'active' && s.section !== 'done' && s.section === b.section && s.path?.[s.section]?.pending && Date.now() < new Date(s.section_started_at).getTime()) {
        const sec = s.section as Section
        const t = Date.now()
        const path = { ...s.path, [sec]: { ...s.path[sec], pending: false, started_at: new Date(t).toISOString(), section_end: new Date(t + SECTION_SECONDS[sec] * 1000).toISOString() } }
        const { data } = await db.from('prof_sessions').update({ section_started_at: new Date(t).toISOString(), section_deadline: new Date(moduleDeadline(sec, s.module as Module, t)).toISOString(), path })
          .eq('id', s.id).eq('section', sec).eq('module', s.module).select('*').maybeSingle()
        return await publicState(db, (data ?? s) as SessionRow)
      }
      return await publicState(db, s)
    }

    case 'advance': {
      const s = await catchUp(db, await loadSession(db, userId, b.sessionId), ent)
      // O app manda a seção/módulo que acha que está terminando: evita pular dois módulos com um clique duplo.
      if (s.status === 'active' && s.section === b.section && s.module === b.module) return await publicState(db, await advance(db, s, ent))
      return await publicState(db, s)
    }

    case 'result': {
      const s = await loadSession(db, userId, b.sessionId)
      if (s.status === 'scoring' && (!s.scoring_started_at || Date.now() - new Date(s.scoring_started_at).getTime() > 4 * 60_000)) kickScoring(s, ent)
      if (s.status !== 'scored' && s.status !== 'inconclusive') {
        const err = String((s as SessionRow & { error?: string | null }).error ?? '')
        // Fila: a IA de correção está sem cota ou fora do ar; a avaliação continua sozinha quando ela voltar.
        const queued = s.status === 'scoring' && /quota|no_api_key|ai_paused|error_5\d\d|high demand/i.test(err)
        return { status: s.status, submittedAt: (s as SessionRow & { submitted_at?: string }).submitted_at ?? null, queued }
      }
      const { data: r } = await db.from('prof_results').select('*').eq('session_id', s.id).single()
      return { status: s.status, result: { ...r, started_at: s.started_at, path: Object.fromEntries(Object.entries(s.path ?? {}).filter(([k]) => k === 'reading' || k === 'listening').map(([k, v]) => [k, { module: (v.router as { module?: string } | undefined)?.module ?? null }])) } }
    }

    case 'abandon': {
      const s = await loadSession(db, userId, b.sessionId)
      if (s.status === 'active') await db.from('prof_sessions').update({ status: 'abandoned' }).eq('id', s.id)
      return { ok: true }
    }

    default:
      throw new ProfError('unknown_action')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized' }, 401)
  const limited = await rateLimit(req, user.id, 'proficiency', 240)
  if (limited) return limited
  const body = await req.json().catch(() => null) as Body | null
  if (!body) return json({ error: 'invalid_json' }, 400)
  try {
    return json(await handle(user.id, body))
  } catch (e) {
    if (e instanceof ProfError) return json({ error: e.code, ...e.extra }, e.status)
    const err = e instanceof AiError ? e : new AiError(String((e as Error)?.message ?? e))
    log('proficiency', 'error', { action: body.action, code: err.code, msg: err.message.slice(0, 200) })
    return json({ error: err.code, detail: err.message.slice(0, 200) }, err.status)
  }
})

export type { ItemRow, SessionRow }
