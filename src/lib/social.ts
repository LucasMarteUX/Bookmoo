// Camada social do Bookmoo: relações (seguir, amizade, bloqueio), timeline, publicações, comentários,
// denúncias, notificações, avaliações, resenhas e metas. Regras de visibilidade ficam no banco
// (RLS + funções security definer); aqui só chamamos e traduzimos os dados.
import { supabase } from '@/lib/supabase'
import { authorOf, num, text, type Author, type ReadingGoal, type Relation } from '@/lib/communityProfile'

export type FeedScope = 'all' | 'following' | 'friends' | 'user'
export type Audience = 'public' | 'followers' | 'friends'
export type PostKind = 'post' | 'started' | 'progress' | 'finished' | 'review' | 'goal'
export type ReviewVisibility = Audience | 'private'

export type Review = {
  id: string
  rating: number
  title?: string
  body?: string
  spoiler: boolean
  visibility: ReviewVisibility
}

export type FeedItem = {
  kind: PostKind
  id: string
  at: string
  author: Author
  body?: string
  imageUrl?: string
  audience: Audience
  editedAt?: string
  milestone?: number
  catalogId?: string
  bookId?: string
  book?: { title: string; author?: string }
  review?: Review
  likes: number
  liked: boolean
  comments: number
  mine: boolean
}

export type PostComment = {
  id: string
  at: string
  body: string
  parentId?: string
  author: Author
  mine: boolean
  canDelete: boolean
}

export type CatalogSocial = Record<string, { readers: number; faces: Author[] }>
export type Connection = Author & { relation: Relation; isMe: boolean }
export type Requests = { followIn: (Author & { at: string })[]; friendIn: (Author & { at: string })[]; friendOut: (Author & { at: string })[] }

export type NotificationType = 'follow' | 'follow_request' | 'follow_accepted' | 'friend_request' | 'friend_accepted' | 'like' | 'review_like' | 'comment' | 'reply'
export type AppNotification = {
  id: string
  type: NotificationType
  at: string
  read: boolean
  postId?: string
  commentId?: string
  actor: Author
  snippet?: string
}

export type BookReviews = { average: number | null; count: number; mine: Review | null; items: FeedItem[] }

export type ReportReason = 'spam' | 'harassment' | 'hate' | 'sexual' | 'violence' | 'copyright' | 'other'
export type ReportTarget = { type: 'post'; postId: string } | { type: 'comment'; commentId: string } | { type: 'profile'; profileId: string }

export const POST_MAX = 1000
export const COMMENT_MAX = 500
export const REVIEW_MAX = 4000
const IMAGE_MAX_SIDE = 1600
const MEDIA_BUCKET = 'post-media'

export class SocialError extends Error {
  constructor(public code: 'closed_profile' | 'rate_limited' | 'empty' | 'image' | 'duplicate' | 'blocked' | 'offline' | 'unknown') { super(code) }
}

function errorOf(error: { code?: string; message?: string }): SocialError {
  if (error.message?.includes('rate_limited')) return new SocialError('rate_limited')
  if (error.code === '42501') return new SocialError('closed_profile')
  if (error.code === '23514') return new SocialError('empty')
  if (error.code === '23505') return new SocialError('duplicate')
  return new SocialError('unknown')
}

function need() {
  if (!supabase) throw new SocialError('offline')
  return supabase
}

const KINDS: PostKind[] = ['post', 'started', 'progress', 'finished', 'review', 'goal']
const AUDIENCES: Audience[] = ['public', 'followers', 'friends']

function reviewOf(value: unknown): Review | undefined {
  if (!value || typeof value !== 'object') return undefined
  const row = value as Record<string, unknown>
  const visibility = (['public', 'followers', 'friends', 'private'] as ReviewVisibility[]).includes(row.visibility as ReviewVisibility) ? row.visibility as ReviewVisibility : 'public'
  return {
    id: text(row.id), rating: num(row.rating), title: text(row.title) || undefined, body: text(row.body) || undefined,
    spoiler: row.spoiler === true, visibility,
  }
}

