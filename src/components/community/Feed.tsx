import { EmojiButton, MentionTextarea, RichText } from './TextAssist'
import { askConfirm } from '@/components/ui/confirm'
// Timeline social: publicações manuais (texto, foto, livro) e atividades de leitura (começou, avançou,
// terminou, resenha, meta), todas com curtir, comentar (com resposta de um nível) e compartilhar.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Ban, BookOpen, Check, Flag, Heart, ImagePlus, Link2, Loader2, MessageCircle, PartyPopper, Pencil, Send, Target, Trash2, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { BookCover } from '@/components/book/BookCard'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { LevelBadge } from '@/components/ui/level-badge'
import { toast } from '@/components/ui/toast'
import { useBookStore } from '@/store/useBookStore'
import { shelfCover, type Author, type ProfileView } from '@/lib/communityProfile'
import type { CatalogBook } from '@/lib/catalog'
import {
  addComment, blockUser, COMMENT_MAX, createPost, deleteComment, deletePost, errorText, loadComments, loadFeed, POST_MAX, prepareImage,
  setLike, timeAgo, updatePost, type Audience, type FeedItem, type FeedScope, type PostBook, type PostComment, type ReportTarget,
} from '@/lib/social'
import { AudienceIcon, AudienceSelect, audienceLabel, cardStyle, MenuItem, MoreMenu, muted, RatingStars, ReportDialog } from './social-ui'

const card = cardStyle
export type Covers = Record<string, string | undefined>
export const postUrl = (id: string) => `${window.location.origin}/post/${id}`
const AUDIENCES: Audience[] = ['public', 'followers', 'friends']

function AuthorLine({ author, at, pt, postId, edited, audience, action }: { author: Author; at: string; pt: boolean; postId?: string; edited?: boolean; audience?: Audience; action?: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 leading-tight">
      <p className="text-[14.5px]">
        <Link to={`/u/${author.handle}`} className="font-medium hover:underline">{author.name || author.handle}</Link>
        {action && <span style={muted}> {action}</span>}
      </p>
      <p className="mt-0.5 text-[12.5px] truncate flex items-center gap-1" style={muted}>
        <span>@{author.handle}</span>
        <span aria-hidden>·</span>
        {postId ? <Link to={`/post/${postId}`} className="hover:underline">{timeAgo(at, pt)}</Link> : <span>{timeAgo(at, pt)}</span>}
        {edited && <span>· {pt ? 'editado' : 'edited'}</span>}
        {audience && audience !== 'public' && <span className="inline-flex items-center gap-0.5" title={audienceLabel(audience, pt)}>· <AudienceIcon audience={audience} className="w-3 h-3" /></span>}
      </p>
    </div>
  )
}

/** Capa: da galeria vem pronta; livro da estante é pedido à parte (pode ser grande). */
function useBookCover(catalogId: string | undefined, bookId: string | undefined, covers: Covers) {
  const [own, setOwn] = useState<string | undefined>(undefined)
  const fromCatalog = catalogId ? covers[catalogId] : undefined
  useEffect(() => {
    if (fromCatalog || !bookId) return
    let alive = true
    void shelfCover(bookId).then(data => { if (alive && data) setOwn(data) })
    return () => { alive = false }
  }, [fromCatalog, bookId])
  return fromCatalog ?? own
}

