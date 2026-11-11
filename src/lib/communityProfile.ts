// Perfil social. A linha crua (profiles) é só da dona; outras pessoas leem pelas funções
// community_profile e community_people, que aplicam privacidade, bloqueio e aprovação.
// A pessoa é sempre o id do Supabase Auth.
import { supabase } from '@/lib/supabase'
import type { CefrId } from '@/lib/cefr'

export type Socials = { instagram: string; x: string; website: string }

/** O que a pessoa edita em Configurações. */
export type OwnProfile = {
  userId: string
  handle: string
  name: string
  bio: string
  goal: string
  banner: string
  isPublic: boolean
  showShelf: boolean
  showStats: boolean
  showSocials: boolean
  showStudying: boolean
  shareReading: boolean
  shareProgress: boolean
  shareGoals: boolean
  socials: Socials
  avatarUrl?: string
  coverUrl?: string
}

export type ShelfStatus = 'abandoned' | null

export type ShelfItem = {
  id: string
  title: string
  author?: string
  /** 0–100 */
  progress: number
  lastRead?: string
  finishedAt?: string
  status: ShelfStatus
  favorite: boolean
  catalogId?: string
  /** A capa vem à parte (shelf_cover): uma capa enviada passa de 300 KB. */
  hasCover: boolean
}

export type ProfileStats = {
  points: number
  streak: number
  words: number
  learned: number
  minutes: number
  booksFinished: number
  booksReading: number
  /** Pontos por dia (AAAA-MM-DD), último ano. */
  days: Record<string, number>
}

export type ProfileBlock = 'shelf' | 'stats' | 'socials' | 'studying'

/** Relação de quem vê com a pessoa vista. */
export type Relation = {
  following: boolean
  followPending: boolean
  followsMe: boolean
  friend: 'none' | 'friends' | 'outgoing' | 'incoming'
  blockedByMe: boolean
}

export const NO_RELATION: Relation = { following: false, followPending: false, followsMe: false, friend: 'none', blockedByMe: false }

/** Cartão curto de uma pessoa: feed, comentários, listas e notificações. */
export type Author = {
  userId: string
  handle: string
  name: string
  avatarUrl?: string
  level: CefrId
  banner?: string
}

export type ReadingGoal = { year: number; target: number; done: number }

/** O perfil como chega do servidor. Fechado e sem permissão: `restricted` e só o cartão. */
export type ProfileView = Author & {
  coverUrl?: string
  bio: string
  goal: string
  leveled: boolean
  isPublic: boolean
  isOwner: boolean
  restricted: boolean
  relation: Relation
  joinedAt?: string
  followers: number
  following: number
  friends: number
  posts: number
  reviews: number
  booksRead: number
  booksReading: number
  booksWant: number
  readingGoal?: ReadingGoal
  show: Record<ProfileBlock, boolean>
  socials?: Socials
  stats?: ProfileStats
  shelf?: ShelfItem[]
  studying?: string[]
}

export type PersonCard = Author & {
  bio: string
  isPublic: boolean
  followers: number
  relation: Relation
  isMe: boolean
  commonBooks: number
  reading?: string
  updatedAt?: string
}

export const HANDLE_PATTERN = /^[a-z0-9_.]{3,20}$/
export const BIO_MAX = 280
export const GOAL_MAX = 80
const LEVELS: CefrId[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export class ProfileSaveError extends Error {
  constructor(public code: 'handle_required' | 'handle_invalid' | 'handle_taken' | 'not_migrated' | 'offline' | 'image' | 'unknown') {
    super(code)
  }
}

/** Mantém só o que um @ aceita, enquanto a pessoa digita. */
export function cleanHandle(value: string) {
  return value.toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_.]/g, '').slice(0, 20)
}

export function emptyOwnProfile(userId: string): OwnProfile {
  return {
    userId, handle: '', name: '', bio: '', goal: '', banner: '', isPublic: false,
    showShelf: true, showStats: true, showSocials: true, showStudying: false,
    shareReading: false, shareProgress: false, shareGoals: false,
    socials: { instagram: '', x: '', website: '' },
  }
}

export const text = (value: unknown) => typeof value === 'string' ? value : ''
export const num = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0
const bool = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback
const levelOf = (value: unknown): CefrId => LEVELS.includes(value as CefrId) ? value as CefrId : 'A1'

function socialsOf(value: unknown): Socials {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return { instagram: text(raw.instagram), x: text(raw.x), website: text(raw.website) }
}

export function relationOf(value: unknown): Relation {
  if (!value || typeof value !== 'object') return NO_RELATION
  const raw = value as Record<string, unknown>
  const friend = raw.friend === 'friends' || raw.friend === 'outgoing' || raw.friend === 'incoming' ? raw.friend : 'none'
  return {
    following: raw.following === true,
    followPending: raw.follow_pending === true,
    followsMe: raw.follows_me === true,
    friend,
    blockedByMe: raw.blocked_by_me === true,
  }
}

