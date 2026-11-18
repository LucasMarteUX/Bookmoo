// Linguagem corporal dos tutores: a postura da cabeça e do olhar acompanha o que o rosto mostra e o momento da conversa.
// O estudo completo (regras e de onde elas vêm) está em docs/MOVIMENTO-PERSONAGENS.md. Resumo do que vira código aqui:
//
// - Cada emoção tem uma postura: alegria levanta um pouco o queixo, tristeza e timidez baixam a cabeça e o olhar, surpresa
//   recua a cabeça num tranco rápido, raiva abaixa o queixo e fica firme, dúvida inclina a cabeça para um lado.
// - A postura é lida do rosto que está DESENHADO (pesos das expressões no player), então qualquer caminho que mostre uma
//   expressão (fala, toque, convites, diretor de gestos) leva a cabeça junto, sem ninguém precisar lembrar de chamar.
// - Movimento de mola (sobe, passa um pouco e assenta), não de linha reta: é o que tira o ar de robô. Surpresa tem mola
//   mais dura (rápida), tristeza mais mole (lenta).
// - Inclinações de lado escolhem um lado quando começam (e alternam entre uma vez e outra), para não "puxar" sempre igual.
// - Cada gesto do corpo também pede uma cabeça própria (mão no queixo inclina para a mão, abertura levanta o queixo...).
// - Ouvindo: cabeça levemente inclinada e acenos curtos de vez em quando ("estou te ouvindo").
// - Pensando: queixo um pouco para cima e de lado, devagar.
// - Falando: "batidas" na fala, um aceno pequeno quando a voz volta depois de uma pausa (início de frase, palavra forte),
//   com força conforme a energia da emoção. Nada de balançar em toda sílaba.
//
// Base sempre parada: nos personagens com o corpo no grupo da cabeça (Bia, Yuno, Yuri) toda inclinação de lado é compensada
// com um deslocamento, então o giro é em volta da base, embaixo. No Luck só a cabeça se mexe (o corpo tem grupo próprio).
import type { Player } from '@livliv-dev/player'
import type { VoiceState } from '@/hooks/useVoiceConversation'
import type { Mood } from '@/components/voice/TutorAvatar'
import type { BodyGesture } from '@/lib/livliv/bodyGestures'

/** Postura em graus (pitch: + para cima; roll: + topo para a direita da tela; yaw: + vira para a direita) e olhar. */
type Pose = { pitch: number; roll: number; yaw: number; gazeY: number; energy: number; stiff: number; sided?: boolean }

const ZERO: Pose = { pitch: 0, roll: 0, yaw: 0, gazeY: 0, energy: 1, stiff: 1 }

// Por expressão do modelo (o que está desenhado). `sided`: a inclinação vai para o lado sorteado quando a emoção começa.
const EXPR_POSE: Record<string, Pose> = {
  smile: { pitch: 2.5, roll: 2, yaw: 0, gazeY: 0.05, energy: 1.35, stiff: 1, sided: true },
  surprised: { pitch: 4, roll: 0, yaw: 0, gazeY: 0.1, energy: 1.2, stiff: 2.2 },
  sad: { pitch: -5, roll: 3, yaw: 0, gazeY: -0.3, energy: 0.55, stiff: 0.55, sided: true },
  angry: { pitch: -3, roll: 0, yaw: 0, gazeY: 0, energy: 1.1, stiff: 1.4 },
  shy: { pitch: -4.5, roll: 4, yaw: 3, gazeY: -0.35, energy: 0.6, stiff: 0.8, sided: true },
}
// Humores sem expressão própria no modelo.
const MOOD_POSE: Partial<Record<Mood, Pose>> = {
  confused: { pitch: 0.5, roll: 5, yaw: 2, gazeY: 0.15, energy: 0.8, stiff: 0.9, sided: true },
}
// Cada gesto pede uma cabeça própria: mão no queixo baixa e inclina para a mão com o olhar para cima; ênfase abaixa o queixo
// (firmeza); abertura levanta (acolhe); explicativo inclina um pouco para o lado da mão levantada; conclusão assenta.
const GESTURE_POSE: Partial<Record<BodyGesture, Pose>> = {
  reflexao: { pitch: -2, roll: -4, yaw: -2, gazeY: 0.3, energy: 0.7, stiff: 0.7 },
  enfase: { pitch: -2, roll: 0, yaw: 0, gazeY: 0, energy: 1.25, stiff: 1.3 },
  abertura: { pitch: 2.5, roll: 0, yaw: 0, gazeY: 0.05, energy: 1.15, stiff: 1 },
  explicativo: { pitch: 0.5, roll: 2.5, yaw: 1.5, gazeY: 0, energy: 1.1, stiff: 1 },
  conclusao: { pitch: -1.5, roll: 0, yaw: 0, gazeY: -0.05, energy: 0.85, stiff: 0.9 },
}
// Pelo momento da conversa.
const STATE_POSE: Partial<Record<VoiceState, Pose>> = {
  listening: { pitch: -0.5, roll: 2.5, yaw: 0, gazeY: 0, energy: 0.9, stiff: 0.7, sided: true },
  thinking: { pitch: 3, roll: 3, yaw: 2.5, gazeY: 0, energy: 0.7, stiff: 0.6, sided: true },
}

/** Mola amortecida (passa um pouco do alvo e assenta). `k`: rigidez; `zeta` < 1 deixa o leve "passou e voltou". */
class Spring {
  x = 0
  v = 0
  step(target: number, dt: number, k: number, zeta = 0.72) {
    const w = Math.sqrt(k)
    const a = w * w * (target - this.x) - 2 * zeta * w * this.v
    this.v += a * dt
    this.x += this.v * dt
    return this.x
  }
}

