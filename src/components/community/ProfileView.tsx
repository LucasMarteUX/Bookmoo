import { askConfirm } from '@/components/ui/confirm'
// Perfil social: cabeçalho (capa, foto, identidade, relação, estatísticas) e as seções
// reaproveitadas pelas abas do perfil (estante, meta, resultados, estudando).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Ban, CalendarDays, Globe, Heart, Lock, Pencil, Target } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { BookCover } from '@/components/book/BookCard'
import { Avatar } from '@/components/ui/avatar'
import { LevelBadge } from '@/components/ui/level-badge'
import { toast } from '@/components/ui/toast'
import { FollowButton, type FollowState } from './FollowButton'
import { ProfileBanner } from './ProfileBanner'
import { cardStyle, FriendButton, MenuItem, MoreMenu, muted, ProfileMenu, ProgressBar } from './social-ui'
import {
  shelfCover, socialLink, updateShelfBook,
  type ProfileBlock, type ProfileStats, type ProfileView as View, type Relation, type ShelfItem, type Socials,
} from '@/lib/communityProfile'
import { deleteGoal, errorText, saveGoal } from '@/lib/social'

const card = cardStyle
export type ProfileTab = 'overview' | 'activity' | 'shelf' | 'reviews' | 'goals'

/** Prévia em Configurações: cabeçalho e as seções principais. */
export function ProfileView({ view, pt, asVisitor = false }: { view: View; pt: boolean; asVisitor?: boolean }) {
  const ownerSees = view.isOwner && !asVisitor
  const visible = (block: ProfileBlock) => view.show[block] || ownerSees
  return (
    <div className="space-y-5">
      <ProfileHeader view={view} pt={pt} asVisitor={asVisitor} />
      {visible('stats') && view.stats && <Block title={pt ? 'Resultados' : 'Results'} locked={ownerSees && !view.show.stats} pt={pt}><Results stats={view.stats} pt={pt} /></Block>}
      {visible('shelf') && view.shelf && <Block title={pt ? 'Estante' : 'Shelf'} locked={ownerSees && !view.show.shelf} pt={pt}><SocialBookshelf items={view.shelf} pt={pt} editable={false} /></Block>}
    </div>
  )
}