/** Foto antiga, enviada antes de avatar_url existir: o bucket é público e o caminho é fixo. */
export function avatarOf(row: Record<string, unknown>): string | undefined {
  if (text(row.avatar_url)) return text(row.avatar_url)
  if (!supabase || !row.user_id) return undefined
  const { publicUrl } = supabase.storage.from('avatars').getPublicUrl(`${String(row.user_id)}/avatar.jpg`).data
  return text(row.updated_at) ? `${publicUrl}?v=${encodeURIComponent(text(row.updated_at))}` : publicUrl
}

export function authorOf(value: unknown): Author {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    userId: text(row.user_id),
    handle: text(row.handle),
    name: text(row.name),
    avatarUrl: avatarOf(row),
    level: levelOf(row.level),
    banner: text(row.banner) || undefined,
  }
}

export async function loadOwnProfile(userId: string): Promise<OwnProfile> {
  if (!supabase) return emptyOwnProfile(userId)
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error || !data) return emptyOwnProfile(userId)
  return {
    userId,
    handle: text(data.handle),
    name: text(data.username),
    bio: text(data.bio),
    goal: text(data.goal),
    banner: text(data.banner),
    isPublic: data.is_public === true,
    showShelf: bool(data.show_shelf, true),
    showStats: bool(data.show_stats, true),
    showSocials: bool(data.show_socials, true),
    showStudying: bool(data.show_studying, false),
    shareReading: bool(data.share_reading, false),
    shareProgress: bool(data.share_progress, false),
    shareGoals: bool(data.share_goals, false),
    socials: socialsOf(data.socials),
    avatarUrl: text(data.avatar_url) || undefined,
    coverUrl: text(data.cover_url) || undefined,
  }
}