function BookChip({ item, covers, pt }: { item: FeedItem; covers: Covers; pt: boolean }) {
  const cover = useBookCover(item.catalogId, item.bookId, covers)
  if (!item.book) return null
  const body = (
    <>
      <BookCover title={item.book.title} coverData={cover} className="w-11 shrink-0 rounded-md [&_span]:text-[8px] [&_span]:px-1" />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium leading-snug line-clamp-2">{item.book.title}</span>
        {item.book.author && <span className="block text-[12px] truncate" style={muted}>{item.book.author}</span>}
        {item.catalogId && <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium"><BookOpen className="w-3 h-3" />{pt ? 'Ver na galeria' : 'See in gallery'}</span>}
      </span>
    </>
  )
  const className = 'mt-3 flex items-center gap-3 rounded-2xl border p-2.5 pr-4 max-w-sm'
  return item.catalogId
    ? <Link to={`/gallery/${item.catalogId}`} className={`${className} transition-colors hover:bg-[var(--theme-nav-hover)]`} style={{ borderColor: 'var(--theme-border)' }}>{body}</Link>
    : <div className={className} style={{ borderColor: 'var(--theme-border)' }}>{body}</div>
}

/** Publicar: texto e/ou foto, livro da estante ou da galeria, e quem pode ver. */
export function Composer({ me, books, pt, onPosted }: { me: ProfileView | null; books: CatalogBook[]; pt: boolean; onPosted: () => void }) {
  const { user } = useAuth()
  const library = useBookStore(s => s.books)
  const [body, setBody] = useState('')
  const [bookKey, setBookKey] = useState('')
  const [audience, setAudience] = useState<Audience>('public')
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const canPost = !!me && !!me.handle
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url) }, [image])

  if (!canPost) {
    return (
      <div className="rounded-3xl border p-5 flex items-center gap-4" style={card}>
        <img src="/illustrations/chatting.svg" alt="" className="illo w-20 shrink-0 hidden sm:block" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{pt ? 'Crie seu perfil para publicar' : 'Create your profile to post'}</p>
          <p className="mt-0.5 text-[13.5px]" style={muted}>{pt ? 'Escolha um @ e conte o que está lendo.' : 'Pick a handle and share what you are reading.'}</p>
        </div>
        <Link to="/settings#profile" className="shrink-0 h-9 px-4 inline-flex items-center rounded-full text-[13.5px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
          {pt ? 'Criar perfil' : 'Create profile'}
        </Link>
      </div>
    )
  }

  const selected: PostBook | undefined = (() => {
    if (bookKey.startsWith('cat:')) return { catalogId: bookKey.slice(4) }
    if (bookKey.startsWith('lib:')) {
      const book = library.find(item => item.id === bookKey.slice(4))
      return book ? (book.catalogId ? { catalogId: book.catalogId } : { bookId: book.id, title: book.title, author: book.author }) : undefined
    }
    return undefined
  })()

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      const blob = await prepareImage(file)
      setImage({ blob, url: URL.createObjectURL(blob) })
    } catch (err) { setError(errorText(err, pt)) }
  }

  const submit = async () => {
    if (!user || (!body.trim() && !image)) return
    setBusy(true); setError('')
    try {
      await createPost(user.id, { body, book: selected, image: image?.blob, audience })
      setBody(''); setBookKey(''); setImage(null)
      toast(pt ? 'Publicado.' : 'Posted.', { tone: 'success' })
      onPosted()
    } catch (err) {
      setError(errorText(err, pt))
    } finally {
      setBusy(false)
    }
  }

  const placeholder = me.isPublic
    ? (pt ? 'O que você está lendo? Uma frase, uma palavra nova, uma conquista…' : 'What are you reading? A quote, a new word, a win…')
    : (pt ? 'Seu perfil é fechado: só quem você aprovou vê.' : 'Your profile is closed: only people you approve see this.')

  const tagged = (() => {
    if (bookKey.startsWith('cat:')) { const b = books.find(item => item.id === bookKey.slice(4)); return b ? { title: b.title, cover: b.coverData } : null }
    if (bookKey.startsWith('lib:')) { const b = library.find(item => item.id === bookKey.slice(4)); return b ? { title: b.title, cover: b.coverData } : null }
    return null
  })()
  const addEmoji = (emoji: string) => {
    const el = area.current
    const start = el?.selectionStart ?? body.length, end = el?.selectionEnd ?? body.length
    const next = body.slice(0, start) + emoji + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + emoji.length, start + emoji.length) })
  }
  const tool = 'h-9 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-colors hover:bg-[var(--theme-nav-hover)]'
  const ready = !busy && (!!body.trim() || !!image)

  return (
    <div className="rounded-3xl border" style={card}>
      <div className="flex gap-3 px-4 sm:px-5 pt-4 sm:pt-5">
        <Avatar src={me.avatarUrl} name={me.name || me.handle} size={42} />
        <div className="flex-1 min-w-0">
          <MentionTextarea ref={area} value={body} onChange={setBody} pt={pt} emoji={false} maxLength={POST_MAX} rows={body || image ? 4 : 2}
            placeholder={placeholder} aria-label={pt ? 'Escrever publicação' : 'Write a post'}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit() }}
            className="w-full resize-none bg-transparent outline-none text-[16px] leading-relaxed pt-2 placeholder:text-[var(--theme-text-secondary)]" />
          {image && (
            <div className="relative mt-2 rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--theme-border)' }}>
              <img src={image.url} alt="" className="block w-full max-h-[420px] object-cover" />
              <button type="button" onClick={() => setImage(null)} aria-label={pt ? 'Tirar foto' : 'Remove photo'}
                className="absolute right-2.5 top-2.5 w-8 h-8 grid place-items-center rounded-full backdrop-blur-md" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-card-bg) 80%, transparent)', color: 'var(--theme-text)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {tagged && (
            <div className="mt-2 inline-flex max-w-full items-center gap-2.5 rounded-2xl border py-1.5 pl-1.5 pr-2" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
              {tagged.cover
                ? <img src={tagged.cover} alt="" className="w-7 h-10 rounded-md object-cover shrink-0" />
                : <span className="w-7 h-10 grid place-items-center rounded-md shrink-0" style={{ backgroundColor: 'var(--theme-card-bg)' }}><BookOpen className="w-3.5 h-3.5" style={muted} /></span>}
              <span className="min-w-0 text-[13px] font-medium truncate">{tagged.title}</span>
              <button type="button" onClick={() => setBookKey('')} aria-label={pt ? 'Tirar livro' : 'Remove book'} className="w-6 h-6 grid place-items-center rounded-full shrink-0 hover:bg-[var(--theme-nav-hover)]" style={muted}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Barra de ações: tudo numa linha, ícones à esquerda e Publicar à direita. */}
      <div className="mt-3 flex items-center gap-1 border-t px-3 sm:px-4 py-2.5" style={{ borderColor: 'var(--theme-border)' }}>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { void pick(e.target.files?.[0]); e.currentTarget.value = '' }} />
        <button type="button" onClick={() => fileInput.current?.click()} className={tool} style={muted} title={pt ? 'Adicionar foto' : 'Add photo'}>
          <ImagePlus className="w-[18px] h-[18px]" /><span className="hidden sm:inline">{pt ? 'Foto' : 'Photo'}</span>
        </button>
        <label className={`${tool} relative cursor-pointer`} style={muted} title={pt ? 'Marcar um livro' : 'Tag a book'}>
          <BookOpen className="w-[18px] h-[18px]" /><span className="hidden sm:inline">{pt ? 'Livro' : 'Book'}</span>
          <select value={bookKey} onChange={e => setBookKey(e.target.value)} aria-label={pt ? 'Marcar um livro' : 'Tag a book'}
            className="absolute inset-0 opacity-0 cursor-pointer">
            <option value="">{pt ? 'Nenhum livro' : 'No book'}</option>
            {library.length > 0 && (
              <optgroup label={pt ? 'Minha estante' : 'My shelf'}>
                {library.map(book => <option key={book.id} value={`lib:${book.id}`}>{book.title}</option>)}
              </optgroup>
            )}
            {books.length > 0 && (
              <optgroup label={pt ? 'Galeria' : 'Gallery'}>
                {books.map(book => <option key={book.id} value={`cat:${book.id}`}>{book.title}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        <EmojiButton onPick={addEmoji} pt={pt} />
        <span className="mx-1 h-5 w-px shrink-0" style={{ backgroundColor: 'var(--theme-border)' }} aria-hidden />
        <label className={`${tool} relative cursor-pointer`} style={muted} title={pt ? 'Quem pode ver' : 'Who can see'}>
          <AudienceIcon audience={audience} />
          <span className="hidden sm:inline">{audienceLabel(audience, pt)}</span>
          <select value={audience} onChange={e => setAudience(e.target.value as Audience)} aria-label={pt ? 'Quem pode ver' : 'Who can see'}
            className="absolute inset-0 opacity-0 cursor-pointer">
            {AUDIENCES.map(option => <option key={option} value={option}>{audienceLabel(option, pt)}</option>)}
          </select>
        </label>
        <span className="ml-auto pr-2 text-[12px] tabular-nums" style={{ color: body.length > POST_MAX - 40 ? 'var(--color-destructive)' : 'var(--theme-text-secondary)' }}>
          {body.length > POST_MAX - 120 ? POST_MAX - body.length : ''}
        </span>
        <button type="button" disabled={!ready} onClick={() => { void submit() }}
          className="h-9 px-4 shrink-0 inline-flex items-center gap-1.5 rounded-full text-[13.5px] font-semibold transition-opacity disabled:opacity-40"
          style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {pt ? 'Publicar' : 'Post'}
        </button>
      </div>
      {error && <p className="px-5 pb-3 -mt-1 text-[13px]" role="alert" style={{ color: 'var(--color-destructive)' }}>{error}</p>}
    </div>
  )
}

function CommentRow({ item, pt, onReply, onDelete, onReport, reply = false }: { item: PostComment; pt: boolean; onReply?: () => void; onDelete: () => void; onReport: () => void; reply?: boolean }) {
  return (
    <div className={`flex gap-2.5 group/comment ${reply ? 'ml-10' : ''}`}>
      <Link to={`/u/${item.author.handle}`} className="shrink-0"><Avatar src={item.author.avatarUrl} name={item.author.name || item.author.handle} size={reply ? 26 : 30} /></Link>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl px-3 py-2" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
          <p className="text-[12.5px]"><Link to={`/u/${item.author.handle}`} className="font-medium hover:underline">{item.author.name || item.author.handle}</Link> <span style={muted}>· {timeAgo(item.at, pt)}</span></p>
          <p className="text-[14px] leading-snug whitespace-pre-line break-words"><RichText text={item.body} /></p>
        </div>
        <div className="mt-0.5 ml-2 flex gap-3 text-[12px]" style={muted}>
          {onReply && <button type="button" onClick={onReply} className="hover:underline">{pt ? 'Responder' : 'Reply'}</button>}
          {item.canDelete && <button type="button" onClick={onDelete} className="hover:underline">{pt ? 'Apagar' : 'Delete'}</button>}
          {!item.mine && <button type="button" onClick={onReport} className="hover:underline opacity-0 group-hover/comment:opacity-100 focus:opacity-100">{pt ? 'Denunciar' : 'Report'}</button>}
        </div>
      </div>
    </div>
  )
}

function Comments({ postId, pt, canPost, onCount }: { postId: string; pt: boolean; canPost: boolean; onCount: (delta: number) => void }) {
  const { user } = useAuth()
  const [items, setItems] = useState<PostComment[] | null>(null)
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<PostComment | null>(null)
  const [reporting, setReporting] = useState<ReportTarget | null>(null)
  const [error, setError] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const reload = () => loadComments(postId).then(setItems)
  useEffect(() => { void reload() }, [postId])

  const send = async () => {
    if (!user || !body.trim()) return
    setError('')
    try {
      await addComment(postId, user.id, body, replyTo?.id)
      setBody(''); setReplyTo(null); onCount(1); await reload()
    } catch (err) { setError(errorText(err, pt)) }
  }
  const remove = async (id: string) => {
    if (!await askConfirm(pt ? 'Apagar este comentário?' : 'Delete this comment?')) return
    try { await deleteComment(id); onCount(-1); await reload() } catch (err) { toast(errorText(err, pt), { tone: 'error' }) }
  }
  const top = (items ?? []).filter(item => !item.parentId)
  const replies = (id: string) => (items ?? []).filter(item => item.parentId === id)

  return (
    <div className="mt-3 pt-3 border-t space-y-3 animate-in fade-in duration-200 motion-reduce:animate-none" style={{ borderColor: 'var(--theme-border)' }}>
      {items === null && <p className="text-[13px]" style={muted}>{pt ? 'Carregando…' : 'Loading…'}</p>}
      {top.map(item => (
        <div key={item.id} className="space-y-2">
          <CommentRow item={item} pt={pt} onReply={canPost ? () => { setReplyTo(item); input.current?.focus() } : undefined}
            onDelete={() => { void remove(item.id) }} onReport={() => setReporting({ type: 'comment', commentId: item.id })} />
          {replies(item.id).map(reply => (
            <CommentRow key={reply.id} item={reply} pt={pt} reply onDelete={() => { void remove(reply.id) }} onReport={() => setReporting({ type: 'comment', commentId: reply.id })} />
          ))}
        </div>
      ))}
      {canPost
        ? <div className="space-y-1.5">
            {replyTo && (
              <p className="text-[12px] flex items-center gap-1.5" style={muted}>
                {pt ? 'Respondendo a' : 'Replying to'} <b>@{replyTo.author.handle}</b>
                <button type="button" onClick={() => setReplyTo(null)} aria-label={pt ? 'Cancelar resposta' : 'Cancel reply'}><X className="w-3.5 h-3.5" /></button>
              </p>
            )}
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <MentionTextarea ref={input} value={body} onChange={setBody} pt={pt} maxLength={COMMENT_MAX} rows={1}
                  placeholder={replyTo ? (pt ? 'Escreva uma resposta' : 'Write a reply') : (pt ? 'Escreva um comentário' : 'Write a comment')}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
                  className="block w-full min-h-9 max-h-32 resize-none rounded-[18px] border pl-3.5 pr-10 py-[7px] text-[13.5px] leading-snug bg-transparent outline-none" style={{ borderColor: 'var(--theme-border)' }} />
              </div>
              <button type="button" disabled={!body.trim()} onClick={() => { void send() }} aria-label={pt ? 'Enviar' : 'Send'}
                className="h-9 w-9 grid place-items-center rounded-full disabled:opacity-40" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        : <p className="text-[12.5px]" style={muted}>{pt ? 'Crie seu perfil para comentar.' : 'Create your profile to comment.'}</p>}
      {error && <p className="text-[12.5px]" role="alert" style={{ color: 'var(--color-destructive)' }}>{error}</p>}
      <ReportDialog open={!!reporting} onOpenChange={open => { if (!open) setReporting(null) }} target={reporting} pt={pt} />
    </div>
  )
}

function activityText(item: FeedItem, pt: boolean): string | null {
  switch (item.kind) {
    case 'started': return pt ? 'começou a ler' : 'started reading'
    case 'progress': return pt ? `avançou para ${item.milestone}% de` : `reached ${item.milestone}% of`
    case 'finished': return pt ? 'terminou de ler' : 'finished reading'
    case 'review': return pt ? 'avaliou' : 'rated'
    case 'goal': return pt ? `atingiu a meta de leitura de ${item.milestone}` : `reached the ${item.milestone} reading goal`
    default: return null
  }
}

function ReviewBody({ item, pt }: { item: FeedItem; pt: boolean }) {
  const [reveal, setReveal] = useState(false)
  const review = item.review
  if (!review) return null
  const hideText = review.spoiler && !reveal && !!review.body
  return (
    <div className="mt-3">
      <RatingStars value={review.rating} size={18} />
      {review.title && <p className="mt-2 font-display text-[20px] leading-snug">{review.title}</p>}
      {review.body && (
        <div className="relative mt-1.5">
          <p className={`text-[15px] leading-relaxed whitespace-pre-line break-words transition-[filter] duration-300 ${hideText ? 'blur-sm select-none' : ''}`} aria-hidden={hideText}>{review.body}</p>
          {hideText && (
            <button type="button" onClick={() => setReveal(true)} className="absolute inset-0 grid place-items-center">
              <span className="h-8 px-3.5 inline-flex items-center rounded-full border text-[12.5px] font-medium" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
                {pt ? 'Contém spoiler. Mostrar' : 'Contains spoilers. Show'}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Uma publicação ou atividade. `standalone` (página do post) já abre os comentários. */
export function PostCard({ item, covers, pt, canPost, onDeleted, standalone = false }: { item: FeedItem; covers: Covers; pt: boolean; canPost: boolean; onDeleted: () => void; standalone?: boolean }) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(item.liked)
  const [likes, setLikes] = useState(item.likes)
  const [comments, setComments] = useState(item.comments)
  const [open, setOpen] = useState(standalone)
  const [copied, setCopied] = useState(false)
  const [burst, setBurst] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ body: item.body ?? '', audience: item.audience })
  const [shown, setShown] = useState({ body: item.body, audience: item.audience, edited: !!item.editedAt })
  const [reporting, setReporting] = useState(false)
  const activity = activityText(item, pt)
  const finished = item.kind === 'finished' || item.kind === 'goal'

  const applyLike = async (next: boolean) => {
    if (!user || next === liked) return
    setLiked(next); setLikes(count => count + (next ? 1 : -1))
    try { await setLike(item.id, user.id, next) } catch (err) { setLiked(!next); setLikes(count => count + (next ? -1 : 1)); toast(errorText(err, pt), { tone: 'error' }) }
  }
  // No celular abre o compartilhar do sistema; no computador copia o link.
  const share = async () => {
    const url = postUrl(item.id)
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) await navigator.share({ url, title: 'Bookmoo' })
      else { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1600) }
    } catch { /* a pessoa cancelou */ }
  }
  const saveEdit = async () => {
    try {
      await updatePost(item.id, draft)
      setShown({ body: draft.body.trim(), audience: draft.audience, edited: true })
      setEditing(false)
    } catch (err) { toast(errorText(err, pt), { tone: 'error' }) }
  }
  const remove = async () => {
    if (!await askConfirm(pt ? 'Apagar esta publicação?' : 'Delete this post?')) return
    try { await deletePost(item); onDeleted() } catch (err) { toast(errorText(err, pt), { tone: 'error' }) }
  }
  const block = async () => {
    if (!user || !await askConfirm(pt ? `Bloquear @${item.author.handle}? Vocês não poderão interagir.` : `Block @${item.author.handle}?`)) return
    try { await blockUser(user.id, item.author.userId); toast(pt ? 'Pessoa bloqueada.' : 'Blocked.', { tone: 'success' }); onDeleted() } catch (err) { toast(errorText(err, pt), { tone: 'error' }) }
  }

  return (
    <article className="rounded-3xl border overflow-hidden" style={finished ? { ...card, backgroundColor: 'var(--pastel-green-bg)', color: 'var(--pastel-green-fg)' } : card}>
      <div className="px-4 sm:px-5 pt-4 sm:pt-5">
      <header className="flex items-center gap-3">
        <Link to={`/u/${item.author.handle}`} className="shrink-0"><Avatar src={item.author.avatarUrl} name={item.author.name || item.author.handle} size={42} /></Link>
        <AuthorLine author={item.author} at={item.at} pt={pt} postId={item.id} edited={shown.edited} audience={shown.audience} action={activity} />
        <LevelBadge id={item.author.level} pt={pt} variant="compact" className="border hidden sm:inline-block shrink-0" />
        {item.kind === 'goal' ? <Target className="w-5 h-5 shrink-0" /> : item.kind === 'finished' ? <PartyPopper className="w-5 h-5 shrink-0" /> : null}
        <MoreMenu label={pt ? 'Mais opções' : 'More options'}>
          <MenuItem onClick={() => { void share() }} icon={<Link2 className="w-4 h-4" />}>{pt ? 'Copiar link' : 'Copy link'}</MenuItem>
          {item.mine && item.kind === 'post' && <MenuItem onClick={() => { setDraft({ body: shown.body ?? '', audience: shown.audience }); setEditing(true) }} icon={<Pencil className="w-4 h-4" />}>{pt ? 'Editar' : 'Edit'}</MenuItem>}
          {item.mine && item.kind !== 'review' && <MenuItem onClick={() => { void remove() }} icon={<Trash2 className="w-4 h-4" />} danger>{pt ? 'Apagar' : 'Delete'}</MenuItem>}
          {!item.mine && <MenuItem onClick={() => setReporting(true)} icon={<Flag className="w-4 h-4" />}>{pt ? 'Denunciar' : 'Report'}</MenuItem>}
          {!item.mine && <MenuItem onClick={() => { void block() }} icon={<Ban className="w-4 h-4" />} danger>{pt ? `Bloquear @${item.author.handle}` : `Block @${item.author.handle}`}</MenuItem>}
        </MoreMenu>
      </header>

      {editing
        ? <div className="mt-3 space-y-2">
            <MentionTextarea value={draft.body} onChange={body => setDraft({ ...draft, body })} pt={pt} maxLength={POST_MAX} rows={3} autoFocus
              className="w-full rounded-2xl border pl-3 pr-10 py-2 text-[15px] leading-relaxed bg-transparent outline-none resize-none" style={{ borderColor: 'var(--theme-border)' }} />
            <div className="flex flex-wrap items-center gap-2">
              <AudienceSelect<Audience> value={draft.audience} onChange={audience => setDraft({ ...draft, audience })} options={AUDIENCES} pt={pt} />
              <span className="flex-1" />
              <button type="button" onClick={() => setEditing(false)} className="h-8 px-3 rounded-full border text-[12.5px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Cancelar' : 'Cancel'}</button>
              <button type="button" disabled={!draft.body.trim() && !item.imageUrl} onClick={() => { void saveEdit() }} className="h-8 px-3.5 rounded-full text-[12.5px] font-medium disabled:opacity-50"
                style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Salvar' : 'Save'}</button>
            </div>
          </div>
        : shown.body && <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line break-words"><RichText text={shown.body} /></p>}

      {item.kind === 'review' && <ReviewBody item={item} pt={pt} />}

      {item.imageUrl && (
        <div className="relative mt-3 rounded-2xl overflow-hidden select-none" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}
          onDoubleClick={() => { setBurst(n => n + 1); void applyLike(true) }}>
          <img src={item.imageUrl} alt="" loading="lazy" decoding="async" draggable={false} className="block w-full max-h-[560px] object-cover" />
          {burst > 0 && (
            <Heart key={burst} className="absolute left-1/2 top-1/2 w-20 h-20 -ml-10 -mt-10 pointer-events-none animate-[ping_0.7s_ease-out_1_forwards] motion-reduce:hidden"
              style={{ color: 'var(--theme-card-bg)' }} fill="currentColor" />
          )}
        </div>
      )}

      {item.book && item.kind !== 'goal' && <BookChip item={item} covers={covers} pt={pt} />}

      </div>
      {/* Ações: três botões iguais, separados do conteúdo por uma linha. */}
      <footer className="mt-3 mx-2 sm:mx-3 grid grid-cols-3 border-t py-1" style={{ borderColor: finished ? 'color-mix(in srgb, currentColor 18%, transparent)' : 'var(--theme-border)' }}>
        <button type="button" onClick={() => { void applyLike(!liked) }} aria-pressed={liked} aria-label={pt ? 'Curtir' : 'Like'}
          className="h-10 inline-flex items-center justify-center gap-2 rounded-xl text-[13.5px] font-medium transition-colors hover:bg-[var(--theme-nav-hover)]"
          style={{ color: liked ? 'var(--pastel-rose-fg)' : finished ? 'inherit' : 'var(--theme-text-secondary)' }}>
          <Heart className={`w-[18px] h-[18px] transition-transform duration-200 motion-reduce:transition-none ${liked ? 'scale-110' : ''}`} fill={liked ? 'currentColor' : 'none'} />
          <span className="hidden sm:inline">{pt ? 'Curtir' : 'Like'}</span>{likes > 0 && <span className="tabular-nums">{likes}</span>}
        </button>
        <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label={pt ? 'Comentários' : 'Comments'}
          className="h-10 inline-flex items-center justify-center gap-2 rounded-xl text-[13.5px] font-medium transition-colors hover:bg-[var(--theme-nav-hover)]"
          style={{ color: open ? 'var(--theme-text)' : finished ? 'inherit' : 'var(--theme-text-secondary)' }}>
          <MessageCircle className="w-[18px] h-[18px]" />
          <span className="hidden sm:inline">{pt ? 'Comentar' : 'Comment'}</span>{comments > 0 && <span className="tabular-nums">{comments}</span>}
        </button>
        <button type="button" onClick={() => { void share() }} aria-label={pt ? 'Compartilhar' : 'Share'}
          className="h-10 inline-flex items-center justify-center gap-2 rounded-xl text-[13.5px] font-medium transition-colors hover:bg-[var(--theme-nav-hover)]"
          style={{ color: finished ? 'inherit' : 'var(--theme-text-secondary)' }}>
          {copied ? <Check className="w-[18px] h-[18px]" /> : <Link2 className="w-[18px] h-[18px]" />}
          <span className="hidden sm:inline">{copied ? (pt ? 'Link copiado' : 'Link copied') : (pt ? 'Compartilhar' : 'Share')}</span>
        </button>
      </footer>
      {open && <div className="border-t px-4 sm:px-5 pb-4" style={{ borderColor: 'var(--theme-border)' }}><Comments postId={item.id} pt={pt} canPost={canPost} onCount={delta => setComments(count => Math.max(0, count + delta))} /></div>}
      <ReportDialog open={reporting} onOpenChange={setReporting} pt={pt} target={{ type: 'post', postId: item.id }} onDone={onDeleted} />
    </article>
  )
}

/** Timeline com carga automática ao chegar no fim (e botão, se o navegador não observar). */
export function Feed({ scope, userId, covers, pt, canPost, refreshKey = 0, empty, filter }: {
  scope: FeedScope
  userId?: string
  covers: Covers
  pt: boolean
  canPost: boolean
  refreshKey?: number
  empty?: string
  /** Mostra só alguns tipos (por exemplo, só resenhas no perfil). */
  filter?: (item: FeedItem) => boolean
}) {
  const [items, setItems] = useState<FeedItem[] | null>(null)
  const [more, setMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const PAGE = 20

  useEffect(() => {
    const controller = new AbortController()
    setItems(null)
    void loadFeed(scope, { userId, limit: PAGE, signal: controller.signal }).then(next => {
      if (controller.signal.aborted) return
      setItems(next); setMore(next.length >= PAGE)
    })
    return () => controller.abort()
  }, [scope, userId, refreshKey])

  const loadMore = async () => {
    if (!items?.length || loadingMore) return
    setLoadingMore(true)
    const next = await loadFeed(scope, { userId, before: items[items.length - 1].at, limit: PAGE })
    setItems(current => {
      const seen = new Set((current ?? []).map(item => item.id))
      return [...(current ?? []), ...next.filter(item => !seen.has(item.id))]
    })
    setMore(next.length >= PAGE)
    setLoadingMore(false)
  }

  useEffect(() => {
    const element = sentinel.current
    if (!element || !more || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) void loadMore() }, { rootMargin: '600px' })
    observer.observe(element)
    return () => observer.disconnect()
  })

  if (items === null) {
    return (
      <div className="space-y-3" aria-hidden>
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-3xl border p-5 space-y-3" style={card}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
              <div className="h-3 w-40 rounded animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
            </div>
            <div className="h-3 w-4/5 rounded animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
          </div>
        ))}
      </div>
    )
  }
  const shown = filter ? items.filter(filter) : items
  if (shown.length === 0 && !more) return <EmptyState illustration="chatting" title={empty ?? (pt ? 'Nada por aqui ainda.' : 'Nothing here yet.')} />
  return (
    <div className="space-y-3">
      {shown.map(item => (
        <PostCard key={item.id} item={item} covers={covers} pt={pt} canPost={canPost}
          onDeleted={() => setItems(current => (current ?? []).filter(other => other.id !== item.id))} />
      ))}
      {more && (
        <div ref={sentinel}>
          <button type="button" onClick={() => { void loadMore() }} disabled={loadingMore}
            className="w-full h-10 rounded-full border text-[13.5px]" style={{ borderColor: 'var(--theme-border)' }}>
            {loadingMore ? (pt ? 'Carregando…' : 'Loading…') : (pt ? 'Carregar mais' : 'Load more')}
          </button>
        </div>
      )}
    </div>
  )
}
