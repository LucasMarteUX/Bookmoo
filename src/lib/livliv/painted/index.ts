// Personagens pintados (rigs aprovados em bia_pintura/, luck_pintura/ yuno_pintura/ gola-v4 e yuri_pintura/ yuri-v1): queixo local, boca contínua, resposta breve da cabeça
// por gesto, reações e movimento secundário (mechas, roupa e, na Bia, brincos). Os módulos .js vieram das entregas, com os
// caminhos de arquivo vindos de `modelBaseURL` (pasta do modelo, terminada em "/") em vez de "./rig/". Cada personagem tem a
// sua versão dos módulos (a do Luck traz acoes.js, repouso próprio de triste/bravo e sorriso na piscada). Usam internos do
// player 0.5.1 (fixado).
import type { Player } from '@livliv-dev/player'
import { configurarQueixoLocal as queixoBia } from './queixo_local.js'
import { configurarMovimentoNatural as movimentoBia } from './movimento_natural.js'
import { configurarQueixoLocal as queixoLuck } from './luck/queixo_local.js'
import { configurarMovimentoNatural as movimentoLuck } from './luck/movimento_natural.js'
import { configurarQueixoLocal as queixoYuno } from './yuno/queixo_local.js'
import { configurarMovimentoNatural as movimentoYuno } from './yuno/movimento_natural.js'
import { configurarQueixoLocal as queixoYuri } from './yuri/queixo_local.js'
import { configurarMovimentoNatural as movimentoYuri } from './yuri/movimento_natural.js'

export type PaintedKind = 'bia' | 'luck' | 'yuno' | 'yuri'
export type PaintedControl = { dispose(): void }

/** Aplica os adaptadores ao puppet recém-carregado. Chame uma vez por carregamento e `dispose()` antes de trocar o modelo. */
export async function setupPainted(kind: PaintedKind, player: Player, modelBaseURL: string): Promise<PaintedControl> {
  const [queixo, movimento] = kind === 'luck' ? [queixoLuck, movimentoLuck] : kind === 'yuno' ? [queixoYuno, movimentoYuno] : kind === 'yuri' ? [queixoYuri, movimentoYuri] : [queixoBia, movimentoBia]
  queixo(player)
  const natural = await movimento(player, modelBaseURL)
  const removeBrows = installFaceActing(player, natural as unknown as Natural)
  if (import.meta.env.DEV) (window as unknown as { __painted?: unknown }).__painted = natural
  return { dispose: () => { removeBrows(); try { natural.dispose() } catch { /* o puppet já foi descartado */ } } }
}

type Layer = { def: { x: number; y: number; w: number; h: number }; rest: Float32Array | number[]; out: Float32Array | number[]; uploaded: boolean }
type Puppet = { byId: Map<string, Layer>; params: Record<string, number>; time: number; deform: (...a: unknown[]) => unknown }
type Natural = { reacoes?: { state?: { active?: string | null; winkAt?: number | null; winkClosed?: () => number } } }

/**
 * Lado da piscadinha: o olho que fecha é o `eye_L` (à esquerda na tela). A cabeça inclina para o lado do olho que pisca,
 * rotacionando de leve, e o tronco vai junto com ela.
 */
const WINK_TILT = 1

/**
 * Atuação do rosto que vale para os quatro pintados (as sobrancelhas e a bochecha são da textura do rosto, então mexem por
 * campos na malha do rosto, fora das camadas do olho):
 * - Olhando para baixo (`params.lookDown`, mouse embaixo): as duas sobrancelhas descem ~4 px.
 * - Piscadinha: a bochecha (maçã do rosto) do olho que fecha sobe e antecipa o olho; a sobrancelha desse lado desce junto com
 *   o fechamento; a cabeça inclina para o lado do olho fechado, abaixa um pouco o queixo e vira de leve, com um balanço vivo
 *   durante a pausa; tudo volta devagar depois que o olho abre (o olho primeiro, a cabeça e a bochecha em seguida).
 */
