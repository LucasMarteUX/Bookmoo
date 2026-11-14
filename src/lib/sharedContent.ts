// Conteúdo de IA compartilhado entre as pessoas (explicações de palavras e histórias).
// O primeiro que gera vale para todos e poupa chamadas de IA; notas pessoais nunca entram aqui.
import { supabase } from '@/lib/supabase'

export type SharedKind = 'explain' | 'variant-story'
export const sharedKey = (...parts: (string | undefined)[]) => parts.map(p => (p ?? '').trim().toLowerCase()).join('|').slice(0, 300)

export async function getShared<T>(kind: SharedKind, key: string): Promise<T | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.from('shared_content').select('content').eq('kind', kind).eq('key', key).maybeSingle()
    return (data?.content as T) ?? null
  } catch { return null }
}

export async function putShared(kind: SharedKind, key: string, content: unknown): Promise<void> {
  if (!supabase) return
  try {
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user?.id
    if (!userId) return
    // Primeiro a gerar vale: conflito é ignorado.
    await supabase.from('shared_content').upsert({ kind, key, content, created_by: userId }, { onConflict: 'kind,key', ignoreDuplicates: true })
  } catch { /* compartilhar é opcional */ }
}
