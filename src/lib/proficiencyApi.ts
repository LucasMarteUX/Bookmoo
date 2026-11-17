// Cliente da função `proficiency` (English Proficiency Test, docs/PROVA-DE-PROFICIENCIA.md).
// O app só mostra e envia: gabarito, roteiros de áudio, cronômetros e notas ficam no servidor.
import { supabase } from '@/lib/supabase'

export class ProfError extends Error {
  constructor(public code: string, public extra: Record<string, unknown> = {}) { super(code) }
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new ProfError('supabase_not_configured')
  const { data, error } = await supabase.functions.invoke('proficiency', { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const j = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) as Record<string, unknown> | null : null
    throw new ProfError(String(j?.error ?? 'request_failed'), j ?? {})
  }
  return data as T
}

export type Section = 'reading' | 'listening' | 'writing' | 'speaking'
export type Module = 'router' | 'easy' | 'hard' | 'fixed'
export type TaskType =
  | 'complete_words' | 'daily_life' | 'academic_passage'
  | 'choose_response' | 'conversation' | 'announcement' | 'academic_talk'
  | 'build_sentence' | 'write_email' | 'academic_discussion'
  | 'listen_repeat' | 'interview'

export type Choice = { id: string; prompt: string; options: string[] }
export type Segment = { t: 'text'; v: string } | { t: 'gap'; id: string; prefix: string; len: number }
export type ExamItem = {
  sid: string; task: TaskType; position: number; points: number
  content: Record<string, unknown>
  openedAt: string | null; deadlineAt: string | null; plays: Record<string, number>
}
export type SessionInfo = {
  id: string; status: 'active' | 'scoring' | 'scored' | 'inconclusive' | 'abandoned' | 'failed'
  section: Section | 'done'; module: Module | 'done'; deadline: string; sectionEnd: string | null; serverNow: string
  startsAt: string; pending: boolean
  sections: { id: Section; seconds: number; done: boolean }[]
}
export type ExamState = { session: SessionInfo; items: ExamItem[]; responses: Record<string, Record<string, Record<string, unknown>>> }

export type HistoryRow = { id: string; status: 'final' | 'inconclusive'; overall: number | null; cefr: string | null; created_at: string; bands: Partial<Record<Section, number | null>> }
export type Overview = {
  premium: boolean; available: boolean; nextAvailableAt: string | null; minPlanRank: number
  monthUsed: number; monthLimit: number; monthBest: number | null
  active: { id: string; section: string; module: string; started_at: string; status: string } | null
  /** Prova concluída que ainda está em correção (não impede uma nova tentativa). */
  scoring: { id: string; started_at: string; submitted_at: string | null } | null
  history: HistoryRow[]
  blueprint: { version: string; sections: { id: Section; seconds: number }[] }
}

export type SkillReport = { summary: string; strengths: string[]; improve: string[]; next_steps: string[] }
export type SectionResult = {
  band: number | null; cefr: string | null; status: 'ok' | 'inconclusive'; reason?: string | null
  breakdown: Record<string, { correct: number; total: number }>
  evals?: { task: string; score: number; rationale: string; strengths: string[]; improve: string[]; evidence: string[] }[]
}
export type Result = {
  session_id: string; status: 'final' | 'inconclusive'; overall: number | null; cefr: string | null; created_at: string; started_at: string
  sections: Record<Section, SectionResult>
  report: { overall: string; skills: Record<Section, SkillReport>; disclaimer: string }
  path: Partial<Record<'reading' | 'listening', { module: 'easy' | 'hard' | null }>>
  scoring_version: string; rubric_version: string
}

export const proficiency = {
  overview: () => call<Overview>({ action: 'overview' }),
  start: (checks: { mic: boolean; audio: boolean }, characterId?: string) => call<ExamState>({ action: 'start', consent: true, checks, characterId, ua: navigator.userAgent }),
  state: (sessionId: string) => call<ExamState>({ action: 'state', sessionId }),
  open: (sessionId: string, sid: string) => call<ExamState>({ action: 'open', sessionId, sid }),
  save: (sessionId: string, sid: string, part: string, response: Record<string, unknown>) => call<{ ok: true; savedAt: string }>({ action: 'save', sessionId, sid, part, response }),
  audio: (sessionId: string, sid: string, key = 'main') => call<{ url: string; durationMs: number | null; mime: string }>({ action: 'audio', sessionId, sid, key }),
  upload: (sessionId: string, sid: string, part: string, mime: string) => call<{ path: string; token: string; signedUrl: string }>({ action: 'upload', sessionId, sid, part, mime }),
  begin: (sessionId: string, section: string) => call<ExamState>({ action: 'begin', sessionId, section }),
  advance: (sessionId: string, section: string, module: string) => call<ExamState>({ action: 'advance', sessionId, section, module }),
  result: (sessionId: string) => call<{ status: SessionInfo['status']; result?: Result; submittedAt?: string | null; queued?: boolean }>({ action: 'result', sessionId }),
  abandon: (sessionId: string) => call<{ ok: true }>({ action: 'abandon', sessionId }),
}

