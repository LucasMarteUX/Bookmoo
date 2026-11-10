import { supabase } from '@/lib/supabase'

export type EnglishLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export type CommunityProfile = {
  userId: string
  username: string
  bio: string
  englishLevel: EnglishLevel | ''
  isPublic: boolean
  instagram: string
  x: string
  website: string
  reading: { title: string; progress: number }[]
  stats: { points?: number; streak?: number; words?: number }
  avatarUrl?: string
}

const LEVELS: EnglishLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export function emptyProfile(userId: string): CommunityProfile {
  return { userId, username: '', bio: '', englishLevel: '', isPublic: false, instagram: '', x: '', website: '', reading: [], stats: {} }
}

function fromRow(row: Record<string, unknown>, avatarUrl?: string): CommunityProfile {
  const socials = row.socials && typeof row.socials === 'object' ? row.socials as Record<string, string> : {}
  const level = LEVELS.includes(row.english_level as EnglishLevel) ? row.english_level as EnglishLevel : ''
  return {
    userId: String(row.user_id),
    username: typeof row.username === 'string' ? row.username : '',
    bio: typeof row.bio === 'string' ? row.bio : '',
    englishLevel: level,
    isPublic: row.is_public === true,
    instagram: socials.instagram ?? '',
    x: socials.x ?? '',
    website: socials.website ?? '',
    reading: Array.isArray(row.reading) ? row.reading as CommunityProfile['reading'] : [],
    stats: row.stats && typeof row.stats === 'object' ? row.stats as CommunityProfile['stats'] : {},
    avatarUrl,
  }
}

export async function loadOwnProfile(userId: string, avatarUrl?: string): Promise<CommunityProfile> {
  if (!supabase) return { ...emptyProfile(userId), avatarUrl }
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error || !data) return { ...emptyProfile(userId), avatarUrl }
  return fromRow(data, avatarUrl)
}

export async function saveOwnProfile(profile: CommunityProfile): Promise<void> {
  if (!supabase) throw new Error('Sem conexão.')
  const { error } = await supabase.from('profiles').upsert({
    user_id: profile.userId,
    username: profile.username.trim() || null,
    bio: profile.bio.trim() || null,
    english_level: profile.englishLevel || null,
    is_public: profile.isPublic,
    socials: { instagram: profile.instagram.trim(), x: profile.x.trim(), website: profile.website.trim() },
    reading: profile.reading,
    stats: profile.stats,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function listPublicProfiles(): Promise<CommunityProfile[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('profiles').select('*').eq('is_public', true).order('updated_at', { ascending: false }).limit(40)
  if (error) return []
  return (data ?? []).map(row => fromRow(row))
}

export async function loadPublicProfile(userId: string): Promise<CommunityProfile | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error || !data || data.is_public !== true) return null
  return fromRow(data)
}
