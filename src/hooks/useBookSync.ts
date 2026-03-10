import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useBookStore, type Book } from '@/store/useBookStore'
import { upsertBook } from '@/lib/supabaseSync'

/** After updating the store, persist the book to Supabase if user is logged in. */
export function useBookSync() {
  const { session, hasSupabase } = useAuth()
  const updateBook = useBookStore((s) => s.updateBook)
  const userId = session?.user?.id

  const updateBookAndSync = useCallback(
    (id: string, updates: Partial<Book>) => {
      updateBook(id, updates)
      if (hasSupabase && supabase && userId) {
        const book = useBookStore.getState().books.find((b) => b.id === id)
        if (book) {
          const merged = { ...book, ...updates }
          upsertBook(supabase, userId, merged).catch((e) => console.error('Sync book update', e))
        }
      }
    },
    [updateBook, hasSupabase, userId]
  )

  return { updateBookAndSync }
}