/** Envia uma gravação para o bucket privado com a URL assinada que a função criou. */
export async function uploadRecording(sessionId: string, sid: string, part: string, blob: Blob): Promise<string> {
  // O bucket aceita o tipo sem parâmetros ('audio/webm', não 'audio/webm;codecs=opus').
  const mime = (blob.type || 'audio/webm').split(';')[0].trim()
  const up = await proficiency.upload(sessionId, sid, part, mime)
  const { error } = await supabase!.storage.from('proficiency-recordings').uploadToSignedUrl(up.path, up.token, blob, { contentType: mime, upsert: true })
  if (error) throw new ProfError('upload_failed')
  return up.path
}

// ---------------------------------------------------------------------------------------------------------------------
// Admin
export const profAdmin = {
  overview: () => call<AdminOverview>({ action: 'admin_overview' }),
  createVersion: (code: string, cloneFrom?: string) => call<{ version: AdminVersion }>({ action: 'admin_version_create', code, cloneFrom }),
  publish: (id: string) => call<{ ok: true }>({ action: 'admin_version_publish', id }),
  archive: (id: string) => call<{ ok: true }>({ action: 'admin_version_archive', id }),
  items: (versionId: string, f: { task?: string; stage?: string; status?: string } = {}) => call<{ items: AdminItem[] }>({ action: 'admin_items', versionId, ...f }),
  review: (ids: string[], status: 'approved' | 'rejected' | 'review' | 'retired', note?: string) => call<{ updated: number; skipped: number }>({ action: 'admin_item_review', ids, status, note }),
  update: (id: string, patch: Record<string, unknown>) => call<{ ok: true }>({ action: 'admin_item_update', id, ...patch }),
  generate: (versionId: string, task: TaskType, stage: string, count: number) => call<{ created: number; rejected: number }>({ action: 'admin_generate', versionId, task, stage, count }),
  generations: (versionId: string) => call<{ generations: Record<string, unknown>[] }>({ action: 'admin_generations', versionId }),
  audioTodo: (versionId: string) => call<{ todo: AudioTodo[]; total: number }>({ action: 'admin_audio_todo', versionId }),
  audioUpload: (itemId: string, key: string) => call<{ path: string; token: string; signedUrl: string }>({ action: 'admin_audio_upload', itemId, key }),
  audioRegister: (p: { itemId: string; key: string; path: string; durationMs: number; voice: string; hash: string }) => call<{ ok: true }>({ action: 'admin_audio_register', ...p }),
  audioUrl: (itemId: string, key: string) => call<{ url: string | null }>({ action: 'admin_audio_url', itemId, key }),
  sessions: () => call<{ sessions: AdminSession[] }>({ action: 'admin_sessions' }),
  session: (id: string) => call<Record<string, unknown>>({ action: 'admin_session', id }),
  rescore: (id: string) => call<{ ok: true }>({ action: 'admin_rescore', id }),
  purge: (days?: number) => call<{ removed: number; days: number }>({ action: 'admin_purge_recordings', days }),
  settings: (minPlanRank?: number) => call<{ minPlanRank: number }>({ action: 'admin_settings', minPlanRank }),
}

export type AdminVersion = { id: string; code: string; status: 'draft' | 'published' | 'archived'; created_at: string; published_at: string | null; notes: string | null; blueprint_version: string; difficulty_model: string; rubric_version: string }
export type AdminOverview = {
  versions: AdminVersion[]
  counts: Record<string, Record<string, Record<string, number>>>
  costs: Record<string, { calls: number; usd: number; failed: number }>
  sessions: Record<string, number>
  shortfalls: Record<string, string[]>
  tasks: Record<TaskType, { section: Section; points: number; audio: boolean; ai: boolean; label: string }>
}
export type AdminItem = {
  id: string; section: Section; task_type: TaskType; stage: string; difficulty: number; cefr: string | null; points: number
  content: Record<string, unknown>; answer: Record<string, unknown>; script: Record<string, unknown> | null; rubric: string | null
  status: 'draft' | 'review' | 'approved' | 'rejected' | 'retired'; source: string
  validation: { issues?: string[]; reviewer?: string; key_check?: boolean; topic?: string; reviewer_cefr?: string } | null
  review_note: string | null; created_at: string; audio: { key: string; ready: boolean; stale: boolean }[]
}
export type AudioTodo = { itemId: string; task: TaskType; status: string; key: string; lines: { voice: string; text: string; speaker?: string }[]; hash: string }
export type AdminSession = {
  id: string; user_id: string; status: string; section: string; module: string; started_at: string; submitted_at: string | null; scored_at: string | null
  scoring_attempts: number; error: string | null; person: { display_name: string | null; handle: string | null } | null
  result: { overall: number | null; cefr: string | null; status: string } | null
  route: Record<string, { module?: string; pct?: number } | null>
}