function feedItemOf(value: unknown): FeedItem {
  const row = value as Record<string, unknown>
  const book = row.book && typeof row.book === 'object' ? row.book as Record<string, unknown> : null
  return {
    kind: KINDS.includes(row.kind as PostKind) ? row.kind as PostKind : 'post',
    id: text(row.id),
    at: text(row.at),
    author: authorOf(row.author),
    body: text(row.body) || undefined,
    imageUrl: text(row.image_url) || undefined,
    audience: AUDIENCES.includes(row.audience as Audience) ? row.audience as Audience : 'public',
    editedAt: text(row.edited_at) || undefined,
    milestone: row.milestone == null ? undefined : num(row.milestone),
    catalogId: text(row.catalog_id) || undefined,
    bookId: text(row.book_id) || undefined,
    book: book ? { title: text(book.title), author: text(book.author) || undefined } : undefined,
    review: reviewOf(row.review),
    likes: num(row.likes),
    liked: row.liked === true,
    comments: num(row.comments),
    mine: row.mine === true,
  }
}

// ─── Timeline ───

export async function loadFeed(scope: FeedScope, options: { userId?: string; before?: string; limit?: number; signal?: AbortSignal } = {}): Promise<FeedItem[]> {
  if (!supabase) return []
  let request = supabase.rpc('community_feed', {
    p_scope: scope, p_user: options.userId ?? null, p_before: options.before ?? null, p_limit: options.limit ?? 20,
  })
  if (options.signal) request = request.abortSignal(options.signal)
  const { data, error } = await request
  if (error || !Array.isArray(data)) return []
  return data.map(feedItemOf)
}

/** Uma publicação pelo id: é a página aberta pelo link compartilhado. */
export async function loadPost(id: string): Promise<FeedItem | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('community_feed', { p_scope: 'post', p_post: id, p_limit: 1 })
  if (error || !Array.isArray(data) || !data.length) return null
  return feedItemOf(data[0])
}

/** Reduz a foto para no máximo 1600 px, em JPEG, antes de enviar. */
export function prepareImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) { reject(new SocialError('image')); return }
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new SocialError('image')); return }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new SocialError('image')), 'image/jpeg', 0.86)
    }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new SocialError('image')) }
    image.src = url
  })
}

function mediaPath(imageUrl: string): string | null {
  const marker = `/object/public/${MEDIA_BUCKET}/`
  const at = imageUrl.indexOf(marker)
  return at < 0 ? null : decodeURIComponent(imageUrl.slice(at + marker.length).split('?')[0])
}

export type PostBook = { catalogId?: string; bookId?: string; title?: string; author?: string }

/** Publica texto e/ou foto. A foto sobe antes; se a publicação falhar, ela é removida. */
export async function createPost(userId: string, input: { body: string; book?: PostBook; image?: Blob; audience: Audience }): Promise<void> {
  const db = need()
  const body = input.body.trim().slice(0, POST_MAX)
  if (!body && !input.image) throw new SocialError('empty')
  let imageUrl: string | null = null
  let path: string | null = null
  if (input.image) {
    path = `${userId}/${crypto.randomUUID()}.jpg`
    const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, input.image, { contentType: 'image/jpeg', cacheControl: '31536000' })
    if (error) throw new SocialError('image')
    imageUrl = db.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
  }
  const { error } = await db.from('community_posts').insert({
    user_id: userId, body, image_url: imageUrl, audience: input.audience,
    catalog_id: input.book?.catalogId ?? null,
    book_id: input.book?.catalogId ? null : input.book?.bookId ?? null,
    book_title: input.book?.catalogId ? null : input.book?.title ?? null,
    book_author: input.book?.catalogId ? null : input.book?.author ?? null,
  })
  if (error) {
    if (path) await db.storage.from(MEDIA_BUCKET).remove([path])
    throw errorOf(error)
  }
}

/** Edita texto e audiência de uma publicação própria (o banco não deixa mudar o resto). */
export async function updatePost(id: string, patch: { body: string; audience: Audience }): Promise<void> {
  const { error } = await need().from('community_posts').update({ body: patch.body.trim().slice(0, POST_MAX), audience: patch.audience }).eq('id', id)
  if (error) throw errorOf(error)
}

export async function deletePost(item: Pick<FeedItem, 'id' | 'imageUrl'>): Promise<void> {
  const db = need()
  const { error } = await db.from('community_posts').delete().eq('id', item.id)
  if (error) throw errorOf(error)
  const path = item.imageUrl ? mediaPath(item.imageUrl) : null
  if (path) await db.storage.from(MEDIA_BUCKET).remove([path])
}

