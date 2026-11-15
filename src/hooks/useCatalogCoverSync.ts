import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useBookStore } from '@/store/useBookStore'
import { useBookSync } from '@/hooks/useBookSync'

const KEY = 'bookmoo:cover-sync-at'
const EVERY_MS = 6 * 60 * 60 * 1000

/** Assinatura barata de uma capa (tamanho + início e fim), para saber se o catálogo trocou a imagem. */
const sigOf = (s: string) => `${s.length}:${s.slice(24, 64)}${s.slice(-40)}`

/**
 * Livro puxado da galeria guarda uma cópia da capa de quando foi adicionado. Se o catálogo ganha uma capa nova
 * depois, a cópia ficava velha. Aqui, no máximo a cada 6 horas, comparamos a miniatura do catálogo com a que
 * já foi sincronizada (`coverSig`) e baixamos a capa completa só dos livros que mudaram.
 * Não mexe em progresso, vocabulário nem páginas.
 */
export function useCatalogCoverSync() {
  const { session, hasSupabase } = useAuth()
  const { updateBookAndSync } = useBookSync()
  const userId = session?.user?.id
  const ids = useBookStore(s => s.books.filter(b => b.catalogId).map(b => b.catalogId).join(','))

  useEffect(() => {
    if (!hasSupabase || !supabase || !userId || !ids) return
    try { if (Date.now() - Number(localStorage.getItem(KEY) || 0) < EVERY_MS) return } catch { /* sem storage: segue */ }
    let cancelled = false
    ;(async () => {
      const client = supabase!
      const catalogIds = Array.from(new Set(ids.split(',').filter(Boolean)))
      const { data, error } = await client.from('catalog_books').select('id, cover_thumb').in('id', catalogIds)
      if (error || !data || cancelled) return
      for (const row of data as { id: string; cover_thumb: string | null }[]) {
        if (!row.cover_thumb) continue
        const sig = sigOf(row.cover_thumb)
        const stale = useBookStore.getState().books.filter(b => b.catalogId === row.id && b.coverSig !== sig)
        if (!stale.length) continue
        const full = await client.from('catalog_books').select('cover_data').eq('id', row.id).maybeSingle()
        const cover = full.data?.cover_data as string | undefined
        if (!cover || cancelled) continue
        for (const b of stale) {
          updateBookAndSync(b.id, { coverData: cover })
          useBookStore.getState().updateBook(b.id, { coverSig: sig }) // só local: não vai para o banco
        }
      }
      try { localStorage.setItem(KEY, String(Date.now())) } catch { /* ok */ }
    })().catch(e => console.error('Cover sync', e))
    return () => { cancelled = true }
  }, [hasSupabase, userId, ids, updateBookAndSync])
}