// ---------------------------------------------------------------------------------------------------------------------
// Textos compartilhados
export const SECTION_LABEL: Record<Section, { en: string; pt: string }> = {
  reading: { en: 'Reading', pt: 'Leitura' },
  listening: { en: 'Listening', pt: 'Compreensão auditiva' },
  writing: { en: 'Writing', pt: 'Escrita' },
  speaking: { en: 'Speaking', pt: 'Fala' },
}
export const TASK_LABEL: Record<TaskType, string> = {
  complete_words: 'Complete the Words', daily_life: 'Read in Daily Life', academic_passage: 'Read an Academic Passage',
  choose_response: 'Listen and Choose a Response', conversation: 'Listen to a Conversation', announcement: 'Listen to an Announcement', academic_talk: 'Listen to an Academic Talk',
  build_sentence: 'Build a Sentence', write_email: 'Write an Email', academic_discussion: 'Write for an Academic Discussion',
  listen_repeat: 'Listen and Repeat', interview: 'Take an Interview',
}
export const SECTION_PLAN: Record<Section, { items: number; minutes: number; tasks: TaskType[] }> = {
  reading: { items: 50, minutes: 30, tasks: ['complete_words', 'daily_life', 'academic_passage'] },
  listening: { items: 47, minutes: 29, tasks: ['choose_response', 'conversation', 'announcement', 'academic_talk'] },
  writing: { items: 12, minutes: 23, tasks: ['build_sentence', 'write_email', 'academic_discussion'] },
  speaking: { items: 11, minutes: 8, tasks: ['listen_repeat', 'interview'] },
}
export const BAND_CEFR: { band: string; cefr: string; pt: string }[] = [
  { band: '6', cefr: 'C2', pt: 'Proficiente' },
  { band: '5 – 5,5', cefr: 'C1', pt: 'Avançado' },
  { band: '4 – 4,5', cefr: 'B2', pt: 'Intermediário superior' },
  { band: '3 – 3,5', cefr: 'B1', pt: 'Intermediário' },
  { band: '2 – 2,5', cefr: 'A2', pt: 'Básico' },
  { band: '1 – 1,5', cefr: 'A1', pt: 'Iniciante' },
]
export const fmtBand = (b: number | null | undefined) => b == null ? '–' : b.toLocaleString('pt-BR', { minimumFractionDigits: b % 1 ? 1 : 0, maximumFractionDigits: 1 })

export function profErrorText(e: unknown): string {
  const code = e instanceof ProfError ? e.code : 'request_failed'
  const at = e instanceof ProfError && typeof e.extra.availableAt === 'string' ? new Date(e.extra.availableAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) : ''
  const map: Record<string, string> = {
    plan_required: 'A prova de proficiência faz parte do plano Pro.',
    not_available: 'A prova está em preparação e ainda não está disponível. Tente de novo em breve.',
    cooldown: `Você já usou as duas tentativas deste mês. A próxima fica disponível em ${at}.`,
    consent_required: 'É preciso concordar com a gravação da voz para fazer a prova.',
    checks_required: 'Teste o áudio e o microfone antes de começar.',
    time_up: 'O tempo desta parte acabou. Suas respostas salvas foram mantidas.',
    no_replays: 'Este áudio só pode ser ouvido uma vez.',
    session_closed: 'Esta prova já foi encerrada.',
    item_not_current: 'Esta parte da prova já foi encerrada.',
    upload_failed: 'Não conseguimos enviar a gravação. Verifique a conexão.',
    already_active: 'Você já tem uma prova em andamento.',
    ai_paused: 'A avaliação está pausada por alguns minutos. Suas respostas estão salvas.',
  }
  return map[code] ?? 'Algo deu errado. Verifique a conexão e tente de novo.'
}