export async function setLike(postId: string, userId: string, liked: boolean): Promise<void> {
  const db = need()
  const { error } = liked
    ? await db.from('post_likes').upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id', ignoreDuplicates: true })
    : await db.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
  if (error) throw errorOf(error)
}

export async function loadComments(postId: string): Promise<PostComment[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('community_comments', { p_post: postId })
  if (error || !Array.isArray(data)) return []
  return data.map(value => {
    const row = value as Record<string, unknown>
    return {
      id: text(row.id), at: text(row.at), body: text(row.body), parentId: text(row.parent_id) || undefined,
      author: authorOf(row.author), mine: row.mine === true, canDelete: row.can_delete === true,
    }
  })
}

export async function addComment(postId: string, userId: string, body: string, parentId?: string): Promise<void> {
  const { error } = await need().from('post_comments').insert({ post_id: postId, user_id: userId, body: body.trim().slice(0, COMMENT_MAX), parent_id: parentId ?? null })
  if (error) throw errorOf(error)
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await need().from('post_comments').delete().eq('id', id)
  if (error) throw errorOf(error)
}

// ─── Relações ───

/** Segue. Perfil fechado vira pedido: devolve o status que o banco decidiu. */
export async function follow(followerId: string, followeeId: string): Promise<'accepted' | 'pending'> {
  const { data, error } = await need().from('follows').insert({ follower_id: followerId, followee_id: followeeId }).select('status').single()
  if (error) {
    if (error.code === '23505') return 'accepted'
    throw errorOf(error)
  }
  return data?.status === 'pending' ? 'pending' : 'accepted'
}

/** Deixar de seguir ou cancelar o pedido. */
export async function unfollow(followerId: string, followeeId: string): Promise<void> {
  const { error } = await need().from('follows').delete().eq('follower_id', followerId).eq('followee_id', followeeId)
  if (error) throw errorOf(error)
}

/** Compatível com o botão antigo. */
export async function setFollow(followerId: string, followeeId: string, on: boolean): Promise<void> {
  if (on) await follow(followerId, followeeId)
  else await unfollow(followerId, followeeId)
}

export async function approveFollower(me: string, followerId: string): Promise<void> {
  const { error } = await need().from('follows').update({ status: 'accepted' }).eq('follower_id', followerId).eq('followee_id', me)
  if (error) throw errorOf(error)
}

/** Recusar pedido ou remover alguém que já segue. */
export async function removeFollower(me: string, followerId: string): Promise<void> {
  await unfollow(followerId, me)
}

export async function sendFriendRequest(me: string, other: string): Promise<void> {
  const { error } = await need().from('friend_requests').insert({ requester_id: me, addressee_id: other })
  if (error) throw errorOf(error)
}

export async function acceptFriendRequest(me: string, requesterId: string): Promise<void> {
  const { error } = await need().from('friend_requests').update({ status: 'accepted' }).eq('requester_id', requesterId).eq('addressee_id', me)
  if (error) throw errorOf(error)
}

/** Recusar, cancelar ou desfazer amizade: apaga o registro do par, seja quem for que pediu. */
export async function removeFriendship(me: string, other: string): Promise<void> {
  const db = need()
  const { error } = await db.from('friend_requests').delete()
    .or(`and(requester_id.eq.${me},addressee_id.eq.${other}),and(requester_id.eq.${other},addressee_id.eq.${me})`)
  if (error) throw errorOf(error)
}

export async function blockUser(me: string, other: string): Promise<void> {
  const { error } = await need().from('blocks').insert({ blocker_id: me, blocked_id: other })
  if (error && error.code !== '23505') throw errorOf(error)
}

export async function unblockUser(me: string, other: string): Promise<void> {
  const { error } = await need().from('blocks').delete().eq('blocker_id', me).eq('blocked_id', other)
  if (error) throw errorOf(error)
}

export async function loadBlocked(): Promise<Author[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('community_blocked')
  return error || !Array.isArray(data) ? [] : data.map(authorOf)
}

