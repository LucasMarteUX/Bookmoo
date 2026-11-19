// Direção de atuação: quando o corpo faz cada gesto e quando o rosto reage, enquanto o personagem fala.
//
// Estudo de naturalidade (o que se vê em quem fala bem, e que aqui vira regra):
// 1. Gesto não é tique. A pessoa gesticula em ideias novas, ênfase e perguntas, não em toda frase: ~70% das frases ganham
//    gesto, e depois de dois gestos seguidos o corpo descansa.
// 2. Cada pose dura. Mínimo ABSOLUTO de 3 s (nunca menos, nem quando a fala acaba ou o assunto muda); a ênfase é a mais curta
//    (3 a 4,5 s), explicar e acolher ficam 3,6 a 6 s e pensar fica mais (4,5 a 7,5 s). A duração varia um pouco a cada vez.
// 3. Entre uma pose e outra: ou troca direto (continuando a falar, ~40% das vezes) ou volta ao neutro por 1,2 a 3 s.
//    Nunca a mesma pose duas vezes seguidas.
// 4. O rosto lidera: a emoção aparece uns 250 ms antes do corpo. O rosto também tem tempo mínimo (2,5 s entre reações) e o
//    sorriso de olhos fechados é breve; no resto da fala o rosto fica neutro, atento.
// 5. A frase manda: elogio, surpresa, pena, riso, pergunta e agradecimento escolhem rosto e gesto; sem pista, alterna
//    explicar e enfatizar. Uma frase com pista forte pode antecipar a troca, mas só depois dos 3 s da pose atual.
// 6. Ao ouvir ou ficar quieta o corpo volta ao neutro, também respeitando os 3 s da pose em andamento.
// 7. Fronteira de frase manda no corpo (estudos de gesto co-verbal: os limites do gesto coincidem com o começo das frases
//    prosódicas): depois do tempo mínimo, a troca de pose espera a próxima frase começar (até 2,5 s; se não vier, troca).
// 8. Olhar: ao começar uma frase, às vezes desvia um instante (planejando o que dizer) e volta para a pessoa.
import type { Mood } from '@/components/voice/TutorAvatar'
import { moodFromText } from '@/lib/tutorReactions'
import type { BodyGesture, BodyGestureControl } from '@/lib/livliv/bodyGestures'

export const MIN_HOLD_MS = 3000
const MIN_REST_MS = 1200
const MIN_FACE_GAP_MS = 2500

const HOLD: Record<BodyGesture, [number, number]> = {
  neutro: [MIN_REST_MS, 3000],
  enfase: [3000, 4500],
  explicativo: [3600, 6000],
  abertura: [3600, 5500],
  reflexao: [4500, 7500],
  conclusao: [3600, 5500],
}

const MOOD_GESTURES: Partial<Record<Mood, BodyGesture[]>> = {
  happy: ['enfase', 'abertura', 'explicativo'],
  laughing: ['conclusao', 'enfase'],
  excited: ['enfase', 'abertura'],
  surprised: ['explicativo', 'abertura'],
  sad: ['conclusao', 'reflexao'],
  shy: ['reflexao', 'conclusao'],
  confused: ['reflexao', 'explicativo'],
  wink: ['enfase', 'explicativo'], // piscadinha: o indicador ("segredo") ou a mão levantada, mais perto do "OK" de cumplicidade
  angry: ['enfase'],
}
const STRONG: Mood[] = ['happy', 'laughing', 'excited', 'surprised', 'sad', 'confused', 'wink']

const rand = ([a, b]: [number, number]) => a + Math.random() * (b - a)
const pick = <T,>(list: T[], not?: T): T => {
  const pool = list.filter(x => x !== not)
  const l = pool.length ? pool : list
  return l[Math.floor(Math.random() * l.length)]
}

