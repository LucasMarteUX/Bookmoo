// Motor da prova: correção objetiva, roteamento adaptativo e nota final. Funções puras e determinísticas (testadas em
// engine.test.ts). Toda nota sai daqui; o app nunca calcula nada.
import { dictationScore, words } from '../placementScore.ts'
import {
  cefrOf, MODULES, ROUTER_THRESHOLD, TASKS, totalPoints,
  type Module, type Section, type TaskType,
} from './blueprint.ts'

// ---------------------------------------------------------------------------------------------------------------------
// Conteúdo das questões (o que fica em prof_items.content / answer / script)
export type Choice = { id: string; prompt: string; options: string[] }
export type Segment = { t: 'text'; v: string } | { t: 'gap'; id: string; prefix: string; len: number }
export type Answer = {
  choices?: Record<string, number>         // pergunta → índice da opção correta
  gaps?: Record<string, string>            // lacuna → letras que faltam
  order?: string[]; alternates?: string[][] // Build a Sentence
  text?: string                            // Listen and Repeat (frase alvo)
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9']/g, '')
const joined = (parts: string[]) => words(parts.join(' ')).join(' ')

/**
 * Nota de uma parte objetiva, de 0 a 1. `part` é o id da lacuna, da pergunta ou "order"/"say".
 * Devolve null quando a parte não é objetiva (vai para a IA).
 */
export function partScore(task: TaskType, answer: Answer, part: string, response: Record<string, unknown> | null | undefined): number | null {
  const r = response ?? {}
  switch (task) {
    case 'complete_words': {
      const want = answer.gaps?.[part]
      if (want == null) return 0
      return norm(r.letters) === norm(want) ? 1 : 0
    }
    case 'daily_life': case 'academic_passage': case 'choose_response': case 'conversation': case 'announcement': case 'academic_talk': {
      const want = answer.choices?.[part]
      if (want == null) return 0
      return Number.isInteger(r.choice) && r.choice === want ? 1 : 0
    }
    case 'build_sentence': {
      const got = Array.isArray(r.order) ? (r.order as unknown[]).map(String) : []
      if (!got.length || !answer.order?.length) return 0
      const ok = [answer.order, ...(answer.alternates ?? [])].some(o => joined(o) === joined(got))
      return ok ? 1 : 0
    }
    case 'listen_repeat': {
      // Precisão da repetição (1 − WER sobre a transcrição do servidor). Abaixo de 20% de acerto conta como não falou.
      const said = String(r.transcript ?? '')
      if (!answer.text) return 0
      return Math.max(0, Math.min(1, dictationScore(answer.text, said) / 100))
    }
    default:
      return null
  }
}

/** Partes pontuadas de uma questão (para contar o máximo e as não respondidas). */
export function scoredParts(task: TaskType, content: Record<string, unknown>): string[] {
  switch (task) {
    case 'complete_words': return ((content.segments ?? []) as Segment[]).filter(s => s.t === 'gap').map(s => (s as { id: string }).id)
    case 'build_sentence': return ['order']
    case 'listen_repeat': return ['say']
    case 'write_email': case 'academic_discussion': return ['text']
    case 'interview': return ((content.questions ?? []) as { id: string }[]).map(q => q.id)
    default: return ((content.questions ?? []) as Choice[]).map(q => q.id)
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Roteamento adaptativo (modelo pdm-1)
export type RouteLog = { correct: number; total: number; pct: number; threshold: number; module: 'easy' | 'hard'; model: string; at: string }

export function route(correct: number, total: number, model = 'pdm-1'): RouteLog {
  const pct = total > 0 ? correct / total : 0
  return { correct, total, pct: Math.round(pct * 1000) / 1000, threshold: ROUTER_THRESHOLD, module: pct >= ROUTER_THRESHOLD ? 'hard' : 'easy', model, at: new Date().toISOString() }
}

const half = (x: number) => Math.round(x * 2) / 2
const clampBand = (x: number) => Math.max(1, Math.min(6, half(x)))

/**
 * Faixa (1–6) de Reading/Listening. O módulo fácil cobre 1–4 e o difícil 2,5–6; dentro do caminho, o desempenho no
 * router pesa 40% e no segundo módulo 60%. Quem vai para o difícil e erra tudo não fica abaixo de 2,5 (ele acertou
 * ≥ 60% do router), e quem vai para o fácil não passa de 4.
 */
export function adaptiveBand(routerPct: number, modulePct: number, module: 'easy' | 'hard'): number {
  const p = 0.4 * routerPct + 0.6 * modulePct
  return module === 'hard' ? clampBand(2.5 + 3.5 * p) : clampBand(1 + 3 * p)
}

/** Writing: Build a Sentence 30% (fração de acertos × 5), e-mail 30% e discussão 40% (rubricas 0–5). */
export function writingBand(bas: number, email: number, discussion: number): number {
  return clampBand(1 + (0.3 * bas * 5 + 0.3 * email + 0.4 * discussion))
}

/** Speaking: Listen and Repeat 40% (precisão média × 5) e entrevista 60% (rubrica 0–5). */
export function speakingBand(repeat: number, interview: number): number {
  return clampBand(1 + (0.4 * repeat * 5 + 0.6 * interview))
}

export function overallBand(bands: number[]): number {
  return clampBand(bands.reduce((a, b) => a + b, 0) / bands.length)
}

export { cefrOf }

// ---------------------------------------------------------------------------------------------------------------------
// Evidência suficiente? (avaliação "inconclusiva")
export type Evidence = { answered: number; total: number; spoken?: number; spokenTotal?: number; words?: number }

/**
 * Regras de evidência mínima (documentadas em docs/PROVA-DE-PROFICIENCIA.md, seção 7):
 * - Reading e Listening: respondeu pelo menos 50% dos itens do caminho.
 * - Writing: respondeu as duas tarefas abertas com pelo menos 30 palavras somadas, ou 50% de tudo.
 * - Speaking: fala reconhecível em pelo menos 5 das 11 gravações.
 */
export function insufficient(section: Section, e: Evidence): string | null {
  const ratio = e.total ? e.answered / e.total : 0
  if (section === 'reading' || section === 'listening') return ratio < 0.5 ? 'few_answers' : null
  if (section === 'writing') return (e.words ?? 0) < 30 && ratio < 0.5 ? 'too_little_writing' : null
  if (section === 'speaking') return (e.spoken ?? 0) < 5 ? 'too_little_speech' : null
  return null
}

export function maxPoints(section: Section, module: Module | null): number {
  if (section === 'reading' || section === 'listening') return totalPoints(section, module ? ['router', module] : ['router'])
  return totalPoints(section, ['fixed'])
}

export const pointsOf = (task: TaskType) => TASKS[task].points
export { MODULES }