function installFaceActing(player: Player, natural: Natural): () => void {
  const p = (player as unknown as { puppet?: Puppet }).puppet
  const face = p?.byId.get('face')
  const eyes = ['eye_L', 'eye_R'].map(id => p?.byId.get(id)?.def)
  if (!p || !face || eyes.some(e => !e)) return () => {}
  const [eL, eR] = eyes as Layer['def'][]
  const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
  const browW = (e: Layer['def'], x: number, y: number) =>
    Math.exp(-(((x - (e.x + e.w / 2)) / (e.w * 0.8)) ** 2) - ((y - (e.y - e.h * 0.45)) / (e.h * 0.75)) ** 2) * (1 - smooth(e.y - e.h * 0.25, e.y + 2, y))
  // bochecha: a maçã logo abaixo do olho, subindo também a pele da pálpebra de baixo (some antes do meio do olho)
  const cheekW = (e: Layer['def'], x: number, y: number) =>
    Math.exp(-(((x - (e.x + e.w * 0.5)) / (e.w * 0.75)) ** 2) - ((y - (e.y + e.h * 1.35)) / (e.h * 0.95)) ** 2) * smooth(e.y + e.h * 0.45, e.y + e.h * 0.85, y)
  const brows: [number, number, number][] = [] // [vértice, peso sobrancelha esquerda, direita]
  const cheek: [number, number][] = []
  // sorriso de canto: o canto da boca do lado da piscadinha sobe e abre um pouco; boca e pele em volta com o mesmo campo
  const mouth = p.byId.get('mouth')
  const md = mouth?.def
  const smirkW = (x: number, y: number) => md
    ? Math.exp(-(((x - (md.x + md.w * 0.12)) / (md.w * 0.4)) ** 2) - ((y - (md.y + md.h * 0.5)) / (md.h * 0.75)) ** 2)
    : 0
  const smirkFace: [number, number][] = []
  for (let i = 0; i < face.rest.length / 2; i++) {
    const x = face.rest[2 * i], y = face.rest[2 * i + 1]
    const bl = browW(eL, x, y), br = browW(eR, x, y)
    if (bl > 0.01 || br > 0.01) brows.push([i, bl, br])
    const c = cheekW(eL, x, y)
    if (c > 0.01) cheek.push([i, c])
    const m = smirkW(x, y)
    if (m > 0.01) smirkFace.push([i, m])
  }
  const smirkMouth: [number, number][] = []
  if (mouth) for (let i = 0; i < mouth.rest.length / 2; i++) { const m = smirkW(mouth.rest[2 * i], mouth.rest[2 * i + 1]); if (m > 0.01) smirkMouth.push([i, m]) }
  let env = 0, last = p.time
  // Cabeça viva: nunca 100% parada, e sem balanço de pêndulo. Como uma pessoa: pequenas mudanças de postura, cada uma uma
  // pose leve e coordenada (o rosto gira um pouco, inclina para o mesmo lado do giro como gente faz, o queixo sobe ou desce
  // e o tronco acompanha de leve). A pose chega por uma mola suave (passa um tiquinho e assenta) e por baixo fica a
  // respiração, então sempre há algum movimento.
  // Intervalos pensados (não sorteio puro):
  // - parada: o comum é 3 a 5 s; às vezes um descanso de 5 a 8 s, e a mudança depois dele é um pouco maior (quem fica um
  //   tempo parado se ajeita); às vezes um ajuste curto e pequeno 1,2 a 1,8 s depois de uma mudança (o "assentar"), nunca
  //   dois seguidos;
  // - falando: menores e a cada 2 a 3,5 s, para não brigar com a pose de cada frase da atuação da fala;
  // - depois de uma reação (piscadinha) a próxima mudança espera ela terminar.
  type Step = 'shift' | 'settle' | 'afterRest'
  const pose = { tgt: [0, 0, 0, 0], cur: [0, 0, 0, 0], vel: [0, 0, 0, 0], next: 0, from: 0, step: 'shift' as Step, side: 1 }
  const rnd = (a: number, b: number) => a + Math.random() * (b - a)
  const newPose = (speaking: boolean) => {
    pose.from = p.time
    if (!speaking && pose.step === 'settle') {
      // assentar: um pedacinho a mais na mesma direção da última pose (o corpo terminando de chegar), sem trocar de lado
      pose.tgt = pose.tgt.map(v => v * rnd(1.12, 1.25)) as typeof pose.tgt
      pose.step = 'shift'
      pose.next = p.time + rnd(2.5, 4)
      return
    }
    // mudança de postura: troca de lado na maioria das vezes; depois de um descanso longo ela é um pouco maior
    const amp = speaking ? 0.55 : pose.step === 'afterRest' ? 1.35 : 1
    pose.side = Math.random() < 0.7 ? -pose.side : pose.side
    const yaw = pose.side * rnd(0.7, 2.7) * amp
    const roll = (Math.random() < 0.75 ? 1 : -0.5) * yaw * rnd(0.5, 1) // em geral inclina para o lado do giro
    const pitch = rnd(-1.4, 1) * Math.min(amp, 1)
    pose.tgt = [yaw, pitch, roll, yaw * 0.045]
    if (speaking) { pose.step = 'shift'; pose.next = p.time + rnd(2, 3.5); return }
    // o que vem depois: assentar curto (30%), descanso longo (20%) ou a próxima mudança normal
    const r = Math.random()
    if (r < 0.3) { pose.step = 'settle'; pose.next = p.time + rnd(1.2, 1.8) }
    else if (r < 0.5) { pose.step = 'afterRest'; pose.next = p.time + rnd(5, 8) }
    else { pose.step = 'shift'; pose.next = p.time + rnd(3, 5) }
  }
  const original = p.deform
  p.deform = function (this: unknown, ...args: unknown[]) {
    const dt = Math.max(0, Math.min(0.05, p.time - last)); last = p.time
    const st = natural.reacoes?.state
    const winking = st?.active === 'x_wink' && st.winkAt != null
    // sobe rápido (antecipa o olho, que começa a fechar em 0,06 s) e desce devagar (volta depois do olho abrir)
    if (dt > 0) env += ((winking ? 1 : 0) - env) * (1 - Math.exp(-dt / (winking ? 0.07 : 0.3)))
    const closed = winking ? (st?.winkClosed?.() ?? 0) : 0
    const pr = p.params
    // os movimento_natural recalculam angleZ do zero e somam a atuação (speechYaw/Pitch/Roll): a piscadinha entra por ela
    const saved = [pr.speechYaw, pr.speechPitch, pr.speechRoll, pr.pointerLean]
    {
      // durante uma reação (piscadinha) a postura não muda; a próxima vem um pouco depois de ela acabar
      if (env > 0.05) pose.next = Math.max(pose.next, p.time + 0.8)
      else if (p.time >= pose.next) newPose(!!pr.speaking)
      // mola um pouco abaixo do crítico (ω 4,5, ζ 0,75): chega em ~0,7 s, com um assentar sutil
      // moving hold: durante a pausa a pose continua andando bem devagar na mesma direção (até +15% no fim da pausa), então
      // entre uma mudança e outra a cabeça nunca congela
      const span = Math.max(0.5, pose.next - pose.from)
      const creep = 1 + 0.15 * Math.min(1, Math.max(0, (p.time - pose.from - 0.6) / span))
      if (dt > 0) for (let j = 0; j < 4; j++) {
        pose.vel[j] += (20 * (pose.tgt[j] * creep - pose.cur[j]) - 6.75 * pose.vel[j]) * dt
        pose.cur[j] += pose.vel[j] * dt
      }
      const breath = Math.sin(p.time * 2 * Math.PI / 4.2) // ~14 respirações/min
      // deriva de atenção: giro e inclinação mínimos em ritmos que não se alinham (nunca param os dois juntos)
      const drift = [0.6 * Math.sin(p.time * 2 * Math.PI / 5.3), 0.45 * Math.sin(p.time * 2 * Math.PI / 7.9 + 1.1)]
      pr.speechYaw = (pr.speechYaw || 0) + pose.cur[0] + drift[0]
      pr.speechPitch = (pr.speechPitch || 0) + pose.cur[1] + 0.7 * breath
      pr.speechRoll = (pr.speechRoll || 0) + pose.cur[2] + drift[1]
      pr.pointerLean = (pr.pointerLean || 0) + pose.cur[3]
    }
    if (env > 0.002) {
      const hold = Math.sin(p.time * 2.3) * 0.8 * env // pausa viva: o olho segura, a cabeça não congela
      // a cabeça gira no próprio eixo: o alto vai para o lado do olho que pisca e o queixo para o outro, e o olho que pisca
      // fica mais baixo. Medido na Bia (unidades → px no modelo): giro -6 = alto -8, queixo +6, olho que pisca 5 px mais
      // baixo que o outro; inclinação -6 soma no mesmo sentido; o tronco acompanha só um pouco (ele leva o queixo junto).
      pr.speechRoll = (pr.speechRoll || 0) - WINK_TILT * (6 * env + hold)
      pr.speechYaw = (pr.speechYaw || 0) - WINK_TILT * 9 * env
      pr.speechPitch = (pr.speechPitch || 0) - 4 * env
      pr.pointerLean = (pr.pointerLean || 0) - WINK_TILT * 0.15 * env
    }
    let out
    try { out = original.apply(this, args) } finally { [pr.speechYaw, pr.speechPitch, pr.speechRoll, pr.pointerLean] = saved }
    const d = pr.lookDown || 0
    if (d > 0.005 || env > 0.002) {
      for (const [i, bl, br] of brows) face.out[2 * i + 1] += 4 * d * Math.max(bl, br) + 5 * closed * bl
      for (const [i, c] of cheek) face.out[2 * i + 1] -= 10 * env * c
      if (env > 0.002) {
        for (const [i, m] of smirkFace) { face.out[2 * i] -= 2 * env * m; face.out[2 * i + 1] -= 5 * env * m }
        if (mouth?.out && smirkMouth.length) {
          for (const [i, m] of smirkMouth) { mouth.out[2 * i] -= 2 * env * m; mouth.out[2 * i + 1] -= 5 * env * m }
          mouth.uploaded = false
        }
      }
      face.uploaded = false
    }
    return out
  }
  return () => { p.deform = original }
}