/** Capa, foto sobreposta, nome, @, nível, relação e estatísticas. */
export function ProfileHeader({ view, pt, asVisitor = false, onTab, onRelationChange }: {
  view: View
  pt: boolean
  asVisitor?: boolean
  onTab?: (tab: ProfileTab) => void
  onRelationChange?: () => void
}) {
  const ownerSees = view.isOwner && !asVisitor
  const [relation, setRelation] = useState<Relation>(view.relation)
  const [followers, setFollowers] = useState(view.followers)
  const [friends, setFriends] = useState(view.friends)
  useEffect(() => { setRelation(view.relation); setFollowers(view.followers); setFriends(view.friends) }, [view])
  const fmt = new Intl.NumberFormat(pt ? 'pt-BR' : 'en-US')
  const showSocials = (view.show.socials || ownerSees) && !view.restricted
  const links = view.socials && showSocials
    ? (['instagram', 'x', 'website'] as (keyof Socials)[])
        .map(kind => ({ kind, link: socialLink(kind, view.socials![kind]) }))
        .filter((item): item is { kind: keyof Socials; link: { href: string; label: string } } => !!item.link)
    : []
  const base = view.handle && !asVisitor ? `/u/${view.handle}` : ''
  const counts: { value: number; label: string; to?: string; tab?: ProfileTab }[] = view.restricted ? [
    { value: followers, label: pt ? 'seguidores' : 'followers' },
    { value: view.following, label: pt ? 'seguindo' : 'following' },
  ] : [
    { value: view.booksRead, label: pt ? (view.booksRead === 1 ? 'lido' : 'lidos') : 'read', tab: 'shelf' },
    { value: view.booksReading, label: pt ? 'lendo' : 'reading', tab: 'shelf' },
    { value: view.booksWant, label: pt ? 'quero ler' : 'want to read', tab: 'shelf' },
    { value: view.reviews, label: pt ? (view.reviews === 1 ? 'avaliação' : 'avaliações') : (view.reviews === 1 ? 'review' : 'reviews'), tab: 'reviews' },
    { value: followers, label: pt ? (followers === 1 ? 'seguidor' : 'seguidores') : (followers === 1 ? 'follower' : 'followers'), to: base && `${base}/seguidores` },
    { value: view.following, label: pt ? 'seguindo' : 'following', to: base && `${base}/seguindo` },
    { value: friends, label: pt ? (friends === 1 ? 'amigo' : 'amigos') : (friends === 1 ? 'friend' : 'friends'), to: base && `${base}/amigos` },
  ]
  const onFollow = (next: FollowState, previous: FollowState) => {
    setRelation(current => ({ ...current, following: next === 'following', followPending: next === 'pending' }))
    if (previous === 'following' && next !== 'following') setFollowers(count => Math.max(0, count - 1))
    if (next === 'following' && previous !== 'following') setFollowers(count => count + 1)
    if (next === 'following' && view.restricted) onRelationChange?.()
  }
  const onFriend = (state: Relation['friend']) => {
    setFriends(count => count + (state === 'friends' ? 1 : relation.friend === 'friends' ? -1 : 0))
    setRelation(current => ({ ...current, friend: state }))
    if (state === 'friends' && view.restricted) onRelationChange?.()
  }
  const joined = view.joinedAt ? new Date(view.joinedAt).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { month: 'long', year: 'numeric' }) : ''

  return (
    <header className="rounded-3xl border overflow-hidden" style={card}>
      {view.coverUrl
        ? <div className="h-32 sm:h-48 overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
            <img src={view.coverUrl} alt="" className="w-full h-full object-cover" decoding="async" />
          </div>
        : <ProfileBanner id={view.banner} className="h-32 sm:h-48" />}
      <div className="px-5 sm:px-8 pb-6">
        <div className="relative z-10 flex items-end justify-between gap-3 -mt-11 sm:-mt-16">
          <span className="rounded-full p-1 shrink-0" style={{ backgroundColor: 'var(--theme-card-bg)' }}>
            <Avatar src={view.avatarUrl} name={view.name || view.handle} size={120} className="hidden sm:grid" />
            <Avatar src={view.avatarUrl} name={view.name || view.handle} size={84} className="sm:hidden" />
          </span>
          <div className="pb-1 flex flex-wrap justify-end items-center gap-2">
            {ownerSees
              ? <Link to="/settings#profile" className="h-9 px-4 inline-flex items-center gap-1.5 rounded-full border text-[13px] font-medium" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
                  <Pencil className="w-3.5 h-3.5" />{pt ? 'Editar perfil' : 'Edit profile'}
                </Link>
              : !view.isOwner && !relation.blockedByMe && (
                <>
                  <FollowButton userId={view.userId} following={relation.following} pending={relation.followPending} pt={pt} onChange={onFollow} />
                  <span className="hidden sm:inline-flex"><FriendButton userId={view.userId} state={relation.friend} pt={pt} onChange={onFriend} /></span>
                </>
              )}
            {!view.isOwner && !asVisitor && <ProfileMenu person={view} relation={relation} pt={pt} onChange={() => onRelationChange?.()} />}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="font-display text-[30px] sm:text-[40px] leading-[1.05] break-words">{view.name || view.handle || (pt ? 'Leitor' : 'Reader')}</h1>
          <LevelBadge id={view.level} pt={pt} />
        </div>
        <p className="mt-1 text-[14px] flex flex-wrap items-center gap-x-3 gap-y-1" style={muted}>
          {view.handle && <span>@{view.handle}</span>}
          {joined && <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{pt ? `No Bookmoo desde ${joined}` : `Joined ${joined}`}</span>}
          {!view.isPublic && <span className="inline-flex items-center gap-1"><Lock className="w-3.5 h-3.5" />{pt ? 'Perfil fechado' : 'Closed profile'}</span>}
          {relation.followsMe && !view.isOwner && <span className="rounded-full px-2 py-0.5 text-[11.5px]" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{pt ? 'Segue você' : 'Follows you'}</span>}
        </p>
        {!view.isOwner && !relation.blockedByMe && !asVisitor && (
          <div className="mt-3 sm:hidden"><FriendButton userId={view.userId} state={relation.friend} pt={pt} size="sm" onChange={onFriend} /></div>
        )}

        {view.bio && !view.restricted && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed whitespace-pre-line">{view.bio}</p>}
        {(view.goal || links.length > 0) && !view.restricted && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {view.goal && (
              <span className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-[12.5px]" style={{ backgroundColor: 'var(--pastel-sand-bg)', color: 'var(--pastel-sand-fg)' }}>
                <Target className="w-3.5 h-3.5" />{view.goal}
              </span>
            )}
            {links.map(({ kind, link }) => (
              <a key={kind} href={link.href} target="_blank" rel="noopener noreferrer nofollow"
                className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full border text-[12.5px] transition-colors hover:bg-[var(--ui-hover)]" style={{ borderColor: 'var(--theme-border)' }}>
                {kind === 'website' ? <Globe className="w-3.5 h-3.5" /> : <span className="font-semibold">{kind === 'instagram' ? 'IG' : 'X'}</span>}
                {link.label}
              </a>
            ))}
          </div>
        )}

        <dl className="mt-5 pt-4 border-t grid grid-cols-4 sm:grid-cols-7 gap-y-3" style={{ borderColor: 'var(--theme-border)' }}>
          {counts.map(item => {
            const content = (
              <>
                <dt className="mt-1 text-[12px]" style={muted}>{item.label}</dt>
                <dd className="text-[18px] font-semibold tabular-nums leading-none" style={{ color: 'var(--theme-text)' }}>{fmt.format(item.value)}</dd>
              </>
            )
            const className = 'flex flex-col-reverse text-left rounded-lg -mx-1 px-1 transition-colors hover:bg-[var(--ui-hover)]'
            return item.to
              ? <Link key={item.label} to={item.to} className={className}>{content}</Link>
              : item.tab && onTab
                ? <button key={item.label} type="button" onClick={() => onTab(item.tab!)} className={className}>{content}</button>
                : <div key={item.label} className="flex flex-col-reverse">{content}</div>
          })}
        </dl>
      </div>
    </header>
  )
}