export async function loadConnections(userId: string, kind: 'followers' | 'following' | 'friends'): Promise<Connection[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('community_connections', { p_user: userId, p_kind: kind })
  if (error || !Array.isArray(data)) return []
  return data.map(value => {
    const row = value as Record<string, unknown>
    return { ...authorOf(row), relation: relationOfRow(row.relation), isMe: row.is_me === true }
  })
}

function relationOfRow(value: unknown): Relation {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const friend = raw.friend === 'friends' || raw.friend === 'outgoing' || raw.friend === 'incoming' ? raw.friend : 'none'
  return { following: raw.following === true, followPending: raw.follow_pending === true, followsMe: raw.follows_me === true, friend, blockedByMe: raw.blocked_by_me === true }
}

export async function loadRequests(): Promise<Requests> {
  const empty: Requests = { followIn: [], friendIn: [], friendOut: [] }
  if (!supabase) return empty
  const { data, error } = await supabase.rpc('community_requests')
  if (error || !data || typeof data !== 'object') return empty
  const row = data as Record<string, unknown>
  const list = (value: unknown) => Array.isArray(value) ? value.map(item => ({ ...authorOf(item), at: text((item as Record<string, unknown>).at) })) : []
  return { followIn: list(row.follow_in), friendIn: list(row.friend_in), friendOut: list(row.friend_out) }
}

// ─── Denúncias ───

export async function report(me: string, target: ReportTarget, reason: ReportReason, details?: string): Promise<void> {
  const { error } = await need().from('reports').insert({
    reporter_id: me,
    target_type: target.type,
    post_id: target.type === 'post' ? target.postId : null,
    comment_id: target.type === 'comment' ? target.commentId : null,
    profile_id: target.type === 'profile' ? target.profileId : null,
    reason,
    details: details?.trim().slice(0, 500) || null,
  })
  if (error && error.code !== '23505') throw errorOf(error)
}

// ─── Notificações ───

const NOTIFICATION_TYPES: NotificationType[] = ['follow', 'follow_request', 'follow_accepted', 'friend_request', 'friend_accepted', 'like', 'review_like', 'comment', 'reply']

export async function loadNotifications(before?: string): Promise<AppNotification[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('community_notifications', { p_before: before ?? null, p_limit: 30 })
  if (error || !Array.isArray(data)) return []
  return data.map(value => {
    const row = value as Record<string, unknown>
    return {
      id: text(row.id),
      type: NOTIFICATION_TYPES.includes(row.type as NotificationType) ? row.type as NotificationType : 'like',
      at: text(row.at),
      read: row.read === true,
      postId: text(row.post_id) || undefined,
      commentId: text(row.comment_id) || undefined,
      actor: authorOf(row.actor),
      snippet: text(row.snippet) || undefined,
    }
  })
}

export async function unreadNotifications(userId: string): Promise<number> {
  if (!supabase) return 0
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', userId).is('read_at', null)
  return error ? 0 : count ?? 0
}

export async function markNotificationsRead(userId: string, id?: string): Promise<void> {
  if (!supabase) return
  let request = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', userId).is('read_at', null)
  if (id) request = request.eq('id', id)
  await request
}

// ─── Avaliações, resenhas e metas ───

export async function loadBookReviews(catalogId: string): Promise<BookReviews> {
  const empty: BookReviews = { average: null, count: 0, mine: null, items: [] }
  if (!supabase) return empty
  const { data, error } = await supabase.rpc('book_reviews_for', { p_catalog: catalogId })
  if (error || !data || typeof data !== 'object') return empty
  const row = data as Record<string, unknown>
  return {
    average: row.average == null ? null : num(row.average),
    count: num(row.count),
    mine: reviewOf(row.mine) ?? null,
    items: Array.isArray(row.items) ? row.items.map(feedItemOf) : [],
  }
}

export async function saveReview(userId: string, catalogId: string, review: Omit<Review, 'id'>): Promise<void> {
  const rating = Math.round(Math.min(5, Math.max(0.5, review.rating)) * 2) / 2
  const { error } = await need().from('book_reviews').upsert({
    user_id: userId, catalog_id: catalogId, rating,
    title: review.title?.trim().slice(0, 120) || null,
    body: review.body?.trim().slice(0, REVIEW_MAX) || null,
    spoiler: review.spoiler, visibility: review.visibility,
  }, { onConflict: 'user_id,catalog_id' })
  if (error) throw errorOf(error)
}

