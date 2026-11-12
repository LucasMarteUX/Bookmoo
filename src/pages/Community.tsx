import { askConfirm } from '@/components/ui/confirm'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AtSign, Bell, BookOpen, Check, Compass, Flame, Heart, Lock, MessageCircle, Search, UserCheck, UserPlus, UserRound, Users, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/store/useLanguage'
import { listCatalog, type CatalogBook } from '@/lib/catalog'
import { listPeople, loadProfileView, type PersonCard, type ProfileView as View } from '@/lib/communityProfile'
import {
  acceptFriendRequest, approveFollower, errorText, loadCatalogSocial, loadConnections, loadFeed, loadNotifications, loadPost, loadRequests,
  markNotificationsRead, removeFollower, removeFriendship, timeAgo,
  type AppNotification, type CatalogSocial, type Connection, type FeedItem, type Requests,
} from '@/lib/social'
import { BookCover } from '@/components/book/BookCard'
import { AvatarStack } from '@/components/community/AvatarStack'
import { Composer, Feed, PostCard, type Covers } from '@/components/community/Feed'
import { FollowButton } from '@/components/community/FollowButton'
import { ProfileBanner } from '@/components/community/ProfileBanner'
import {
  Block, CurrentlyReading, FavoriteShelf, ProfileHeader, ReadingGoalCard, Results, SocialBookshelf, StudyingWords, type ProfileTab,
} from '@/components/community/ProfileView'
import { cardStyle, FriendButton, muted, UserListItem } from '@/components/community/social-ui'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { LevelBadge } from '@/components/ui/level-badge'
import { toast } from '@/components/ui/toast'

const card = cardStyle
type Tab = 'all' | 'following' | 'friends' | 'people'

function useCovers() {
  const [books, setBooks] = useState<CatalogBook[]>([])
  useEffect(() => { void listCatalog().then(setBooks).catch(() => {}) }, [])
  const covers = useMemo<Covers>(() => Object.fromEntries(books.map(book => [book.id, book.coverData])), [books])
  return { books, covers }
}

function useMe() {
  const [me, setMe] = useState<View | null | undefined>(undefined)
  useEffect(() => { void loadProfileView('me').then(setMe) }, [])
  return me
}