function LockNote({ pt }: { pt: boolean }) {
  return <span className="inline-flex items-center gap-1 text-[12px]" style={muted}><Lock className="w-3 h-3" />{pt ? 'Só você vê' : 'Only you see this'}</span>
}

export function Block({ title, locked = false, pt, children, action }: { title: string; locked?: boolean; pt: boolean; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-3xl border p-5 sm:p-7" style={card}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {locked ? <LockNote pt={pt} /> : action}
      </div>
      {children}
    </section>
  )
}

export function StudyingWords({ words, pt }: { words: string[]; pt: boolean }) {
  if (words.length === 0) return <p className="text-[13.5px]" style={muted}>{pt ? 'Nenhuma palavra em revisão.' : 'No words in review.'}</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {words.map(word => (
        <span key={word} className="rounded-full px-3 py-1 text-[13.5px] font-serif" style={{ backgroundColor: 'var(--pastel-amber-bg)', color: 'var(--pastel-amber-fg)' }}>{word}</span>
      ))}
    </div>
  )
}

export function Results({ stats, pt }: { stats: ProfileStats; pt: boolean }) {
  const fmt = new Intl.NumberFormat(pt ? 'pt-BR' : 'en-US')
  const hours = stats.minutes >= 60 ? `${fmt.format(Math.floor(stats.minutes / 60))} h` : `${fmt.format(stats.minutes)} min`
  // Cada tom usa o seu par fundo/texto: os dois mudam juntos no tema escuro.
  const tiles: [string, string, string][] = [
    [fmt.format(stats.points), pt ? 'pontos' : 'points', 'amber'],
    [fmt.format(stats.streak), pt ? (stats.streak === 1 ? 'dia seguido' : 'dias seguidos') : 'day streak', 'rose'],
    [fmt.format(stats.words), pt ? 'palavras salvas' : 'saved words', 'blue'],
    [fmt.format(stats.learned), pt ? 'aprendidas' : 'learned', 'green'],
    [hours, pt ? 'de estudo' : 'studied', 'sand'],
    [fmt.format(stats.booksFinished), pt ? (stats.booksFinished === 1 ? 'livro concluído' : 'livros concluídos') : 'books finished', 'sand'],
  ]
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {tiles.map(([value, label, tone]) => (
          <div key={label} className="rounded-2xl px-4 py-3.5" style={{ backgroundColor: `var(--pastel-${tone}-bg)`, color: `var(--pastel-${tone}-fg)` }}>
            <p className="font-display text-[28px] leading-none tabular-nums">{value}</p>
            <p className="mt-1.5 text-[12.5px]" style={{ opacity: 0.8 }}>{label}</p>
          </div>
        ))}
      </div>
      <Heatmap days={stats.days} pt={pt} />
    </div>
  )
}

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const heat = (points: number) => points <= 0 ? 'color-mix(in srgb, var(--theme-text) 8%, transparent)'
  : `color-mix(in srgb, var(--theme-text) ${points < 10 ? 25 : points < 30 ? 45 : points < 60 ? 70 : 100}%, transparent)`
