// Menu do celular (hambúrguer): folha que sobe de baixo, como no iOS, com todos os destinos do app em grade.
import { useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AudioLines, Plus, Bell, Brain, BookMarked, ChartNoAxesColumn, House, Layers, Library, MessagesSquare, PenLine, Settings, Shield, Sparkles, Users, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useLanguage } from '@/store/useLanguage'
import { useAuth } from '@/contexts/AuthContext'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useUnreadNotifications } from '@/components/community/NotificationBell'
import { haptics } from '@/lib/haptics'
import { useUiStore } from '@/store/useUiStore'

type Item = { to: string; icon: LucideIcon; pt: string; en: string; badge?: number }

export function MenuSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const pt = useLanguage().locale === 'pt-BR'
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const requestAddBook = useUiStore(s => s.requestAddBook)
  const { isAdmin } = useAuth()
  const unread = useUnreadNotifications()
  const vocab = useVocabularyStore(s => s.vocabularies)
  const review = useMemo(() => vocab.filter(v => v.status === 'review').length, [vocab])

  const groups: { title: [string, string]; items: Item[] }[] = [
    { title: ['Praticar', 'Practice'], items: [
      { to: '/conversar', icon: MessagesSquare, pt: 'Conversar', en: 'Conversation' },
      { to: '/practice/speak', icon: AudioLines, pt: 'Falar', en: 'Speak' },
      { to: '/practice/write', icon: PenLine, pt: 'Ditado', en: 'Dictation' },
      { to: '/vocabulary', icon: BookMarked, pt: 'Palavras', en: 'Words', badge: review || undefined },
    ] },
    { title: ['Progresso', 'Progress'], items: [
      { to: '/stats', icon: ChartNoAxesColumn, pt: 'Estatísticas', en: 'Statistics' },
      { to: '/raio-x', icon: Brain, pt: 'Raio-X', en: 'Insights' },
      { to: '/planos', icon: Sparkles, pt: 'Planos', en: 'Plans' },
    ] },
    { title: ['Explorar', 'Explore'], items: [
      { to: '/', icon: House, pt: 'Início', en: 'Home' },
      { to: '/gallery', icon: Library, pt: 'Galeria', en: 'Gallery' },
      { to: '/collections', icon: Layers, pt: 'Coleções', en: 'Collections' },
      { to: '/community', icon: Users, pt: 'Comunidade', en: 'Community' },
      { to: '/notifications', icon: Bell, pt: 'Avisos', en: 'Notifications', badge: unread || undefined },
      { to: '/settings', icon: Settings, pt: 'Ajustes', en: 'Settings' },
      ...(isAdmin ? [{ to: '/admin', icon: Shield, pt: 'Admin', en: 'Admin' }] : []),
    ] },
  ]
  const active = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5">
        <DialogTitle className="sr-only">{pt ? 'Menu' : 'Menu'}</DialogTitle>
        {groups.map(g => (
          <section key={g.title[1]} aria-label={pt ? g.title[0] : g.title[1]}>
            <p className="px-1 mb-2 text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? g.title[0] : g.title[1]}</p>
            <ul className="grid grid-cols-4 gap-2">
              {g.items.map(it => {
                const on = active(it.to)
                const Icon = it.icon
                return (
                  <li key={it.to}>
                    <Link to={it.to} onClick={() => { haptics.selection(); onOpenChange(false) }} aria-current={on ? 'page' : undefined}
                      className="pressable relative flex flex-col items-center justify-center gap-1.5 h-[76px] rounded-2xl text-[12px] font-medium text-center leading-tight px-1"
                      style={{ backgroundColor: on ? 'var(--theme-nav-active)' : 'var(--theme-bg-secondary)', color: 'var(--theme-text)' }}>
                      <span className="relative">
                        <Icon className="w-[22px] h-[22px]" strokeWidth={on ? 2.2 : 1.8} aria-hidden />
                        {it.badge ? <span aria-hidden className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full grid place-items-center text-[10.5px] font-semibold text-white" style={{ backgroundColor: 'var(--color-destructive)' }}>{it.badge > 99 ? '99+' : it.badge}</span> : null}
                      </span>
                      <span className="max-w-full text-[11.5px] tracking-tight">{pt ? it.pt : it.en}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        <button type="button" onClick={() => { haptics.selection(); onOpenChange(false); navigate('/'); requestAddBook() }}
          className="pressable flex items-center gap-2.5 h-12 px-3 rounded-2xl text-[14.5px] font-medium" style={{ backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text)' }}>
          <Plus className="w-[20px] h-[20px]" aria-hidden />{pt ? 'Adicionar um livro' : 'Add a book'}
        </button>
      </DialogContent>
    </Dialog>
  )
}