/** Abas em pílula, presas no topo da coluna. Rolagem horizontal no celular, sem cortar. */
function PillTabs<T extends string>({ value, onChange, items, sticky = false, hideOn }: { value: T; onChange: (value: T) => void; items: [T, string, typeof Compass][]; sticky?: boolean; hideOn?: Partial<Record<T, string>> }) {
  return (
    <div className={sticky ? 'sticky top-0 z-10 -mx-1 px-1 py-2' : ''} style={sticky ? { backgroundColor: 'var(--theme-bg)' } : undefined}>
      <div className="flex p-1 rounded-full overflow-x-auto" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} role="tablist">
        {items.map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={value === id} onClick={() => onChange(id)}
            className={`flex-1 min-w-fit h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-full text-[13.5px] font-medium whitespace-nowrap transition-colors duration-200 ${hideOn?.[id] ?? ''}`}
            style={{ backgroundColor: value === id ? 'var(--theme-card-bg)' : 'transparent', color: value === id ? 'var(--theme-text)' : 'var(--theme-text-secondary)', boxShadow: value === id ? '0 1px 3px rgba(0,0,0,0.08)' : undefined }}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Community() {
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const me = useMe()
  const { books, covers } = useCovers()
  const [people, setPeople] = useState<PersonCard[] | null>(null)
  const [social, setSocial] = useState<CatalogSocial>({})
  const [tab, setTab] = useState<Tab>('all')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    void listPeople({ limit: 30 }).then(setPeople)
    void loadCatalogSocial().then(setSocial)
  }, [])

  const others = (people ?? []).filter(person => !person.isMe)
  const suggestions = others.filter(person => !person.relation.following && !person.relation.followPending)
    .sort((a, b) => b.commonBooks - a.commonBooks).slice(0, 5)
  const trending = useMemo(() => [...books].sort((a, b) => (social[b.id]?.readers ?? 0) - (social[a.id]?.readers ?? 0)).slice(0, 5), [books, social])
  const canPost = !!me?.handle
  const empty: Record<Exclude<Tab, 'people'>, string> = {
    all: pt ? 'Ninguém publicou ainda. Que tal ser a primeira pessoa?' : 'Nobody has posted yet. Be the first.',
    following: pt ? 'Siga pessoas para ver aqui o que elas leem e publicam.' : 'Follow people to see what they read and post.',
    friends: pt ? 'Adicione amigos para ver as leituras deles aqui.' : 'Add friends to see their reading here.',
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_290px]">
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-4"><MeCard me={me} pt={pt} /></div>
        </aside>

        <main className="min-w-0 space-y-4">
          <header className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-[32px] md:text-[40px] leading-[1.05]">{pt ? 'Comunidade' : 'Community'}</h1>
              <p className="mt-1.5 text-[14px]" style={muted}>{pt ? 'Gente aprendendo inglês com livros, lado a lado.' : 'People learning English with books, side by side.'}</p>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <Link to="/notifications" aria-label={pt ? 'Notificações' : 'Notifications'} className="grid place-items-center w-10 h-10 rounded-full border" style={{ borderColor: 'var(--theme-border)' }}><Bell className="w-4 h-4" /></Link>
              <Link to="/u/me" className="shrink-0 rounded-full" aria-label={pt ? 'Meu perfil' : 'My profile'}>
                {me ? <Avatar src={me.avatarUrl} name={me.name || me.handle} size={40} /> : <span className="grid place-items-center w-10 h-10 rounded-full border" style={{ borderColor: 'var(--theme-border)' }}><UserRound className="w-4 h-4" /></span>}
              </Link>
            </div>
          </header>

          {me !== undefined && <Composer me={me} books={books} pt={pt} onPosted={() => { setTab(current => current === 'people' ? 'all' : current); setRefresh(n => n + 1) }} />}

          <PillTabs<Tab> value={tab} onChange={setTab} sticky items={[
            ['all', pt ? 'Geral' : 'Everyone', Compass],
            ['following', pt ? 'Seguindo' : 'Following', Users],
            ['friends', pt ? 'Amigos' : 'Friends', UserCheck],
            ['people', pt ? 'Pessoas' : 'People', Search],
          ]} />

          {tab === 'people'
            ? <DiscoverPeople initial={others} pt={pt} />
            : <Feed key={tab} scope={tab} covers={covers} pt={pt} canPost={canPost} refreshKey={refresh} empty={empty[tab]} />}
        </main>

        <aside className="hidden xl:block">
          <div className="sticky top-6 space-y-4">
            <section className="rounded-3xl border p-5" style={card}>
              <h2 className="text-[14.5px] font-semibold">{pt ? 'Quem seguir' : 'Who to follow'}</h2>
              {people !== null && suggestions.length === 0 && <p className="mt-3 text-[13px]" style={muted}>{others.length ? (pt ? 'Você já segue todo mundo por aqui.' : 'You already follow everyone here.') : (pt ? 'Ainda não há outros perfis abertos.' : 'No other open profiles yet.')}</p>}
              <ul className="mt-3 space-y-3">
                {suggestions.map(person => (
                  <li key={person.userId} className="flex items-center gap-2.5">
                    <Link to={`/u/${person.handle}`} className="shrink-0"><Avatar src={person.avatarUrl} name={person.name || person.handle} size={38} /></Link>
                    <Link to={`/u/${person.handle}`} className="min-w-0 flex-1 leading-tight">
                      <span className="block text-[13.5px] font-medium truncate">{person.name || person.handle}</span>
                      <span className="block text-[12px] truncate" style={muted}>{person.commonBooks > 0 ? (pt ? `${person.commonBooks} ${person.commonBooks === 1 ? 'livro' : 'livros'} em comum` : `${person.commonBooks} books in common`) : `@${person.handle}`}</span>
                    </Link>
                    <FollowButton userId={person.userId} following={person.relation.following} pending={person.relation.followPending} pt={pt} size="sm" />
                  </li>
                ))}
              </ul>
              {others.length > 5 && <button type="button" onClick={() => setTab('people')} className="mt-3 text-[13px] underline" style={muted}>{pt ? 'Ver todas as pessoas' : 'See everyone'}</button>}
            </section>

            {trending.length > 0 && (
              <section className="rounded-3xl border p-5" style={card}>
                <h2 className="text-[14.5px] font-semibold inline-flex items-center gap-1.5"><Flame className="w-4 h-4" />{pt ? 'Em alta na galeria' : 'Trending in the gallery'}</h2>
                <ul className="mt-3 space-y-3">
                  {trending.map(book => {
                    const data = social[book.id]
                    return (
                      <li key={book.id}>
                        <Link to={`/gallery/${book.id}`} className="group flex items-center gap-3">
                          <BookCover title={book.title} coverData={book.coverData} className="w-10 shrink-0 rounded-md [&_span]:text-[7px] [&_span]:px-0.5" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-medium leading-snug line-clamp-2 group-hover:underline">{book.title}</span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[12px]" style={muted}>
                              {data?.faces.length ? <AvatarStack people={data.faces} size={16} /> : null}
                              {data?.readers ? `${data.readers} ${pt ? (data.readers === 1 ? 'leitor' : 'leitores') : (data.readers === 1 ? 'reader' : 'readers')}` : (book.author ?? '')}
                            </span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function MeCard({ me, pt }: { me: View | null | undefined; pt: boolean }) {
  if (me === undefined) return <div className="h-64 rounded-3xl animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
  if (!me) {
    return (
      <div className="rounded-3xl border overflow-hidden" style={card}>
        <ProfileBanner compact className="h-20" />
        <div className="p-5">
          <p className="font-medium">{pt ? 'Seu perfil' : 'Your profile'}</p>
          <p className="mt-1 text-[13px]" style={muted}>{pt ? 'Escolha um @, uma foto e uma capa para aparecer aqui.' : 'Pick a handle, photo and cover to show up here.'}</p>
          <Link to="/settings#profile" className="mt-4 h-9 w-full inline-flex items-center justify-center rounded-full text-[13.5px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {pt ? 'Criar perfil' : 'Create profile'}
          </Link>
        </div>
      </div>
    )
  }
  const counts: [number, string, string][] = [
    [me.followers, pt ? 'seguidores' : 'followers', `/u/${me.handle}/seguidores`],
    [me.following, pt ? 'seguindo' : 'following', `/u/${me.handle}/seguindo`],
    [me.friends, pt ? 'amigos' : 'friends', `/u/${me.handle}/amigos`],
  ]
  return (
    <div className="rounded-3xl border overflow-hidden" style={card}>
      {me.coverUrl ? <img src={me.coverUrl} alt="" className="h-20 w-full object-cover" /> : <ProfileBanner id={me.banner} compact className="h-20" />}
      <div className="px-5 pb-5">
        <span className="relative z-10 -mt-8 inline-block rounded-full p-1" style={{ backgroundColor: 'var(--theme-card-bg)' }}>
          <Avatar src={me.avatarUrl} name={me.name || me.handle} size={60} />
        </span>
        <p className="mt-1 font-display text-[21px] leading-tight truncate">{me.name || me.handle || (pt ? 'Você' : 'You')}</p>
        {me.handle && <p className="text-[12.5px] truncate" style={muted}>@{me.handle}</p>}
        <LevelBadge id={me.level} pt={pt} className="mt-2" />
        <div className="mt-4 grid grid-cols-3 gap-1 text-center">
          {counts.map(([value, label, to]) => (
            <Link key={label} to={me.handle ? to : '/settings#profile'} className="rounded-xl py-2 transition-colors hover:bg-[var(--ui-hover)]" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
              <p className="text-[15px] font-semibold tabular-nums">{value}</p>
              <p className="text-[11px]" style={muted}>{label}</p>
            </Link>
          ))}
        </div>
        {!me.isPublic && <p className="mt-3 text-[12px] inline-flex items-center gap-1" style={muted}><Lock className="w-3 h-3" />{pt ? 'Perfil fechado: só quem você aprova vê.' : 'Closed profile: only approved people see it.'}</p>}
        <div className="mt-4 grid gap-2">
          <Link to="/u/me" className="h-9 w-full inline-flex items-center justify-center rounded-full border text-[13px] font-medium transition-colors hover:bg-[var(--ui-hover)]" style={{ borderColor: 'var(--theme-border)' }}>
            {pt ? 'Ver meu perfil' : 'View my profile'}
          </Link>
          <Link to="/notifications" className="h-9 w-full inline-flex items-center justify-center gap-1.5 rounded-full text-[13px] transition-colors hover:bg-[var(--ui-hover)]" style={muted}>
            <Bell className="w-3.5 h-3.5" />{pt ? 'Notificações e pedidos' : 'Notifications and requests'}
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Busca no servidor por nome ou @, com "carregar mais" pelo cursor. */
function DiscoverPeople({ initial, pt }: { initial: PersonCard[]; pt: boolean }) {
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<PersonCard[] | null>(initial.length ? initial : null)
  const [more, setMore] = useState(initial.length >= 30)

  useEffect(() => {
    const controller = { alive: true }
    const timer = window.setTimeout(() => {
      void listPeople({ query, limit: 30 }).then(next => {
        if (!controller.alive) return
        setPeople(next.filter(person => !person.isMe)); setMore(next.length >= 30)
      })
    }, query ? 250 : 0)
    return () => { controller.alive = false; window.clearTimeout(timer) }
  }, [query])

  const loadMore = async () => {
    const last = people?.[people.length - 1]
    if (!last?.updatedAt) return
    const next = await listPeople({ query, before: last.updatedAt, limit: 30 })
    setPeople(current => [...(current ?? []), ...next.filter(person => !person.isMe)])
    setMore(next.length >= 30)
  }

  return (
    <div className="space-y-4">
      <label className="relative block">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={muted} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={pt ? 'Buscar por nome ou @' : 'Search by name or handle'} aria-label={pt ? 'Buscar leitores' : 'Search readers'}
          className="w-full h-11 rounded-full border pl-10 pr-4 text-[14px] outline-none" style={card} />
      </label>
      {people === null
        ? <div className="grid sm:grid-cols-2 gap-3" aria-hidden>{[0, 1, 2, 3].map(i => <div key={i} className="h-44 rounded-3xl animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />)}</div>
        : people.length === 0
          ? <EmptyState illustration="teamworks" title={query ? (pt ? 'Ninguém com esse nome ou @.' : 'Nobody by that name or handle.') : (pt ? 'Ainda não há outros perfis abertos.' : 'No other open profiles yet.')} />
          : <div className="grid sm:grid-cols-2 gap-3">{people.map(person => <PersonTile key={person.userId} person={person} pt={pt} />)}</div>}
      {more && people && people.length > 0 && (
        <button type="button" onClick={() => { void loadMore() }} className="w-full h-10 rounded-full border text-[13.5px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Carregar mais' : 'Load more'}</button>
      )}
    </div>
  )
}

function PersonTile({ person, pt }: { person: PersonCard; pt: boolean }) {
  const [followers, setFollowers] = useState(person.followers)
  return (
    <article className="rounded-3xl border overflow-hidden" style={card}>
      <ProfileBanner id={person.banner} compact className="h-16" />
      <div className="px-4 pb-4">
        <div className="relative z-10 flex items-end justify-between gap-2 -mt-7">
          <Link to={`/u/${person.handle}`} className="rounded-full p-1" style={{ backgroundColor: 'var(--theme-card-bg)' }}>
            <Avatar src={person.avatarUrl} name={person.name || person.handle} size={52} />
          </Link>
          <FollowButton userId={person.userId} following={person.relation.following} pending={person.relation.followPending} pt={pt} size="sm"
            onChange={(next, previous) => setFollowers(count => count + (next === 'following' ? 1 : previous === 'following' ? -1 : 0))} />
        </div>
        <Link to={`/u/${person.handle}`} className="mt-1 block">
          <span className="flex items-center gap-2">
            <span className="font-medium truncate">{person.name || person.handle}</span>
            <LevelBadge id={person.level} pt={pt} variant="compact" className="border" />
            {!person.isPublic && <Lock className="w-3.5 h-3.5 shrink-0" style={muted} aria-label={pt ? 'Perfil fechado' : 'Closed profile'} />}
          </span>
          <span className="block text-[12.5px]" style={muted}>@{person.handle} · {followers} {pt ? (followers === 1 ? 'seguidor' : 'seguidores') : (followers === 1 ? 'follower' : 'followers')}</span>
        </Link>
        {person.bio && <p className="mt-2 text-[13.5px] leading-snug line-clamp-2">{person.bio}</p>}
        {person.reading && <p className="mt-2 text-[12.5px] truncate" style={muted}>{pt ? 'Lendo ' : 'Reading '}<span style={{ color: 'var(--theme-text)' }}>{person.reading}</span></p>}
        {person.commonBooks > 0 && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-[12px]" style={muted}>
            <BookOpen className="w-3 h-3" />{pt ? `${person.commonBooks} ${person.commonBooks === 1 ? 'livro' : 'livros'} em comum` : `${person.commonBooks} books in common`}
          </p>
        )}
      </div>
    </article>
  )
}

/** /u/:handle, /u/me e o endereço antigo /profile/:userId (que passa para o @ quando ele existe). */
export function PublicProfile() {
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const navigate = useNavigate()
  const { handle, userId } = useParams()
  const me = useMe()
  const { covers } = useCovers()
  const [view, setView] = useState<View | null | undefined>(undefined)
  const [tab, setTab] = useState<ProfileTab>('overview')
  const [reload, setReload] = useState(0)
  const isMe = handle === 'me'

  useEffect(() => {
    const target = isMe ? 'me' as const : handle ? { handle } : userId ? { userId } : null
    if (!target) { setView(null); return }
    let alive = true
    void loadProfileView(target).then(next => {
      if (!alive) return
      if (next?.handle && (userId || isMe)) navigate(`/u/${next.handle}`, { replace: true })
      setView(next)
    })
    return () => { alive = false }
  }, [handle, userId, isMe, navigate, reload])
  useEffect(() => { setTab('overview'); setView(undefined) }, [handle, userId])

  if (view === undefined) {
    return (
      <div className="max-w-4xl mx-auto space-y-4" aria-hidden>
        <div className="h-80 rounded-3xl animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
        <div className="h-48 rounded-3xl animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
      </div>
    )
  }
  if (!view) {
    return (
      <div className="max-w-xl mx-auto">
        <EmptyState illustration={isMe ? 'on-the-laptop' : 'meditation'}
          title={isMe
            ? (pt ? 'Você ainda não criou seu perfil. Escolha um @, uma foto e o que quer mostrar.' : 'You have not created your profile yet. Pick a handle, a photo and what to show.')
            : (pt ? 'Este perfil não existe ou não está disponível.' : 'This profile does not exist or is not available.')}
          action={isMe
            ? <Link to="/settings#profile" className="h-9 px-4 inline-flex items-center rounded-full text-[13.5px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Criar perfil' : 'Create profile'}</Link>
            : <Link to="/community" className="text-[13.5px] underline">{pt ? 'Voltar para a comunidade' : 'Back to the community'}</Link>} />
      </div>
    )
  }

  const canPost = !!me?.handle
  const refresh = () => setReload(n => n + 1)
  const tabs: [ProfileTab, string, typeof Compass][] = [
    ['overview', pt ? 'Visão geral' : 'Overview', Compass],
    ['activity', pt ? 'Atividades' : 'Activity', MessageCircle],
    ['shelf', pt ? 'Estante' : 'Shelf', BookOpen],
    ['reviews', pt ? 'Resenhas' : 'Reviews', Heart],
    ['goals', pt ? 'Metas' : 'Goals', Flame],
  ]
  const shelfVisible = !!view.shelf
  const statsVisible = !!view.stats

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/community" className="text-[13px]" style={muted}>{pt ? '← Comunidade' : '← Community'}</Link>
      {view.isOwner && !view.isPublic && (
        <p className="mt-4 rounded-2xl px-4 py-2.5 text-[13.5px]" style={{ backgroundColor: 'var(--pastel-amber-bg)', color: 'var(--pastel-amber-fg)' }}>
          {pt ? 'Seu perfil está fechado: só quem você aprovar vê suas leituras e publicações.' : 'Your profile is closed: only people you approve see your reading and posts.'}
        </p>
      )}
      <div className="mt-4"><ProfileHeader view={view} pt={pt} onTab={setTab} onRelationChange={refresh} /></div>

      {view.restricted
        ? <div className="mt-5 rounded-3xl border p-8 text-center" style={card}>
            <Lock className="w-6 h-6 mx-auto" style={muted} />
            <p className="mt-3 font-display text-[22px]">{pt ? 'Este perfil é fechado' : 'This profile is closed'}</p>
            <p className="mt-1 text-[14px]" style={muted}>{view.relation.followPending
              ? (pt ? 'Seu pedido foi enviado. Quando for aprovado, a estante e as publicações aparecem aqui.' : 'Your request was sent. Once approved, the shelf and posts show up here.')
              : (pt ? 'Peça para seguir ou envie um pedido de amizade para ver as leituras.' : 'Request to follow or send a friend request to see their reading.')}</p>
          </div>
        : <>
            <div className="mt-4"><PillTabs<ProfileTab> value={tab} onChange={setTab} sticky items={tabs} /></div>
            <div className="mt-3 space-y-5">
              {tab === 'overview' && (
                <>
                  {shelfVisible && (
                    <Block title={pt ? 'Lendo agora' : 'Reading now'} pt={pt} locked={view.isOwner && !view.show.shelf}>
                      <CurrentlyReading items={view.shelf!} pt={pt} />
                    </Block>
                  )}
                  <div className="grid gap-5 md:grid-cols-2">
                    <Block title={pt ? `Meta de ${new Date().getFullYear()}` : `${new Date().getFullYear()} goal`} pt={pt}
                      action={<button type="button" onClick={() => setTab('goals')} className="text-[12.5px] underline" style={muted}>{pt ? 'Ver metas' : 'See goals'}</button>}>
                      <ReadingGoalCard view={view} pt={pt} compact onChanged={refresh} />
                    </Block>
                    {shelfVisible && (
                      <Block title={pt ? 'Favoritos' : 'Favorites'} pt={pt}
                        action={<button type="button" onClick={() => setTab('shelf')} className="text-[12.5px] underline" style={muted}>{pt ? 'Ver estante' : 'See shelf'}</button>}>
                        <FavoriteShelf items={view.shelf!} pt={pt} />
                      </Block>
                    )}
                  </div>
                  <Block title={pt ? 'Últimas atividades' : 'Latest activity'} pt={pt}
                    action={<button type="button" onClick={() => setTab('activity')} className="text-[12.5px] underline" style={muted}>{pt ? 'Ver tudo' : 'See all'}</button>}>
                    <LatestActivity userId={view.userId} covers={covers} pt={pt} canPost={canPost} />
                  </Block>
                  {statsVisible && <Block title={pt ? 'Resultados' : 'Results'} pt={pt} locked={view.isOwner && !view.show.stats}><Results stats={view.stats!} pt={pt} /></Block>}
                  {view.studying && <Block title={pt ? 'Estudando agora' : 'Studying now'} pt={pt} locked={view.isOwner && !view.show.studying}><StudyingWords words={view.studying} pt={pt} /></Block>}
                </>
              )}
              {tab === 'activity' && (
                <Feed scope="user" userId={view.userId} covers={covers} pt={pt} canPost={canPost}
                  empty={view.isOwner ? (pt ? 'Você ainda não publicou. Conte na Comunidade o que está lendo.' : 'You have not posted yet.') : (pt ? 'Nada publicado ainda.' : 'Nothing posted yet.')} />
              )}
              {tab === 'shelf' && (shelfVisible
                ? <Block title={pt ? 'Estante' : 'Shelf'} pt={pt} locked={view.isOwner && !view.show.shelf}><SocialBookshelf items={view.shelf!} pt={pt} editable={view.isOwner} /></Block>
                : <EmptyState illustration="reading" title={pt ? 'A estante desta pessoa é particular.' : 'This shelf is private.'} />)}
              {tab === 'reviews' && (
                <Feed scope="user" userId={view.userId} covers={covers} pt={pt} canPost={canPost} filter={item => item.kind === 'review'}
                  empty={view.isOwner ? (pt ? 'Avalie um livro na página dele na Galeria.' : 'Rate a book on its gallery page.') : (pt ? 'Nenhuma resenha ainda.' : 'No reviews yet.')} />
              )}
              {tab === 'goals' && <Block title={pt ? 'Metas de leitura' : 'Reading goals'} pt={pt}><ReadingGoalCard view={view} pt={pt} onChanged={refresh} /></Block>}
            </div>
          </>}
    </div>
  )
}

/** Três atividades mais recentes, sem montar uma timeline inteira. */
function LatestActivity({ userId, covers, pt, canPost }: { userId: string; covers: Covers; pt: boolean; canPost: boolean }) {
  const [items, setItems] = useState<FeedItem[] | null>(null)
  useEffect(() => {
    let alive = true
    void loadFeed('user', { userId, limit: 3 }).then(next => { if (alive) setItems(next) })
    return () => { alive = false }
  }, [userId])
  if (items === null) return <div className="h-24 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
  if (!items.length) return <p className="text-[13.5px]" style={muted}>{pt ? 'Nenhuma atividade ainda.' : 'No activity yet.'}</p>
  return <div className="space-y-3">{items.map(item => <PostCard key={item.id} item={item} covers={covers} pt={pt} canPost={canPost} onDeleted={() => setItems(current => (current ?? []).filter(other => other.id !== item.id))} />)}</div>
}

/** /post/:id — uma publicação com os comentários abertos. É o endereço do link compartilhado. */
export function PostPage() {
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const navigate = useNavigate()
  const { id } = useParams()
  const me = useMe()
  const { covers } = useCovers()
  const [item, setItem] = useState<FeedItem | null | undefined>(undefined)

  useEffect(() => {
    setItem(undefined)
    if (id) void loadPost(id).then(setItem)
  }, [id])

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/community" className="text-[13px]" style={muted}>{pt ? '← Comunidade' : '← Community'}</Link>
      <div className="mt-4">
        {item === undefined && <div className="h-64 rounded-3xl animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />}
        {item === null && <EmptyState illustration="meditation" title={pt ? 'Esta publicação foi apagada ou não está disponível para você.' : 'This post was deleted or is not available to you.'} />}
        {item && <PostCard item={item} covers={covers} pt={pt} canPost={!!me?.handle} standalone onDeleted={() => navigate('/community')} />}
      </div>
    </div>
  )
}

/** /u/:handle/seguidores, /seguindo e /amigos */
export function ConnectionsPage() {
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const navigate = useNavigate()
  const { user } = useAuth()
  const { handle, list } = useParams()
  const kind = list === 'seguindo' ? 'following' : list === 'amigos' ? 'friends' : 'followers'
  const [view, setView] = useState<View | null | undefined>(undefined)
  const [people, setPeople] = useState<Connection[] | null>(null)

  useEffect(() => {
    if (!handle) return
    setPeople(null)
    void loadProfileView({ handle }).then(next => {
      setView(next)
      if (next && !next.restricted) void loadConnections(next.userId, kind).then(setPeople)
      else setPeople([])
    })
  }, [handle, kind])

  if (view === null) return <EmptyState illustration="meditation" title={pt ? 'Este perfil não existe ou não está disponível.' : 'This profile does not exist or is not available.'} />
  const slug = { followers: 'seguidores', following: 'seguindo', friends: 'amigos' } as const
  const removeFromList = (id: string) => setPeople(current => (current ?? []).filter(person => person.userId !== id))

  return (
    <div className="max-w-2xl mx-auto">
      <Link to={`/u/${handle}`} className="text-[13px]" style={muted}>← @{handle}</Link>
      <h1 className="mt-3 font-display text-[30px] leading-tight">{view?.name || `@${handle}`}</h1>
      <div className="mt-3">
        <PillTabs<'followers' | 'following' | 'friends'> value={kind} onChange={next => navigate(`/u/${handle}/${slug[next]}`, { replace: true })} items={[
          ['followers', pt ? 'Seguidores' : 'Followers', Users],
          ['following', pt ? 'Seguindo' : 'Following', UserRound],
          ['friends', pt ? 'Amigos' : 'Friends', UserCheck],
        ]} />
      </div>
      <div className="mt-3">
        {view?.restricted
          ? <EmptyState illustration="meditation" title={pt ? 'Este perfil é fechado.' : 'This profile is closed.'} />
          : people === null
            ? <div className="h-40 rounded-3xl animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
            : people.length === 0
              ? <EmptyState illustration="teamworks" title={{ followers: pt ? 'Ninguém segue ainda.' : 'No followers yet.', following: pt ? 'Ainda não segue ninguém.' : 'Not following anyone yet.', friends: pt ? 'Nenhum amigo ainda.' : 'No friends yet.' }[kind]} />
              : <div className="rounded-3xl border overflow-hidden divide-y" style={{ ...card, borderColor: 'var(--theme-border)' }}>
                  {people.map(person => (
                    <UserListItem key={person.userId} person={person} pt={pt}
                      subtitle={person.relation.followsMe && !person.isMe ? (pt ? 'Segue você' : 'Follows you') : undefined}
                      action={person.isMe ? null : (
                        <span className="flex items-center gap-1.5">
                          {view?.isOwner && kind === 'followers' && user && (
                            <button type="button" onClick={async () => {
                              if (!await askConfirm(pt ? `Remover @${person.handle} dos seguidores?` : `Remove @${person.handle}?`)) return
                              void removeFollower(user.id, person.userId).then(() => removeFromList(person.userId)).catch(err => toast(errorText(err, pt), { tone: 'error' }))
                            }} className="h-8 px-3 rounded-full border text-[12.5px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Remover' : 'Remove'}</button>
                          )}
                          {view?.isOwner && kind === 'friends'
                            ? <FriendButton userId={person.userId} state="friends" pt={pt} size="sm" onChange={state => { if (state === 'none') removeFromList(person.userId) }} />
                            : <FollowButton userId={person.userId} following={person.relation.following} pending={person.relation.followPending} pt={pt} size="sm" />}
                        </span>
                      )} />
                  ))}
                </div>}
      </div>
    </div>
  )
}

/** /notifications — pedidos pendentes no topo e as notificações. Abrir a página marca como lidas. */
export function NotificationsPage() {
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const navigate = useNavigate()
  const { user } = useAuth()
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [requests, setRequests] = useState<Requests | null>(null)
  const [more, setMore] = useState(false)

  useEffect(() => {
    if (!user) return
    void loadNotifications().then(next => { setItems(next); setMore(next.length >= 30) })
    void loadRequests().then(setRequests)
  }, [user])

  const markAll = async () => {
    if (!user) return
    await markNotificationsRead(user.id)
    setItems(current => (current ?? []).map(item => ({ ...item, read: true })))
    window.dispatchEvent(new Event('bookmoo:notifications'))
  }
  const open = async (item: AppNotification) => {
    if (!user) return
    if (!item.read) { void markNotificationsRead(user.id, item.id).then(() => window.dispatchEvent(new Event('bookmoo:notifications'))) }
    setItems(current => (current ?? []).map(other => other.id === item.id ? { ...other, read: true } : other))
    navigate(item.postId ? `/post/${item.postId}` : `/u/${item.actor.handle}`)
  }
  const loadMore = async () => {
    const last = items?.[items.length - 1]
    if (!last) return
    const next = await loadNotifications(last.at)
    setItems(current => [...(current ?? []), ...next]); setMore(next.length >= 30)
  }
  const act = async (action: () => Promise<void>, update: (current: Requests) => Requests) => {
    try { await action(); setRequests(current => current && update(current)); window.dispatchEvent(new Event('bookmoo:notifications')) } catch (err) { toast(errorText(err, pt), { tone: 'error' }) }
  }
  const unread = (items ?? []).some(item => !item.read)
  const pending = requests ? requests.followIn.length + requests.friendIn.length + requests.friendOut.length : 0

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <header className="flex items-end justify-between gap-3">
        <h1 className="font-display text-[32px] md:text-[40px] leading-[1.05]">{pt ? 'Notificações' : 'Notifications'}</h1>
        {unread && <button type="button" onClick={() => { void markAll() }} className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full border text-[13px]" style={{ borderColor: 'var(--theme-border)' }}><Check className="w-3.5 h-3.5" />{pt ? 'Marcar todas como lidas' : 'Mark all as read'}</button>}
      </header>

      {requests && pending > 0 && user && (
        <section className="rounded-3xl border overflow-hidden" style={card}>
          <h2 className="px-5 pt-4 pb-2 text-[14.5px] font-semibold">{pt ? 'Pedidos' : 'Requests'}</h2>
          <div className="divide-y" style={{ borderColor: 'var(--theme-border)' }}>
            {requests.followIn.map(person => (
              <UserListItem key={`f-${person.userId}`} person={person} pt={pt} subtitle={pt ? 'quer seguir você' : 'wants to follow you'}
                action={<span className="flex gap-1.5">
                  <button type="button" onClick={() => { void act(() => approveFollower(user.id, person.userId), r => ({ ...r, followIn: r.followIn.filter(p => p.userId !== person.userId) })) }}
                    className="h-8 px-3 rounded-full text-[12.5px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Aprovar' : 'Approve'}</button>
                  <button type="button" aria-label={pt ? 'Recusar' : 'Decline'} onClick={() => { void act(() => removeFollower(user.id, person.userId), r => ({ ...r, followIn: r.followIn.filter(p => p.userId !== person.userId) })) }}
                    className="h-8 px-2 rounded-full border" style={{ borderColor: 'var(--theme-border)' }}><X className="w-4 h-4" /></button>
                </span>} />
            ))}
            {requests.friendIn.map(person => (
              <UserListItem key={`i-${person.userId}`} person={person} pt={pt} subtitle={pt ? 'quer ser seu amigo' : 'sent you a friend request'}
                action={<span className="flex gap-1.5">
                  <button type="button" onClick={() => { void act(() => acceptFriendRequest(user.id, person.userId), r => ({ ...r, friendIn: r.friendIn.filter(p => p.userId !== person.userId) })) }}
                    className="h-8 px-3 rounded-full text-[12.5px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Aceitar' : 'Accept'}</button>
                  <button type="button" aria-label={pt ? 'Recusar' : 'Decline'} onClick={() => { void act(() => removeFriendship(user.id, person.userId), r => ({ ...r, friendIn: r.friendIn.filter(p => p.userId !== person.userId) })) }}
                    className="h-8 px-2 rounded-full border" style={{ borderColor: 'var(--theme-border)' }}><X className="w-4 h-4" /></button>
                </span>} />
            ))}
            {requests.friendOut.map(person => (
              <UserListItem key={`o-${person.userId}`} person={person} pt={pt} subtitle={pt ? 'pedido de amizade enviado' : 'friend request sent'}
                action={<button type="button" onClick={() => { void act(() => removeFriendship(user.id, person.userId), r => ({ ...r, friendOut: r.friendOut.filter(p => p.userId !== person.userId) })) }}
                  className="h-8 px-3 rounded-full border text-[12.5px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Cancelar' : 'Cancel'}</button>} />
            ))}
          </div>
        </section>
      )}

      {items === null
        ? <div className="h-48 rounded-3xl animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
        : items.length === 0
          ? <EmptyState illustration="high-five" title={pt ? 'Nada novo por aqui. Quando alguém seguir você, curtir ou comentar, aparece aqui.' : 'Nothing new. Follows, likes and comments show up here.'} />
          : <div className="rounded-3xl border overflow-hidden divide-y" style={card}>
              {items.map(item => <NotificationRow key={item.id} item={item} pt={pt} onOpen={() => { void open(item) }} />)}
            </div>}
      {more && <button type="button" onClick={() => { void loadMore() }} className="w-full h-10 rounded-full border text-[13.5px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Carregar mais' : 'Load more'}</button>}
    </div>
  )
}

function notificationText(item: AppNotification, pt: boolean) {
  const texts: Record<AppNotification['type'], [string, string]> = {
    follow: ['começou a seguir você', 'started following you'],
    follow_request: ['pediu para seguir você', 'requested to follow you'],
    follow_accepted: ['aprovou seu pedido para seguir', 'approved your follow request'],
    friend_request: ['enviou um pedido de amizade', 'sent you a friend request'],
    friend_accepted: ['aceitou sua amizade', 'accepted your friend request'],
    like: ['curtiu sua publicação', 'liked your post'],
    review_like: ['curtiu sua resenha', 'liked your review'],
    comment: ['comentou na sua publicação', 'commented on your post'],
    reply: ['respondeu ao seu comentário', 'replied to your comment'],
    mention: ['mencionou você', 'mentioned you'],
  }
  return texts[item.type][pt ? 0 : 1]
}

function NotificationRow({ item, pt, onOpen }: { item: AppNotification; pt: boolean; onOpen: () => void }) {
  const Icon = item.type === 'like' || item.type === 'review_like' ? Heart
    : item.type === 'mention' ? AtSign
    : item.type === 'comment' || item.type === 'reply' ? MessageCircle
      : item.type.startsWith('friend') ? UserCheck : UserPlus
  return (
    <button type="button" onClick={onOpen} className="w-full px-4 sm:px-5 py-3.5 flex items-start gap-3 text-left transition-colors hover:bg-[var(--ui-hover)]"
      style={item.read ? undefined : { backgroundColor: 'color-mix(in srgb, var(--theme-bg-secondary) 70%, transparent)' }}>
      <span className="relative shrink-0">
        <Avatar src={item.actor.avatarUrl} name={item.actor.name || item.actor.handle} size={42} />
        <span className="absolute -right-1 -bottom-1 w-5 h-5 grid place-items-center rounded-full border" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
          <Icon className="w-3 h-3" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] leading-snug"><b className="font-medium">{item.actor.name || item.actor.handle}</b> <span style={muted}>{notificationText(item, pt)}</span></span>
        {item.snippet && <span className="block mt-0.5 text-[13px] truncate" style={muted}>“{item.snippet}”</span>}
        <span className="block mt-0.5 text-[12px]" style={muted}>{timeAgo(item.at, pt)}</span>
      </span>
      {!item.read && <span className="mt-2 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'var(--theme-text)' }} aria-label={pt ? 'Não lida' : 'Unread'} />}
    </button>
  )
}