const CELL = 14
const GAP = 3

/** Ocupa a largura toda: cabem tantas semanas quanto a largura deixa (até um ano). */
function Heatmap({ days, pt }: { days: Record<string, number>; pt: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(26)
  useEffect(() => {
    const element = box.current
    if (!element) return
    const measure = () => setCount(Math.max(12, Math.min(53, Math.floor((element.clientWidth + GAP) / (CELL + GAP)))))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const weeks = useMemo(() => {
    const today = new Date(); today.setHours(12, 0, 0, 0)
    const start = new Date(today); start.setDate(start.getDate() - today.getDay() - (count - 1) * 7)
    return Array.from({ length: count }, (_, w) => Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start); date.setDate(start.getDate() + w * 7 + d)
      return { key: dayKey(date), points: days[dayKey(date)] ?? 0, future: date > today, date }
    }))
  }, [days, count])
  const locale = pt ? 'pt-BR' : 'en-US'
  const active = weeks.flat().filter(day => day.points > 0).length
  const months = weeks.map((week, i) => {
    const first = week[0].date
    const prev = weeks[i - 1]?.[0].date
    return !prev || prev.getMonth() !== first.getMonth() ? first.toLocaleDateString(locale, { month: 'short' }).replace('.', '') : ''
  })
  const span = count >= 50 ? (pt ? 'no último ano' : 'in the last year') : (pt ? `nas últimas ${count} semanas` : `in the last ${count} weeks`)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-[12.5px]" style={muted}>
        <span>{pt ? `${active} ${active === 1 ? 'dia' : 'dias'} com estudo ${span}` : `${active} study ${active === 1 ? 'day' : 'days'} ${span}`}</span>
        <span className="hidden sm:inline-flex items-center gap-1">
          {pt ? 'menos' : 'less'}
          {[0, 5, 20, 45, 80].map(points => <span key={points} className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: heat(points) }} />)}
          {pt ? 'mais' : 'more'}
        </span>
      </div>
      <div ref={box} className="w-full">
        <div className="grid text-[10.5px] mb-1" style={{ ...muted, gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`, columnGap: GAP }}>
          {months.map((label, i) => <span key={i} className="whitespace-nowrap overflow-visible">{label}</span>)}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`, gridTemplateRows: 'repeat(7, auto)', gridAutoFlow: 'column', gap: GAP }}>
          {weeks.flat().map(day => (
            <span key={day.key} className="aspect-square rounded-[3px]" title={`${day.date.toLocaleDateString(locale)} · ${day.points} ${pt ? 'pontos' : 'points'}`}
              style={{ backgroundColor: day.future ? 'transparent' : heat(day.points) }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Estante ───

export type ShelfCategory = 'reading' | 'read' | 'want' | 'abandoned' | 'favorites'

export function shelfCategory(item: ShelfItem): Exclude<ShelfCategory, 'favorites'> {
  if (item.status === 'abandoned') return 'abandoned'
  if (item.finishedAt || item.progress >= 100) return 'read'
  if (item.progress > 0) return 'reading'
  return 'want'
}

export function SocialBookshelf({ items, pt, editable }: { items: ShelfItem[]; pt: boolean; editable: boolean }) {
  const [list, setList] = useState(items)
  useEffect(() => setList(items), [items])
  const groups: Record<ShelfCategory, ShelfItem[]> = {
    reading: list.filter(item => shelfCategory(item) === 'reading'),
    read: list.filter(item => shelfCategory(item) === 'read'),
    want: list.filter(item => shelfCategory(item) === 'want'),
    abandoned: list.filter(item => shelfCategory(item) === 'abandoned'),
    favorites: list.filter(item => item.favorite),
  }
  const [tab, setTab] = useState<ShelfCategory>(groups.reading.length ? 'reading' : groups.read.length ? 'read' : 'want')
  const labels: Record<ShelfCategory, string> = {
    reading: pt ? 'Lendo' : 'Reading',
    read: pt ? 'Lidos' : 'Read',
    want: pt ? 'Quero ler' : 'Want to read',
    abandoned: pt ? 'Abandonados' : 'Abandoned',
    favorites: pt ? 'Favoritos' : 'Favorites',
  }
  const update = async (item: ShelfItem, patch: Partial<Pick<ShelfItem, 'status' | 'favorite'>>) => {
    const previous = list
    setList(current => current.map(other => other.id === item.id ? { ...other, ...patch } : other))
    try { await updateShelfBook(item.id, patch) } catch (err) { setList(previous); toast(errorText(err, pt), { tone: 'error' }) }
  }
  if (list.length === 0) return <p className="text-[13.5px]" style={muted}>{pt ? 'A estante ainda está vazia.' : 'The shelf is still empty.'}</p>
  return (
    <div>
      <div className="flex p-0.5 rounded-lg overflow-x-auto w-full sm:w-auto sm:inline-flex" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} role="tablist">
        {(Object.keys(groups) as ShelfCategory[]).map(key => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className="h-8 px-2.5 shrink-0 rounded-md text-[12.5px] font-medium whitespace-nowrap transition-colors"
            style={{ backgroundColor: tab === key ? 'var(--theme-card-bg)' : 'transparent', color: tab === key ? 'var(--theme-text)' : 'var(--theme-text-secondary)', boxShadow: tab === key ? '0 1px 2px rgba(0,0,0,0.08)' : undefined }}>
            {labels[key]} <span className="tabular-nums" style={{ opacity: 0.6 }}>{groups[key].length}</span>
          </button>
        ))}
      </div>
      {groups[tab].length === 0
        ? <p className="mt-5 text-[13.5px]" style={muted}>{pt ? 'Nada aqui ainda.' : 'Nothing here yet.'}</p>
        : <div className="mt-5 grid gap-x-5 gap-y-7 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {groups[tab].map(item => <ShelfBook key={item.id} item={item} pt={pt} editable={editable} onUpdate={patch => { void update(item, patch) }} />)}
          </div>}
    </div>
  )
}

function ShelfBook({ item, pt, editable, onUpdate }: { item: ShelfItem; pt: boolean; editable: boolean; onUpdate: (patch: Partial<Pick<ShelfItem, 'status' | 'favorite'>>) => void }) {
  const [cover, setCover] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!item.hasCover) return
    let alive = true
    void shelfCover(item.id).then(data => { if (alive && data) setCover(data) })
    return () => { alive = false }
  }, [item.id, item.hasCover])
  const reading = item.progress > 0 && item.progress < 100 && !item.finishedAt
  const coverNode = (
    <BookCover title={item.title} coverData={cover} className="transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transition-none">
      {reading && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/25">
          <div className="h-full bg-white/90" style={{ width: `${item.progress}%` }} />
        </div>
      )}
      {item.favorite && <Heart className="absolute right-1.5 top-1.5 w-4 h-4 drop-shadow" style={{ color: 'var(--theme-card-bg)' }} fill="currentColor" />}
    </BookCover>
  )
  return (
    <div className="group relative">
      {item.catalogId ? <Link to={`/gallery/${item.catalogId}`} className="block">{coverNode}</Link> : coverNode}
      <div className="mt-2.5 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium leading-snug line-clamp-2">{item.title}</p>
          <p className="text-[12px] truncate" style={muted}>
            {reading ? `${item.progress}%` : item.author || (item.finishedAt ? (pt ? 'Concluído' : 'Finished') : '')}
          </p>
        </div>
        {editable && (
          <MoreMenu label={pt ? 'Opções do livro' : 'Book options'} size="sm">
            <MenuItem onClick={() => onUpdate({ favorite: !item.favorite })} icon={<Heart className="w-4 h-4" />}>
              {item.favorite ? (pt ? 'Tirar dos favoritos' : 'Remove from favorites') : (pt ? 'Favoritar' : 'Add to favorites')}
            </MenuItem>
            <MenuItem onClick={() => onUpdate({ status: item.status === 'abandoned' ? null : 'abandoned' })} icon={<Ban className="w-4 h-4" />}>
              {item.status === 'abandoned' ? (pt ? 'Voltar para a estante' : 'Move back to shelf') : (pt ? 'Marcar como abandonado' : 'Mark as abandoned')}
            </MenuItem>
          </MoreMenu>
        )}
      </div>
    </div>
  )
}