export async function saveOwnProfile(profile: OwnProfile): Promise<void> {
  if (!supabase) throw new ProfileSaveError('offline')
  const handle = cleanHandle(profile.handle)
  if (handle && !HANDLE_PATTERN.test(handle)) throw new ProfileSaveError('handle_invalid')
  if (profile.isPublic && !handle) throw new ProfileSaveError('handle_required')
  const { error } = await supabase.from('profiles').upsert({
    user_id: profile.userId,
    handle: handle || null,
    username: profile.name.trim() || null,
    bio: profile.bio.trim().slice(0, BIO_MAX) || null,
    goal: profile.goal.trim().slice(0, GOAL_MAX) || null,
    banner: profile.banner || null,
    is_public: profile.isPublic,
    show_shelf: profile.showShelf,
    show_stats: profile.showStats,
    show_socials: profile.showSocials,
    show_studying: profile.showStudying,
    share_reading: profile.shareReading,
    share_progress: profile.shareProgress,
    share_goals: profile.shareGoals,
    socials: {
      instagram: profile.socials.instagram.trim(),
      x: profile.socials.x.trim(),
      website: profile.socials.website.trim(),
    },
    avatar_url: profile.avatarUrl ?? null,
    cover_url: profile.coverUrl ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (!error) return
  if (error.code === '23505') throw new ProfileSaveError('handle_taken')
  if (error.code === '23514') throw new ProfileSaveError(handle ? 'handle_invalid' : 'handle_required')
  if (error.code === '42703' || error.code === 'PGRST204') throw new ProfileSaveError('not_migrated')
  throw new ProfileSaveError('unknown')
}

/** Grava a foto nova na hora, sem esperar o "Salvar". Sem perfil criado, não faz nada. */
export async function saveAvatarUrl(userId: string, url: string): Promise<void> {
  if (!supabase) return
  await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', userId)
}

/** Capa do perfil: até 2000 px de largura, JPEG, na pasta da pessoa no bucket avatars. */
export async function uploadCover(userId: string, file: File): Promise<string> {
  if (!supabase) throw new ProfileSaveError('offline')
  const blob = await resizeImage(file, 2000)
  const path = `${userId}/cover.jpg`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw new ProfileSaveError('image')
  const url = `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
  await supabase.from('profiles').update({ cover_url: url }).eq('user_id', userId)
  return url
}

export async function removeCover(userId: string): Promise<void> {
  if (!supabase) return
  await supabase.from('profiles').update({ cover_url: null }).eq('user_id', userId)
  await supabase.storage.from('avatars').remove([`${userId}/cover.jpg`])
}

export function resizeImage(file: File, maxSide: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) { reject(new ProfileSaveError('image')); return }
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new ProfileSaveError('image')); return }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new ProfileSaveError('image')), 'image/jpeg', 0.86)
    }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new ProfileSaveError('image')) }
    image.src = url
  })
}

function statsOf(value: unknown): ProfileStats | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const days: Record<string, number> = {}
  if (raw.days && typeof raw.days === 'object') {
    for (const [day, points] of Object.entries(raw.days as Record<string, unknown>)) days[day] = num(points)
  }
  return {
    points: num(raw.points), streak: num(raw.streak), words: num(raw.words), learned: num(raw.learned),
    minutes: num(raw.minutes), booksFinished: num(raw.books_finished), booksReading: num(raw.books_reading), days,
  }
}

function shelfOf(value: unknown): ShelfItem[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter(item => item && typeof item === 'object').map(item => {
    const raw = item as Record<string, unknown>
    return {
      id: text(raw.id),
      title: text(raw.title),
      author: text(raw.author) || undefined,
      progress: Math.max(0, Math.min(100, num(raw.progress))),
      lastRead: text(raw.last_read) || undefined,
      finishedAt: text(raw.finished_at) || undefined,
      status: raw.status === 'abandoned' ? 'abandoned' : null,
      favorite: raw.favorite === true,
      catalogId: text(raw.catalog_id) || undefined,
      hasCover: raw.has_cover === true,
    }
  })
}

/** `me` abre o próprio perfil. Devolve null quando não existe, está bloqueado ou não tem @. */
export async function loadProfileView(target: { handle: string } | { userId: string } | 'me'): Promise<ProfileView | null> {
  if (!supabase) return null
  const args = target === 'me' ? {} : 'handle' in target ? { p_handle: target.handle } : { p_user: target.userId }
  const { data, error } = await supabase.rpc('community_profile', args)
  if (error || !data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  const goal = row.reading_goal && typeof row.reading_goal === 'object' ? row.reading_goal as Record<string, unknown> : null
  return {
    ...authorOf(row),
    coverUrl: text(row.cover_url) || undefined,
    bio: text(row.bio),
    goal: text(row.goal),
    leveled: row.leveled === true,
    isPublic: row.is_public === true,
    isOwner: row.is_owner === true,
    restricted: row.restricted === true,
    relation: relationOf(row.relation),
    joinedAt: text(row.joined_at) || undefined,
    followers: num(row.followers),
    following: num(row.following),
    friends: num(row.friends),
    posts: num(row.posts),
    reviews: num(row.reviews),
    booksRead: num(row.books_read),
    booksReading: num(row.books_reading),
    booksWant: num(row.books_want),
    readingGoal: goal ? { year: num(goal.year), target: num(goal.target), done: num(goal.done) } : undefined,
    show: {
      shelf: bool(row.show_shelf, true),
      stats: bool(row.show_stats, true),
      socials: bool(row.show_socials, true),
      studying: bool(row.show_studying, false),
    },
    socials: row.socials ? socialsOf(row.socials) : undefined,
    stats: statsOf(row.stats),
    shelf: shelfOf(row.shelf),
    studying: Array.isArray(row.studying) ? row.studying.filter((word): word is string => typeof word === 'string') : undefined,
  }
}

/** Descoberta e busca por nome ou @. Paginação pelo `updatedAt` do último. */
export async function listPeople(options: { query?: string; before?: string; limit?: number } = {}): Promise<PersonCard[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('community_people', {
    p_query: options.query?.trim() || null, p_before: options.before ?? null, p_limit: options.limit ?? 40,
  })
  if (error || !Array.isArray(data)) return []
  return data.map(item => {
    const row = item as Record<string, unknown>
    return {
      ...authorOf(row),
      bio: text(row.bio),
      isPublic: row.is_public === true,
      followers: num(row.followers),
      relation: relationOf(row.relation),
      isMe: row.is_me === true,
      commonBooks: num(row.common_books),
      reading: text(row.reading) || undefined,
      updatedAt: text(row.updated_at) || undefined,
    }
  })
}

const covers = new Map<string, Promise<string | null>>()

/** Capa de um livro da estante, pedida uma vez por sessão. */
export function shelfCover(bookId: string): Promise<string | null> {
  const cached = covers.get(bookId)
  if (cached) return cached
  const request = (async () => {
    if (!supabase) return null
    const { data, error } = await supabase.rpc('shelf_cover', { p_book: bookId })
    return error || typeof data !== 'string' ? null : data
  })()
  covers.set(bookId, request)
  return request
}

/** A dona marca um livro como abandonado ou favorito. Os outros estados vêm do progresso. */
export async function updateShelfBook(bookId: string, patch: { status?: ShelfStatus; favorite?: boolean }): Promise<void> {
  if (!supabase) throw new ProfileSaveError('offline')
  const row: Record<string, unknown> = {}
  if ('status' in patch) row.shelf_status = patch.status
  if ('favorite' in patch) row.favorite = patch.favorite
  const { error } = await supabase.from('books').update(row).eq('id', bookId)
  if (error) throw new ProfileSaveError('unknown')
}

/** Link seguro para cada rede. Aceita @nome, nome ou o endereço completo. */
export function socialLink(kind: keyof Socials, value: string): { href: string; label: string } | null {
  const raw = value.trim()
  if (!raw) return null
  if (kind === 'website') {
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
      return { href: url.toString(), label: url.host.replace(/^www\./, '') }
    } catch { return null }
  }
  const name = raw.replace(/^https?:\/\/(www\.)?(instagram\.com|x\.com|twitter\.com)\//i, '').replace(/^@/, '').split(/[/?#]/)[0]
  if (!/^[A-Za-z0-9_.]{1,30}$/.test(name)) return null
  return { href: kind === 'instagram' ? `https://instagram.com/${name}` : `https://x.com/${name}`, label: `@${name}` }
}
