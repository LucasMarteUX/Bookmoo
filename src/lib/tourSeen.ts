// Tutoriais já vistos: guardados na CONTA (user_metadata.tour_welcome / tour_book) e também no aparelho. Antes ficavam só no aparelho: em
// outro navegador, outro celular ou com a memória do navegador cheia (o cache dos livros chega perto do limite e a gravação
// falhava calada) o tutorial voltava a aparecer.
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type TourName = 'welcome' | 'book'

const localKey = (name: TourName, id?: string) => (name === 'welcome' ? `bookmoo.tour.v1.${id ?? 'anon'}` : `bookmoo.booktour.v1.${id ?? 'anon'}`)

export function tourSeen(name: TourName, user: User | null | undefined): boolean {
  if ((user?.user_metadata as Record<string, unknown> | undefined)?.[`tour_${name}`]) return true
  try { return !!localStorage.getItem(localKey(name, user?.id)) } catch { return false }
}

/** Marca como visto (já ao abrir: sair no meio, trocar de página ou fechar o app não faz ele voltar). */
export function markTourSeen(name: TourName, user: User | null | undefined) {
  const at = Date.now()
  try { localStorage.setItem(localKey(name, user?.id), String(at)) } catch { /* sem espaço: a conta guarda */ }
  if (!user || !supabase) return
  // Uma chave por tutorial (o Supabase junta só o primeiro nível de user_metadata: um objeto único se sobrescreveria).
  void supabase.auth.updateUser({ data: { [`tour_${name}`]: at } }).catch(() => { /* tenta de novo na próxima vez */ })
}