/** O livro em leitura mais recente, com capa e progresso. */
export function CurrentlyReading({ items, pt }: { items: ShelfItem[]; pt: boolean }) {
  const current = items.find(item => shelfCategory(item) === 'reading')
  const [cover, setCover] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!current?.hasCover) return
    let alive = true
    void shelfCover(current.id).then(data => { if (alive && data) setCover(data) })
    return () => { alive = false }
  }, [current?.id, current?.hasCover])
  if (!current) return <p className="text-[13.5px]" style={muted}>{pt ? 'Nenhum livro em leitura agora.' : 'Not reading anything right now.'}</p>
  const body = (
    <div className="flex items-center gap-5">
      <BookCover title={current.title} coverData={cover} className="w-20 sm:w-24 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[22px] sm:text-[26px] leading-tight line-clamp-2">{current.title}</p>
        {current.author && <p className="mt-1 text-[14px]" style={muted}>{current.author}</p>}
        <div className="mt-4 flex items-center gap-3 max-w-sm">
          <ProgressBar value={current.progress} className="flex-1" />
          <span className="text-[12.5px] tabular-nums" style={muted}>{current.progress}%</span>
        </div>
      </div>
    </div>
  )
  return current.catalogId ? <Link to={`/gallery/${current.catalogId}`} className="block">{body}</Link> : body
}