type Hooks = {
  state: () => VoiceState
  /** Humor sem expressão desenhada (ex.: dúvida), ou null. */
  mood: () => Mood | null
  /** Gesto do corpo agora (personagens com gestos). */
  gesture?: () => BodyGesture
  /** Corpo no grupo da cabeça: inclinação compensada para a base não sair do lugar. */
  fixedBase: () => boolean
  /** Deslocamento por grau para a base ficar parada (medido por personagem). */
  basePerDeg: () => number
  /** Desligado (ex.: Bia pintada, com a cabeça nos adaptadores dela). */
  off?: () => boolean
}

export function installBodyLanguage(player: Player, h: Hooks): () => void {
  const pitch = new Spring(), roll = new Spring(), yaw = new Spring(), gaze = new Spring()
  // Lado de cada inclinação, sorteado quando ela começa (e alternando).
  const side: Record<string, number> = {}
  const active: Record<string, boolean> = {}
  let lastSide = 1
  const sideOf = (key: string, w: number) => {
    if (w > 0.25 && !active[key]) { active[key] = true; lastSide = -lastSide; side[key] = Math.random() < 0.7 ? lastSide : -lastSide }
    if (w < 0.1) active[key] = false
    return side[key] ?? 1
  }
  // Batidas da fala e acenos de quem ouve.
  let mouthLow = 0, lastBeat = 0, nextNod = 0
  let prevState: VoiceState | null = null
  let prevGesture: BodyGesture | null = null

  return player.use({
    order: 12, // depois do lip sync (10) e da voz do navegador (11): a boca deste quadro já está decidida
    update(frame) {
      if (h.off?.()) return
      const dt = Math.min(0.05, frame.dt)
      const now = performance.now()
      const state = h.state()
      if (state !== prevState) { prevState = state; nextNod = now + 2500 + Math.random() * 2500 }

      // Alvo = soma das posturas ativas, pesadas pelo quanto cada uma aparece.
      const shown = (player as unknown as { shownExpr?: Record<string, number> }).shownExpr ?? {}
      let tp = 0, tr = 0, ty = 0, tg = 0, energy = 1, stiff = 1, wsum = 0
      const add = (key: string, p: Pose, w: number) => {
        if (w < 0.02) { if (p.sided) sideOf(key, 0); return }
        const s = p.sided ? sideOf(key, w) : 1
        tp += p.pitch * w; tr += p.roll * w * s; ty += p.yaw * w * s; tg += p.gazeY * w
        energy += (p.energy - 1) * w; stiff += (p.stiff - 1) * w; wsum += w
      }
      for (const [id, p] of Object.entries(EXPR_POSE)) add('e:' + id, p, Math.min(1, shown[id] ?? 0))
      const m = h.mood()
      const mp = m ? MOOD_POSE[m] : undefined
      if (mp) add('m:' + m, mp, 1)
      // Troca de gesto: a troca do desenho do corpo é instantânea (exigência do rig: sem corpos sobrepostos), então ela acontece
      // dentro de um movimento, um pequeno assentar da cabeça no mesmo instante, que disfarça o corte e deixa a passagem suave.
      const gNow = h.gesture?.() ?? null
      if (gNow !== prevGesture) {
        if (prevGesture !== null) { pitch.v -= 14; roll.v += (Math.random() < 0.5 ? -1 : 1) * 6 }
        prevGesture = gNow
      }
      // O gesto soma com a emoção pela metade (a emoção manda no rosto; o gesto, na intenção).
      const g = h.gesture?.()
      const gp = g ? GESTURE_POSE[g] : undefined
      if (gp) add('g:' + g, gp, 0.6)
      const sp = STATE_POSE[state]
      // A postura do momento (ouvir, pensar) cede para a emoção quando há uma.
      if (sp) add('s:' + state, sp, Math.max(0, 1 - wsum))
      else sideOf('s:listening', 0), sideOf('s:thinking', 0)
      stiff = Math.max(0.4, stiff)

      // Ouvindo: um aceno curto de vez em quando (3,5 a 7 s), como quem diz "aham".
      if (state === 'listening' && now > nextNod) {
        nextNod = now + 3500 + Math.random() * 3500
        pitch.v -= 22 + Math.random() * 10
      }
      // Falando: a voz volta depois de uma pausa (boca fechada por uns 180 ms e abre forte) = batida, aceno pequeno.
      const mouth = (frame.params as unknown as Record<string, number>).mouthOpen ?? 0
      if (mouth < 0.12) mouthLow += dt
      else {
        if (state === 'speaking' && mouth > 0.35 && mouthLow > 0.18 && now - lastBeat > 700) {
          lastBeat = now
          pitch.v -= (16 + Math.random() * 10) * Math.max(0.5, energy)
          if (Math.random() < 0.35) roll.v += (Math.random() < 0.5 ? -1 : 1) * 10 * energy
        }
        mouthLow = 0
      }

      const k = 38 * stiff
      const dp = pitch.step(tp, dt, k)
      const dr = roll.step(tr, dt, k * 0.8)
      const dy = yaw.step(ty, dt, k * 0.8)
      const dg = gaze.step(tg, dt, k * 1.4, 0.9)
      if (Math.abs(dp) + Math.abs(dr) + Math.abs(dy) + Math.abs(dg) < 0.002) return
      const pr = frame.params as unknown as Record<string, number>
      pr.angleY = (pr.angleY ?? 0) + dp
      pr.angleZ = (pr.angleZ ?? 0) + dr
      pr.angleX = (pr.angleX ?? 0) + dy
      pr.eyeBallY = Math.max(-1, Math.min(1, (pr.eyeBallY ?? 0) + dg))
      if (h.fixedBase()) frame.move.x += h.basePerDeg() * dr
    },
  })
}
