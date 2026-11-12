import { useMemo, type ComponentType, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AudioLines, BookMarked, ChartNoAxesColumn, ChevronsUpDown, Coffee, Flame, House, Library, LogOut, Moon,
  Bell, PanelLeftClose, PanelLeftOpen, PenLine, Plus, Search, Settings2, Shield, Star, Sun, Users,
} from 'lucide-react'
import { useUiStore } from '@/store/useUiStore'
import { useReaderSettings, type Theme } from '@/store/useReaderSettings'
import { useLanguage, type Locale } from '@/store/useLanguage'
import { useBookStore } from '@/store/useBookStore'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useXpStore, xpSummary } from '@/store/useXpStore'
import { studyLevel } from '@/lib/cefr'
import { useTranslations } from '@/lib/i18n'
import { readingProgress } from '@/lib/utils'
import { StudyTimer } from '@/components/timer/StudyTimer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { VoiceSelect } from './VoiceSelect'
import { useAuth } from '@/contexts/AuthContext'
import { useUnreadNotifications } from '@/components/community/NotificationBell'

interface SidebarProps {
  isMobileDrawer?: boolean
  onClose?: () => void
}

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>

/** Atalho do teclado conforme o sistema (⌘ no Mac, Ctrl nos outros). */
export const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

export function Sidebar({ isMobileDrawer, onClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, setTheme } = useReaderSettings()
  const { locale, setLocale } = useLanguage()
  const { t } = useTranslations(locale)
  const pt = locale === 'pt-BR'
  const { user, signOut, isAdmin } = useAuth()
  const { sidebarCollapsed, toggleSidebar, setCommandOpen, requestAddBook } = useUiStore()
  const unread = useUnreadNotifications()
  const books = useBookStore(s => s.books)
  const vocab = useVocabularyStore(s => s.vocabularies)
  const events = useXpStore(s => s.events)
  const { total, streak, studiedToday } = useMemo(() => xpSummary(events), [events])
  const savedWords = useMemo(() => new Set(vocab.map(v => v.text.trim().toLowerCase()).filter(Boolean)).size, [vocab])
  const level = useMemo(() => studyLevel(savedWords, total), [savedWords, total])
  const reviewCount = useMemo(() => vocab.filter(v => v.status === 'review').length, [vocab])
  const recent = useMemo(() => [...books].sort((a, b) => +new Date(b.lastRead) - +new Date(a.lastRead)).slice(0, 4), [books])

  const sections: { title?: string; items: { to: string; icon: Icon; label: string; badge?: number }[] }[] = [
    { items: [{ to: '/', icon: House, label: pt ? 'Início' : 'Home' }] },
    { title: pt ? 'Aprender' : 'Learn', items: [{ to: '/vocabulary', icon: BookMarked, label: t('vocabulary'), badge: reviewCount || undefined }] },
    { title: pt ? 'Praticar' : 'Practice', items: [
      { to: '/practice/speak', icon: AudioLines, label: pt ? 'Falar' : 'Speak' },
      { to: '/practice/write', icon: PenLine, label: pt ? 'Ditado' : 'Dictation' },
    ] },
    { title: pt ? 'Progresso' : 'Progress', items: [{ to: '/stats', icon: ChartNoAxesColumn, label: t('stats') }] },
    { title: pt ? 'Juntos' : 'Together', items: [
      { to: '/gallery', icon: Library, label: pt ? 'Galeria' : 'Gallery' },
      { to: '/community', icon: Users, label: pt ? 'Comunidade' : 'Community' },
      { to: '/notifications', icon: Bell, label: pt ? 'Notificações' : 'Notifications', badge: unread || undefined },
      ...(isAdmin ? [{ to: '/admin', icon: Shield, label: pt ? 'Área admin' : 'Admin' }] : []),
    ] },
  ]
  const themes: { id: Theme; icon: Icon; label: string }[] = [
    { id: 'light', icon: Sun, label: t('day') },
    { id: 'sepia', icon: Coffee, label: t('afternoon') },
    { id: 'dark', icon: Moon, label: t('night') },
  ]
  const locales: { id: Locale; label: string }[] = [{ id: 'en', label: 'English' }, { id: 'pt-BR', label: 'Português' }]
  const isActive = (to: string) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
  const go = () => onClose?.()
  const initial = (user?.email ?? 'B').charAt(0).toUpperCase()
  const fmt = new Intl.NumberFormat(pt ? 'pt-BR' : 'en-US')
  const segmented = (on: boolean) => ({
    backgroundColor: on ? 'var(--theme-card-bg)' : 'transparent',
    color: on ? 'var(--theme-text)' : 'var(--theme-text-secondary)',
    boxShadow: on ? '0 1px 2px rgba(0,0,0,0.1)' : undefined,
  })

  const userMenu = (trigger: ReactNode) => (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent side={isMobileDrawer ? 'top' : 'right'} align="end" sideOffset={10} className="w-72 p-1.5 z-[65]">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <span className="grid place-items-center w-8 h-8 rounded-full text-sm font-semibold" style={{ backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text)' }}>{initial}</span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium truncate">{user?.email ?? 'Bookmoo'}</p>
            <p className="text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}>
              {fmt.format(total)} {pt ? 'pontos' : 'points'} · {streak} {pt ? (streak === 1 ? 'dia seguido' : 'dias seguidos') : 'day streak'}
            </p>
          </div>
        </div>
        <div className="my-1 h-px" style={{ backgroundColor: 'var(--theme-border)' }} />
        <div className="px-2 py-1.5">
          <p className="text-[11.5px] font-medium mb-1.5" style={{ color: 'var(--theme-text-secondary)' }}>{t('appearance')}</p>
          <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
            {themes.map(({ id, icon: ThemeIcon, label }) => (
              <button key={id} type="button" onClick={() => setTheme(id)} aria-pressed={theme === id}
                className="h-8 rounded-md inline-flex items-center justify-center gap-1.5 text-[12px] font-medium transition-colors" style={segmented(theme === id)}>
                <ThemeIcon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-2 py-1.5">
          <p className="text-[11.5px] font-medium mb-1.5" style={{ color: 'var(--theme-text-secondary)' }}>{t('language')}</p>
          <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
            {locales.map(loc => (
              <button key={loc.id} type="button" onClick={() => setLocale(loc.id)} aria-pressed={locale === loc.id}
                className="h-8 rounded-md text-[12px] font-medium transition-colors" style={segmented(locale === loc.id)}>
                {loc.label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-2 py-1.5">
          <p className="text-[11.5px] font-medium mb-1.5" style={{ color: 'var(--theme-text-secondary)' }}>{t('readingVoice')}</p>
          <VoiceSelect hideLabel />
        </div>
        <div className="my-1 h-px" style={{ backgroundColor: 'var(--theme-border)' }} />
        <Link to="/settings" onClick={go} className="flex items-center gap-2.5 h-8 px-2 rounded-md text-[13px] hover:bg-[var(--ui-hover)]">
          <Settings2 className="w-4 h-4 opacity-70" />{t('settings')}
        </Link>
        <button type="button" onClick={() => { go(); signOut() }} className="w-full flex items-center gap-2.5 h-8 px-2 rounded-md text-[13px] hover:bg-[var(--ui-hover)]">
          <LogOut className="w-4 h-4 opacity-70" />{t('logout')}
        </button>
      </PopoverContent>
    </Popover>
  )

  // Recolhida (só desktop): trilho de ícones, com a logo no topo.
  if (!isMobileDrawer && sidebarCollapsed) {
    const rail = 'w-10 h-10 rounded-lg grid place-items-center transition-colors hover:bg-[var(--ui-hover)]'
    return (
      <aside className="w-[64px] flex flex-col items-center py-3 gap-1 z-20 fixed left-0 top-0 bottom-0 transition-colors duration-300"
        style={{ backgroundColor: 'var(--theme-nav-bg)', color: 'var(--theme-nav-text)', borderRight: '1px solid var(--theme-border)' }}>
        <Link to="/" title="Bookmoo" aria-label="Bookmoo" className="grid place-items-center w-8 h-8 rounded-lg text-[15px] font-semibold font-display mb-2"
          style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>B</Link>
        <button type="button" onClick={() => setCommandOpen(true)} className={rail} title={`${pt ? 'Buscar' : 'Search'} (${MOD_KEY} K)`} aria-label={pt ? 'Buscar' : 'Search'} style={{ color: 'var(--theme-nav-text-muted)' }}>
          <Search className="w-[18px] h-[18px]" />
        </button>
        {sections.flatMap(s => s.items).map(({ to, icon: ItemIcon, label, badge }) => (
          <Link key={to} to={to} title={label} aria-label={label} className={`${rail} relative`}
            style={{ backgroundColor: isActive(to) ? 'var(--theme-nav-active)' : undefined, color: isActive(to) ? 'var(--theme-nav-text)' : 'var(--theme-nav-text-muted)' }}>
            <ItemIcon className="w-[18px] h-[18px]" />
            {badge ? <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--theme-accent)' }} /> : null}
          </Link>
        ))}
        <div className="mt-auto flex flex-col items-center gap-1">
          <button type="button" onClick={toggleSidebar} className={rail} title={pt ? 'Expandir menu' : 'Expand menu'} aria-label={pt ? 'Expandir menu' : 'Expand menu'} style={{ color: 'var(--theme-nav-text-muted)' }}>
            <PanelLeftOpen className="w-[18px] h-[18px]" />
          </button>
          {userMenu(
            <button type="button" className="w-9 h-9 rounded-full grid place-items-center text-sm font-semibold" aria-label={pt ? 'Conta e preferências' : 'Account and preferences'}
              style={{ backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text)' }}>{initial}</button>,
          )}
        </div>
      </aside>
    )
  }

  const Wrapper = isMobileDrawer ? 'div' : 'aside'
  return (
    <Wrapper
      className={isMobileDrawer ? 'w-full flex flex-col gap-4 px-3 py-4' : 'w-[15.5rem] flex flex-col z-20 fixed left-0 top-0 bottom-0 transition-colors duration-300'}
      style={{ backgroundColor: 'var(--theme-nav-bg)', color: 'var(--theme-nav-text)', borderRight: isMobileDrawer ? undefined : '1px solid var(--theme-border)' }}>
      {!isMobileDrawer && (
        <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
          <Link to="/" className="flex items-center gap-2 min-w-0 rounded-md px-1 py-1 -mx-1 hover:bg-[var(--ui-hover)]">
            <span className="grid place-items-center w-6 h-6 rounded-md text-[13px] font-semibold font-display" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>B</span>
            <span className="text-[14px] font-semibold tracking-tight">Bookmoo</span>
          </Link>
          <button type="button" onClick={toggleSidebar} className="w-7 h-7 rounded-md grid place-items-center transition-colors hover:bg-[var(--ui-hover)]"
            title={pt ? 'Recolher menu' : 'Collapse menu'} aria-label={pt ? 'Recolher menu' : 'Collapse menu'} style={{ color: 'var(--theme-nav-text-muted)' }}>
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className={isMobileDrawer ? 'flex flex-col gap-4' : 'flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 pb-3 flex flex-col gap-4'}>
        <div className="flex flex-col gap-0.5">
          <button type="button" onClick={() => { go(); setCommandOpen(true) }}
            className="w-full flex items-center gap-2.5 h-8 px-2 rounded-md text-[13.5px] transition-colors hover:bg-[var(--ui-hover)]"
            style={{ color: 'var(--theme-nav-text-muted)' }}>
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">{pt ? 'Buscar' : 'Search'}</span>
            <kbd className="kbd">{MOD_KEY} K</kbd>
          </button>
          <button type="button" onClick={() => { go(); if (location.pathname !== '/') navigate('/'); requestAddBook() }}
            className="w-full flex items-center gap-2.5 h-8 px-2 rounded-md text-[13.5px] transition-colors hover:bg-[var(--ui-hover)]"
            style={{ color: 'var(--theme-nav-text-muted)' }}>
            <Plus className="w-4 h-4" />
            <span>{t('addBook')}</span>
          </button>
        </div>

        {sections.map((section, i) => (
          <nav key={i} className="flex flex-col gap-0.5" aria-label={section.title}>
            {section.title && <p className="px-2 pb-1 text-[11.5px] font-medium" style={{ color: 'var(--theme-nav-text-muted)' }}>{section.title}</p>}
            {section.items.map(({ to, icon: ItemIcon, label, badge }) => {
              const active = isActive(to)
              return (
                <Link key={to} to={to} onClick={go} aria-current={active ? 'page' : undefined}
                  className="flex items-center gap-2.5 h-8 px-2 rounded-md text-[13.5px] transition-colors hover:bg-[var(--ui-hover)]"
                  style={{ backgroundColor: active ? 'var(--theme-nav-active)' : undefined, color: active ? 'var(--theme-nav-text)' : 'var(--theme-nav-text-muted)', fontWeight: active ? 500 : 400 }}>
                  <ItemIcon className="w-4 h-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                  <span className="flex-1 truncate">{label}</span>
                  {badge ? <span className="min-w-5 h-5 px-1.5 rounded-full grid place-items-center text-[11px] font-semibold tabular-nums"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--theme-accent) 14%, transparent)', color: 'var(--theme-accent)' }}
                    title={pt ? `${badge} para revisar` : `${badge} to review`}>{badge}</span> : null}
                </Link>
              )
            })}
          </nav>
        ))}

        {recent.length > 0 && (
          <nav className="flex flex-col gap-0.5" aria-label={pt ? 'Lendo agora' : 'Reading now'}>
            <p className="px-2 pb-1 text-[11.5px] font-medium" style={{ color: 'var(--theme-nav-text-muted)' }}>{pt ? 'Lendo agora' : 'Reading now'}</p>
            {recent.map(book => {
              const to = `/book/${book.id}`
              const active = location.pathname === to
              const progress = readingProgress(book.currentPage, book.pages.length, book.totalPages)
              return (
                <Link key={book.id} to={to} onClick={go} title={book.title}
                  className="flex items-center gap-2.5 h-9 px-2 rounded-md text-[13px] transition-colors hover:bg-[var(--ui-hover)]"
                  style={{ backgroundColor: active ? 'var(--theme-nav-active)' : undefined, color: active ? 'var(--theme-nav-text)' : 'var(--theme-nav-text-muted)' }}>
                  <span className="w-[18px] h-[26px] rounded-[3px] overflow-hidden shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.2)]" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                    {book.coverData && <img src={book.coverData} alt="" className="w-full h-full object-cover" />}
                  </span>
                  <span className="flex-1 min-w-0 truncate">{book.title}</span>
                  <span className="text-[11px] tabular-nums opacity-70">{progress}%</span>
                </Link>
              )
            })}
          </nav>
        )}
      </div>

      <div className={isMobileDrawer ? 'flex flex-col gap-2' : 'px-2 pb-2 pt-2 flex flex-col gap-1.5 border-t'} style={{ borderColor: 'var(--theme-border)' }}>
        <StudyTimer />
        <Link to="/stats" onClick={go} className="flex items-center gap-3 h-8 px-2 rounded-md text-[12.5px] tabular-nums hover:bg-[var(--ui-hover)]"
          style={{ color: 'var(--theme-nav-text-muted)' }} title={pt ? 'Sequência e pontos' : 'Streak and points'}>
          <span className="inline-flex items-center gap-1" style={{ color: studiedToday ? 'var(--pastel-amber-fg)' : undefined }}>
            <Flame className="w-3.5 h-3.5" fill={studiedToday ? 'currentColor' : 'none'} />{streak}
          </span>
          <span className="inline-flex items-center gap-1"><Star className="w-3.5 h-3.5" />{fmt.format(total)}</span>
          <span className="ml-auto inline-flex items-center gap-2">
            {!studiedToday && streak > 0 && <span className="text-[11px]">{pt ? 'estude hoje' : 'study today'}</span>}
            <span className="text-[11px] font-semibold tracking-wide" title={pt ? `${level.pt}. ${level.can.pt}` : `${level.en}. ${level.can.en}`}>{level.id}</span>
          </span>
        </Link>
        {userMenu(
          <button type="button" className="w-full flex items-center gap-2.5 h-10 px-2 rounded-md text-left transition-colors hover:bg-[var(--ui-hover)]"
            aria-label={pt ? 'Conta e preferências' : 'Account and preferences'}>
            <span className="grid place-items-center w-7 h-7 rounded-full text-[13px] font-semibold shrink-0" style={{ backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text)' }}>{initial}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-medium truncate" style={{ color: 'var(--theme-nav-text)' }}>{user?.email?.split('@')[0] ?? 'Bookmoo'}</span>
              <span className="block text-[11.5px] truncate" style={{ color: 'var(--theme-nav-text-muted)' }}>{pt ? 'Aparência, idioma e voz' : 'Appearance, language, voice'}</span>
            </span>
            <ChevronsUpDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--theme-nav-text-muted)' }} />
          </button>,
        )}
      </div>
    </Wrapper>
  )
}
