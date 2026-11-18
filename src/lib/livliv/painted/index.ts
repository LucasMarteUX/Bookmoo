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
  if (import.meta.env.DEV) (window as unknown as { __painted?: unknown }).__painted = natural
  return { dispose: () => { try { natural.dispose() } catch { /* o puppet já foi descartado */ } } }
}
