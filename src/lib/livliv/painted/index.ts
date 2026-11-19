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
  const removeBrows = installLookDownBrows(player)
  if (import.meta.env.DEV) (window as unknown as { __painted?: unknown }).__painted = natural
  return { dispose: () => { removeBrows(); try { natural.dispose() } catch { /* o puppet já foi descartado */ } } }
}

type Layer = { def: { x: number; y: number; w: number; h: number }; rest: Float32Array | number[]; out: Float32Array | number[]; uploaded: boolean }
type Puppet = { byId: Map<string, Layer>; params: Record<string, number>; deform: (...a: unknown[]) => unknown }

/**
 * Olhando para baixo (mouse embaixo): as sobrancelhas descem alguns pixels, suave. Nos pintados elas são da textura do rosto,
 * então um campo na malha do rosto em volta de cada sobrancelha (acima do olho) desce com `params.lookDown` (0 a 1), e o
 * efeito some antes de chegar no olho (a pele logo acima dele comprime, sem tocar na camada do olho).
 */
function installLookDownBrows(player: Player): () => void {
  const p = (player as unknown as { puppet?: Puppet }).puppet
  const face = p?.byId.get('face')
  const eyes = ['eye_L', 'eye_R'].map(id => p?.byId.get(id)?.def)
  if (!p || !face || eyes.some(e => !e)) return () => {}
  const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
  const field: [number, number][] = []
  for (let i = 0; i < face.rest.length / 2; i++) {
    const x = face.rest[2 * i], y = face.rest[2 * i + 1]
    let w = 0
    for (const e of eyes as Layer['def'][]) {
      const cx = e.x + e.w / 2, cy = e.y - e.h * 0.45
      const g = Math.exp(-(((x - cx) / (e.w * 0.8)) ** 2) - ((y - cy) / (e.h * 0.75)) ** 2)
      w = Math.max(w, g * (1 - smooth(e.y - e.h * 0.25, e.y + 2, y)))
    }
    if (w > 0.01) field.push([i, w])
  }
  const original = p.deform
  p.deform = function (this: unknown, ...args: unknown[]) {
    const out = original.apply(this, args)
    const d = p.params.lookDown || 0
    if (d > 0.005) {
      for (const [i, w] of field) face.out[2 * i + 1] += 4 * d * w
      face.uploaded = false
    }
    return out
  }
  return () => { p.deform = original }
}