/** Qual gesto combina com a frase. `last` nunca se repete. */
export function gestureForSpeech(text: string, mood: Mood, last: BodyGesture, first: boolean): BodyGesture {
  const t = text.trim()
  const m = moodFromText(t) ?? (mood !== 'neutral' ? mood : null)
  if (first) return pick(['abertura', 'explicativo'], last)
  if (m && MOOD_GESTURES[m]) return pick(MOOD_GESTURES[m]!, last)
  if (t.endsWith('?')) return Math.random() < 0.3 ? 'reflexao' : pick(['explicativo', 'abertura'], last)
  if (t.endsWith('!')) return pick(['enfase', 'abertura'], last)
  if (/\b(thank|thanks|obrigad|bye|see you|goodbye|that'?s all|good luck)\b/i.test(t)) return 'conclusao'
  return pick(['explicativo', 'enfase', 'explicativo'], last)
}

export type DirectorHooks = {
  control: BodyGestureControl
  /** Mostra uma expressão do rosto por `ms` (null = nenhuma). */
  face: (mood: Mood, ms: number) => void
  /** Movimento de cabeça leve junto do gesto. */
  act: (action: 'nod' | 'tilt', amount: number) => void
  text: () => string
  mood: () => Mood
  /** Olhar rápido para o lado: acompanha cada troca de gesto ou de expressão (ninguém olha 100% para a frente enquanto fala). */
  glance?: () => void
}

export class GestureDirector {
  private timer = 0
  private gesture: BodyGesture = 'neutro'
  private since = 0
  private speaking = false
  private active = 0 // gestos seguidos sem descanso
  private lastActive: BodyGesture = 'neutro'
  private lastFace = 0
  private count = 0
  private noSkip = false // depois de um descanso, a próxima frase sempre gesticula (senão o corpo ficaria parado por muito tempo)
  private pending: (() => void) | null = null // troca esperando o começo da próxima frase
  private pendingTimer = 0

  constructor(private h: DirectorHooks) {}

  private now() { return performance.now() }
  private clear() { window.clearTimeout(this.timer); window.clearTimeout(this.pendingTimer); this.pending = null }
  /** Faz `fn` no começo da próxima frase (ou em 2,5 s, se ela não vier). */
  private atNextPhrase(fn: () => void) {
    this.pending = fn
    window.clearTimeout(this.pendingTimer)
    this.pendingTimer = window.setTimeout(() => { const f = this.pending; this.pending = null; f?.() }, 2500)
  }
  /** Quanto falta para a pose atual completar os 3 s mínimos. */
  private lockLeft() { return this.gesture === 'neutro' ? 0 : Math.max(0, MIN_HOLD_MS - (this.now() - this.since)) }

  private apply(g: BodyGesture) {
    if (g === this.gesture) return
    this.gesture = g
    this.since = this.now()
    this.h.control.set(g)
    if (g !== 'neutro') this.lastActive = g
    this.h.glance?.()
  }

  private faceFor(g: BodyGesture, text: string, first: boolean): Mood | null {
    const m = moodFromText(text)
    if (m) return m
    if (first && Math.random() < 0.7) return 'happy'
    if (g === 'conclusao' && /\b(thank|thanks|obrigad|bye|see you|goodbye)\b/i.test(text)) return Math.random() < 0.5 ? 'happy' : 'shy'
    if (g === 'reflexao' && Math.random() < 0.35) return 'shy'
    return null
  }

  /** Rosto primeiro (a emoção chega antes), corpo logo depois. */
  private perform(g: BodyGesture, text: string, first: boolean) {
    const face = this.faceFor(g, text, first)
    const faceOk = face && this.now() - this.lastFace >= MIN_FACE_GAP_MS
    if (faceOk) { this.lastFace = this.now(); this.h.face(face, 2200); this.h.glance?.() }
    window.setTimeout(() => { if (this.speaking || g === 'reflexao') this.apply(g) }, faceOk ? 250 : 0)
    if (g === 'enfase') this.h.act('nod', 0.2)
    else if (g === 'reflexao') this.h.act('tilt', 0.18)
  }

  // --- fala -----------------------------------------------------------------------------------------------------------
  startSpeech() {
    this.speaking = true
    this.clear()
    this.timer = window.setTimeout(() => this.step(), Math.max(350, this.lockLeft()))
  }

  private step() {
    if (!this.speaking) return
    const text = this.h.text()
    const first = this.count === 0
    // Frases curtas e depois de dois gestos seguidos: descansa em vez de gesticular.
    const skip = !first && !this.noSkip && (this.active >= 2 || (text.trim().length < 18 && Math.random() < 0.5) || Math.random() < 0.25)
    if (skip) { this.rest(); return }
    const g = gestureForSpeech(text, this.h.mood(), this.lastActive, first)
    this.noSkip = false
    this.count++
    this.active++
    this.perform(g, text, first)
    const len = Math.min(1.25, Math.max(0.9, 0.9 + text.length / 400))
    const hold = Math.max(MIN_HOLD_MS, rand(HOLD[g]) * len)
    this.clear()
    this.timer = window.setTimeout(() => this.afterHold(), hold + (this.lockLeft() > 0 ? 0 : 0))
  }

  private afterHold() {
    if (!this.speaking) { this.settle(); return }
    // Continua falando: às vezes troca direto de pose, às vezes descansa; as duas coisas no começo da próxima frase.
    if (this.active < 2 && Math.random() < 0.4) this.atNextPhrase(() => this.step())
    else this.atNextPhrase(() => this.rest())
  }

  private rest() {
    this.active = 0
    this.clear()
    const wait = Math.max(this.lockLeft(), 0)
    this.timer = window.setTimeout(() => {
      this.apply('neutro')
      this.noSkip = true
      if (!this.speaking) return
      // Descansa um pouco e volta a gesticular no começo de uma frase.
      this.timer = window.setTimeout(() => this.atNextPhrase(() => this.step()), rand([MIN_REST_MS, 2200]))
    }, wait)
  }

  /** Uma frase nova com pista forte (elogio, surpresa, pena...) pode antecipar a troca, mas só depois dos 3 s da pose. */
  onSentence(text: string) {
    if (!this.speaking) return
    // Começo de frase: às vezes o olhar desvia um instante (planejando a fala) e volta.
    if (Math.random() < 0.3) this.h.glance?.()
    // Troca de pose que estava esperando esta frase.
    if (this.pending) { const f = this.pending; this.pending = null; window.clearTimeout(this.pendingTimer); f(); return }
    if (this.lockLeft() > 0) return
    const m = moodFromText(text)
    if (m && STRONG.includes(m) && this.now() - this.since > 3500) {
      this.clear()
      this.step()
    }
  }

  /** Fim da fala: o corpo volta ao neutro, sem cortar a pose antes dos 3 s. */
  endSpeech() {
    this.speaking = false
    this.settle()
  }

  private settle() {
    this.clear()
    this.active = 0
    this.count = 0
    this.noSkip = false
    this.timer = window.setTimeout(() => this.apply('neutro'), this.lockLeft())
  }

  // --- pensando / ouvindo / chegada ---------------------------------------------------------------------------------------
  think() {
    this.speaking = false
    this.clear()
    this.timer = window.setTimeout(() => this.apply('reflexao'), this.lockLeft())
  }
  listen() { this.endSpeech() }

  /** Chegada: gesto de acolhida (uns 2 s) com um sorriso breve, depois neutro. */
  intro() {
    this.clear()
    this.speaking = false
    this.h.face('happy', 2000)
    this.lastFace = this.now()
    window.setTimeout(() => this.apply('abertura'), 250)
    this.h.act('nod', 0.35)
    this.timer = window.setTimeout(() => this.apply('neutro'), 250 + rand([1900, 2300]))
  }

  // --- espera (antes de a pessoa começar) ----------------------------------------------------------------------------------
  // Na espera o corpo quase não troca de pose: depois da saudação, só a mão no queixo quando ela "pensa" ou "se impacienta"
  // (confusa, triste, brava, tímida) e fica ali até a próxima frase (uns 10 s depois). Nas outras, o corpo volta ao neutro.
  wait(m: Mood) {
    if (this.speaking) return
    const hand: Mood[] = ['confused', 'sad', 'angry', 'shy']
    // Piscadinha: é uma atuação de corpo inteiro, não só o olho. A mão entra junto com o começo da piscada (indicador de
    // "segredo" ou a mão levantada) e volta ao neutro depois que o olho abre e a cabeça assenta.
    if (m === 'wink') {
      this.clear()
      this.timer = window.setTimeout(() => {
        this.apply(pick(MOOD_GESTURES.wink!, this.gesture))
        this.timer = window.setTimeout(() => this.apply('neutro'), rand([2000, 2400]))
      }, Math.max(80, this.lockLeft()))
      return
    }
    if (hand.includes(m)) {
      this.clear()
      this.timer = window.setTimeout(() => {
        this.apply('reflexao')
        this.timer = window.setTimeout(() => this.apply('neutro'), rand([9000, 11000]))
      }, Math.max(450, this.lockLeft()))
    } else if (m !== 'neutral' && this.gesture !== 'neutro') {
      this.clear()
      this.timer = window.setTimeout(() => this.apply('neutro'), this.lockLeft())
    }
  }

  stop() { this.speaking = false; this.clear(); this.gesture = 'neutro'; this.h.control.set('neutro') }
}
