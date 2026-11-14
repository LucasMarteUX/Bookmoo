import { useEffect, useState } from 'react'
import { listCollections, type Collection } from '@/lib/collections'

/** Grid das páginas de coleções: o banner ocupa 3 colunas de capas (2 no celular). */
export const COLLECTION_GRID = 'grid gap-x-5 gap-y-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
/** No carrossel da galeria: um banner por vez no celular; do tablet para cima, dois por linha ocupando a largura toda do corpo (rolagem se houver mais). */
export const COLLECTION_RAIL_ITEM = 'w-[min(86vw,29.5rem)] sm:w-[calc((100%-1.25rem)/2)] shrink-0 snap-start'

/** Coleções em destaque. `null` enquanto carrega; lista vazia se não houver (ou der erro): a galeria não mostra seção vazia. */
export function useFeaturedCollections(enabled = true): Collection[] | null {
  const [items, setItems] = useState<Collection[] | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    listCollections(true).then(rows => { if (alive) setItems(rows) }).catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
  }, [enabled])
  return items
}
