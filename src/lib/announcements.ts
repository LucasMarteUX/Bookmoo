// Avisos enviados pelo admin (aparecem em Notificações e somam no sino).
import { supabase } from '@/lib/supabase'

export type Announcement = { id: string; title: string; body: string | null; link: string | null; at: string; read: boolean }

export async function loadAnnouncements(): Promise<Announcement[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('my_announcements', { p_limit: 30 })
  return error || !Array.isArray(data) ? [] : data as Announcement[]
}

export async function unreadAnnouncements(): Promise<number> {
  if (!supabase) return 0
  const { data, error } = await supabase.rpc('unread_announcements')
  return error || typeof data !== 'number' ? 0 : data
}

export async function markAnnouncementRead(id?: string): Promise<void> {
  if (!supabase) return
  await supabase.rpc('mark_announcement_read', { p_id: id ?? null })
}
