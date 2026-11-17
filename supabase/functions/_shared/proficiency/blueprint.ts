// Estrutura da English Proficiency Test (docs/PROVA-DE-PROFICIENCIA.md). Inspirada no formato público do TOEFL iBT 2026;
// não é oficial nem certificada pela ETS. Este arquivo é a única fonte de contagens, tempos e regras da prova: o servidor
// monta as sessões a partir daqui e o app só mostra o que recebe.

export type Section = 'reading' | 'listening' | 'writing' | 'speaking'
export type Stage = 'router' | 'easy' | 'hard' | 'any'
export type Module = 'router' | 'easy' | 'hard' | 'fixed'
export type TaskType =
  | 'complete_words' | 'daily_life' | 'academic_passage'
  | 'choose_response' | 'conversation' | 'announcement' | 'academic_talk'
  | 'build_sentence' | 'write_email' | 'academic_discussion'
  | 'listen_repeat' | 'interview'

export const SECTIONS: Section[] = ['reading', 'listening', 'writing', 'speaking']
export const BLUEPRINT_VERSION = 'bp-2026.1'
export const DIFFICULTY_MODEL = 'pdm-1'
export const RUBRIC_VERSION = 'rub-1'
export const SCORING_VERSION = 'sc-1'

export const TASKS: Record<TaskType, { section: Section; points: number; audio: boolean; ai: boolean; label: string }> = {
  complete_words: { section: 'reading', points: 10, audio: false, ai: false, label: 'Complete the Words' },
  daily_life: { section: 'reading', points: 2, audio: false, ai: false, label: 'Read in Daily Life' },
  academic_passage: { section: 'reading', points: 5, audio: false, ai: false, label: 'Read an Academic Passage' },
  choose_response: { section: 'listening', points: 1, audio: true, ai: false, label: 'Listen and Choose a Response' },
  conversation: { section: 'listening', points: 2, audio: true, ai: false, label: 'Listen to a Conversation' },
  announcement: { section: 'listening', points: 2, audio: true, ai: false, label: 'Listen to an Announcement' },
  academic_talk: { section: 'listening', points: 4, audio: true, ai: false, label: 'Listen to an Academic Talk' },
  build_sentence: { section: 'writing', points: 1, audio: false, ai: false, label: 'Build a Sentence' },
  write_email: { section: 'writing', points: 1, audio: false, ai: true, label: 'Write an Email' },
  academic_discussion: { section: 'writing', points: 1, audio: false, ai: true, label: 'Write for an Academic Discussion' },
  listen_repeat: { section: 'speaking', points: 1, audio: true, ai: false, label: 'Listen and Repeat' },
  interview: { section: 'speaking', points: 4, audio: true, ai: true, label: 'Take an Interview' },
}

/** Quantas questões de cada tipo entram em cada módulo. Reading e Listening são adaptativos (router + fácil/difícil). */
export type Slot = { task: TaskType; count: number }
export const MODULES: Record<Section, Partial<Record<Module, Slot[]>>> = {
  // 50 itens: router 21 (10 + 6 + 5) e segundo módulo 29 (20 + 4 + 5).
  reading: {
    router: [{ task: 'complete_words', count: 1 }, { task: 'daily_life', count: 3 }, { task: 'academic_passage', count: 1 }],
    easy: [{ task: 'complete_words', count: 2 }, { task: 'daily_life', count: 2 }, { task: 'academic_passage', count: 1 }],
    hard: [{ task: 'complete_words', count: 2 }, { task: 'daily_life', count: 2 }, { task: 'academic_passage', count: 1 }],
  },
  // 47 itens: router 22 (8 + 6 + 4 + 4) e segundo módulo 25 (7 + 6 + 4 + 8).
  listening: {
    router: [{ task: 'choose_response', count: 8 }, { task: 'conversation', count: 3 }, { task: 'announcement', count: 2 }, { task: 'academic_talk', count: 1 }],
    easy: [{ task: 'choose_response', count: 7 }, { task: 'conversation', count: 3 }, { task: 'announcement', count: 2 }, { task: 'academic_talk', count: 2 }],
    hard: [{ task: 'choose_response', count: 7 }, { task: 'conversation', count: 3 }, { task: 'announcement', count: 2 }, { task: 'academic_talk', count: 2 }],
  },
  // 12 itens: 10 frases + e-mail + discussão acadêmica.
  writing: { fixed: [{ task: 'build_sentence', count: 10 }, { task: 'write_email', count: 1 }, { task: 'academic_discussion', count: 1 }] },
  // 11 itens: 7 frases para repetir + entrevista com 4 perguntas.
  speaking: { fixed: [{ task: 'listen_repeat', count: 7 }, { task: 'interview', count: 1 }] },
}

/** Tempo de referência de cada seção (cronômetro rígido), em segundos. */
export const SECTION_SECONDS: Record<Section, number> = { reading: 30 * 60, listening: 29 * 60, writing: 23 * 60, speaking: 8 * 60 }
/** Fração do tempo da seção reservada ao router (o resto vai para o segundo módulo). */
export const ROUTER_TIME_SHARE: Partial<Record<Section, number>> = { reading: 0.42, listening: 0.47 }

/** Cronômetros por tarefa (Writing e Speaking). */
export const TASK_SECONDS = {
  build_sentence_block: 6 * 60,   // as 10 frases juntas
  write_email: 7 * 60,
  academic_discussion: 10 * 60,
  listen_repeat_min: 8,           // gravação de 8 a 12 s conforme o tamanho da frase
  listen_repeat_max: 12,
  interview_answer: 45,
}
/** Tolerância de rede para salvar depois do fim do cronômetro. */
export const GRACE_MS = 8_000
/** Reproduções permitidas: no formato oficial, cada áudio toca uma vez só. */
export const MAX_PLAYS = 1

/** Regra determinística do roteamento (modelo de dificuldade pdm-1): acertou ≥ 60% do router → módulo difícil. */
export const ROUTER_THRESHOLD = 0.6
/** Dificuldade-alvo (escala 1–6) de cada estágio. */
export const STAGE_DIFFICULTY: Record<Exclude<Stage, 'any'>, [number, number]> = { router: [2.5, 4.5], easy: [1, 3.5], hard: [3.5, 6] }

/** Escala 1–6 → CEFR aproximado (uso interno, sem equivalência oficial). */
export function cefrOf(band: number): 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' {
  if (band >= 6) return 'C2'
  if (band >= 5) return 'C1'
  if (band >= 4) return 'B2'
  if (band >= 3) return 'B1'
  if (band >= 2) return 'A2'
  return 'A1'
}

export const totalPoints = (section: Section, path: Module[]) =>
  path.reduce((n, m) => n + (MODULES[section][m] ?? []).reduce((a, s) => a + s.count * TASKS[s.task].points, 0), 0)

/** Planos que dão acesso (posição mínima na lista free → essencial → plus → pro). */
export const DEFAULT_MIN_PLAN_RANK = 3
/** Gravações de fala são apagadas depois deste prazo (LGPD: minimização). */
export const RECORDING_RETENTION_DAYS = 30
