// Gestos do corpo (personagens com camadas gesto_*, como a Yuno): ênfase, explicativo, abertura, reflexão e conclusão.
// O rosto (expressão) e o corpo (gesto) são independentes: o rosto mostra a emoção, o corpo acompanha a intenção da frase.
//
// ATENÇÃO: o player 0.5.1 não tem API pública para isso. As camadas gesto_* aparecem por pesos em `player.expr` (alvo) e
// `player.shownExpr` (o que está desenhado agora, suavizado). Trocar o gesto precisa ser atômico, no mesmo quadro: zera o
// anterior e liga o novo nos dois mapas, sem esperar a suavização (senão duas mangas ficam sobrepostas, translúcidas).
// `setExpression()` troca o mapa `expr` inteiro e apagaria o gesto; por isso um driver reaplica o gesto a CADA quadro,
// antes do desenho. Todo o acesso fica neste arquivo; se o player mudar, é só aqui que se mexe.
import type { Player } from '@livliv-dev/player'

export const BODY_GESTURES = ['enfase', 'explicativo', 'abertura', 'reflexao', 'conclusao'] as const
export type BodyGesture = 'neutro' | typeof BODY_GESTURES[number]

type Weights = Record<string, number>
type Internals = { expr?: Weights; shownExpr?: Weights }

export type BodyGestureControl = {
  set(g: BodyGesture): void
  get(): BodyGesture
  dispose(): void
}

export function installBodyGestures(player: Player): BodyGestureControl {
  let current: BodyGesture = 'neutro'
  const apply = () => {
    const p = player as unknown as Internals
    const maps = [p.expr, p.shownExpr].filter((m): m is Weights => !!m)
    for (const g of BODY_GESTURES) {
      const key = 'gesto_' + g
      const w = current === g ? 1 : 0
      for (const m of maps) {
        if (w || key in m) m[key] = w
      }
    }
  }
  const remove = player.use({ order: -100, update: apply })
  return {
    set(g) { current = g; apply() },
    get: () => current,
    dispose: remove,
  }
}

/** Há camadas de gesto neste modelo? */
export function modelHasGestures(player: Player): boolean {
  const info = player.model as unknown as { layers?: { id?: string }[] } | null
  const layers = info?.layers
  if (Array.isArray(layers)) return layers.some(l => String(l.id ?? '').startsWith('gesto_'))
  return true // sem como saber: o adaptador é inofensivo em modelo sem gestos (os pesos não ligam nenhuma camada)
}

// A política (quando e qual gesto) fica em performance.ts.