/** Fileira de capas favoritas. */
export function FavoriteShelf({ items, pt }: { items: ShelfItem[]; pt: boolean }) {
  const favorites = items.filter(item => item.favorite).slice(0, 8)
  if (!favorites.length) return <p className="text-[13.5px]" style={muted}>{pt ? 'Nenhum favorito ainda.' : 'No favorites yet.'}</p>
  return (
    <div className="-mx-1 px-1 flex gap-4 overflow-x-auto pb-3">
      {favorites.map(item => <div key={item.id} className="w-24 shrink-0"><ShelfBook item={item} pt={pt} editable={false} onUpdate={() => {}} /></div>)}
    </div>
  )
}

// ─── Meta de leitura ───

/** Meta do ano: definida pela dona, contada pelos livros realmente concluídos no ano. */
export function ReadingGoalCard({ view, pt, compact = false, onChanged }: { view: View; pt: boolean; compact?: boolean; onChanged?: () => void }) {
  const { user } = useAuth()
  const year = new Date().getFullYear()
  const goal = view.readingGoal
  const doneThisYear = useMemo(() => goal?.done ?? (view.shelf ?? []).filter(item => item.finishedAt && new Date(item.finishedAt).getFullYear() === year).length, [goal, view.shelf, year])
  const [editing, setEditing] = useState(false)
  const [target, setTarget] = useState(goal?.target ?? 12)
  const [busy, setBusy] = useState(false)
  const percent = goal ? Math.min(100, Math.round((doneThisYear / goal.target) * 100)) : 0
  const history = useMemo(() => {
    const byYear = new Map<number, number>()
    for (const item of view.shelf ?? []) {
      if (!item.finishedAt) continue
      const y = new Date(item.finishedAt).getFullYear()
      byYear.set(y, (byYear.get(y) ?? 0) + 1)
    }
    return [...byYear.entries()].sort((a, b) => b[0] - a[0])
  }, [view.shelf])

  const save = async () => {
    if (!user) return
    setBusy(true)
    try { await saveGoal(user.id, year, target); setEditing(false); onChanged?.() } catch (err) { toast(errorText(err, pt), { tone: 'error' }) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!user || !await askConfirm(pt ? 'Apagar a meta deste ano?' : 'Delete this year’s goal?')) return
    try { await deleteGoal(user.id, year); onChanged?.() } catch (err) { toast(errorText(err, pt), { tone: 'error' }) }
  }

  if (editing && view.isOwner) {
    return (
      <div className="space-y-3">
        <label htmlFor="goal-target" className="block text-[13.5px]">{pt ? `Quantos livros você quer terminar em ${year}?` : `How many books do you want to finish in ${year}?`}</label>
        <div className="flex flex-wrap items-center gap-2">
          <input id="goal-target" type="number" min={1} max={500} value={target} onChange={e => setTarget(Number(e.target.value) || 1)}
            className="w-24 h-10 rounded-xl border px-3 text-[15px] tabular-nums bg-transparent outline-none" style={{ borderColor: 'var(--theme-border)' }} />
          <button type="button" disabled={busy} onClick={() => { void save() }} className="h-10 px-4 rounded-full text-[13.5px] font-medium disabled:opacity-60" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Salvar meta' : 'Save goal'}</button>
          <button type="button" onClick={() => setEditing(false)} className="h-10 px-3 rounded-full text-[13.5px]" style={muted}>{pt ? 'Cancelar' : 'Cancel'}</button>
        </div>
      </div>
    )
  }

  if (!goal) {
    return view.isOwner
      ? <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px]" style={muted}>{pt ? `Você terminou ${doneThisYear} ${doneThisYear === 1 ? 'livro' : 'livros'} em ${year}. Que tal uma meta?` : `You finished ${doneThisYear} books in ${year}. Set a goal?`}</p>
          <button type="button" onClick={() => setEditing(true)} className="h-9 px-4 rounded-full border text-[13px] font-medium" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Definir meta' : 'Set a goal'}</button>
        </div>
      : <p className="text-[13.5px]" style={muted}>{pt ? `Sem meta para ${year}.` : `No goal for ${year}.`}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <p>
          <span className="font-display text-[34px] leading-none tabular-nums">{doneThisYear}</span>
          <span className="text-[15px]" style={muted}> / {goal.target} {pt ? `livros em ${year}` : `books in ${year}`}</span>
        </p>
        {view.isOwner && !compact && (
          <span className="flex gap-3">
            <button type="button" onClick={() => { setTarget(goal.target); setEditing(true) }} className="text-[13px] underline" style={muted}>{pt ? 'Alterar' : 'Change'}</button>
            <button type="button" onClick={() => { void remove() }} className="text-[13px] underline" style={muted}>{pt ? 'Apagar' : 'Delete'}</button>
          </span>
        )}
      </div>
      <ProgressBar value={percent} />
      <p className="text-[13px]" style={muted}>
        {percent >= 100
          ? (pt ? 'Meta atingida. Parabéns!' : 'Goal reached. Congratulations!')
          : (pt ? `Faltam ${goal.target - doneThisYear} ${goal.target - doneThisYear === 1 ? 'livro' : 'livros'}.` : `${goal.target - doneThisYear} to go.`)}
      </p>
      {!compact && history.length > 0 && (
        <div className="pt-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
          <p className="text-[12.5px] mb-2" style={muted}>{pt ? 'Livros concluídos por ano' : 'Books finished per year'}</p>
          <ul className="flex flex-wrap gap-2">
            {history.map(([y, n]) => (
              <li key={y} className="rounded-full px-3 py-1 text-[12.5px]" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                <b className="tabular-nums">{y}</b> · {n} {pt ? (n === 1 ? 'livro' : 'livros') : (n === 1 ? 'book' : 'books')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