export async function deleteReview(id: string): Promise<void> {
  const { error } = await need().from('book_reviews').delete().eq('id', id)
  if (error) throw errorOf(error)
}

export async function saveGoal(userId: string, year: number, target: number): Promise<void> {
  const { error } = await need().from('reading_goals').upsert({ user_id: userId, year, target: Math.round(Math.min(500, Math.max(1, target))), updated_at: new Date().toISOString() }, { onConflict: 'user_id,year' })
  if (error) throw errorOf(error)
}

export async function deleteGoal(userId: string, year: number): Promise<void> {
  const { error } = await need().from('reading_goals').delete().eq('user_id', userId).eq('year', year)
  if (error) throw errorOf(error)
}

export type GoalHistory = ReadingGoal[]

// ─── Galeria ───

export async function loadCatalogSocial(): Promise<CatalogSocial> {
  if (!supabase) return {}
  const { data, error } = await supabase.rpc('catalog_social')
  if (error || !data || typeof data !== 'object') return {}
  const result: CatalogSocial = {}
  for (const [catalogId, value] of Object.entries(data as Record<string, unknown>)) {
    const row = value as Record<string, unknown>
    result[catalogId] = { readers: num(row.readers), faces: Array.isArray(row.faces) ? row.faces.map(authorOf) : [] }
  }
  return result
}

// ─── Admin ───

export type AdminReport = {
  id: string
  at: string
  type: 'post' | 'comment' | 'profile'
  reason: ReportReason
  details?: string
  reporter: Author
  targetAuthor: Author
  content?: string
  imageUrl?: string
  postId?: string
  hidden: boolean
}

export async function loadAdminReports(status: 'open' | 'dismissed' | 'actioned' = 'open'): Promise<AdminReport[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_reports', { p_status: status })
  if (error || !Array.isArray(data)) return []
  return data.map(value => {
    const row = value as Record<string, unknown>
    return {
      id: text(row.id), at: text(row.at), type: row.type as AdminReport['type'], reason: row.reason as ReportReason,
      details: text(row.details) || undefined, reporter: authorOf(row.reporter), targetAuthor: authorOf(row.target_author),
      content: text(row.content) || undefined, imageUrl: text(row.image_url) || undefined, postId: text(row.post_id) || undefined,
      hidden: row.hidden === true,
    }
  })
}

export async function resolveReport(id: string, action: 'dismiss' | 'hide' | 'delete'): Promise<void> {
  const { error } = await need().rpc('admin_resolve_report', { p_report: id, p_action: action })
  if (error) throw errorOf(error)
}

/** "agora", "5 min", "ontem", "3 de nov." */
export function timeAgo(iso: string, pt: boolean): string {
  const date = new Date(iso)
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(pt ? 'pt-BR' : 'en-US', { numeric: 'auto', style: 'short' })
  if (seconds < 60) return pt ? 'agora' : 'now'
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), 'minute')
  if (seconds < 86_400) return rtf.format(-Math.floor(seconds / 3600), 'hour')
  if (seconds < 7 * 86_400) return rtf.format(-Math.floor(seconds / 86_400), 'day')
  return date.toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'short' })
}

export function errorText(err: unknown, pt: boolean) {
  const code = err instanceof SocialError ? err.code : 'unknown'
  const messages: Record<SocialError['code'], [string, string]> = {
    rate_limited: ['Muitas ações seguidas. Tente daqui a pouco.', 'Too many actions in a row. Try again soon.'],
    closed_profile: ['Você não tem permissão para isso.', 'You are not allowed to do that.'],
    empty: ['Escreva algo ou escolha uma foto.', 'Write something or pick a photo.'],
    image: ['Não consegui usar essa imagem (JPEG, PNG ou WebP).', 'Could not use that image (JPEG, PNG or WebP).'],
    duplicate: ['Isso já foi feito.', 'That is already done.'],
    blocked: ['Não é possível interagir com esta pessoa.', 'You cannot interact with this person.'],
    offline: ['Sem conexão com o servidor.', 'No connection to the server.'],
    unknown: ['Não deu certo agora.', 'That did not work.'],
  }
  return messages[code][pt ? 0 : 1]
}
