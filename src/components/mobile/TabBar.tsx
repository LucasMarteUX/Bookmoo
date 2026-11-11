import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLanguage } from '@/store/useLanguage'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { haptics } from '@/lib/haptics'
import { TABS } from './routes'

/**
 * Tab bar do iOS: 5 abas, ícone + rótulo, translúcida, respeita a home indicator.
 * Tocar na aba ativa rola a tela até o topo (ou volta para a raiz da aba).
 */
export function TabBar() {
  const { pathname } = useLocation()
  const pt = useLanguage().locale === 'pt-BR'
  const vocab = useVocabularyStore(s => s.vocabularies)
  const review = useMemo(() => vocab.filter(v => v.status === 'review').length, [vocab])

  return (
    <nav aria-label={pt ? 'Navegação principal' : 'Main navigation'}
      className="ios-bar fixed bottom-0 inset-x-0 z-50 border-t"
      style={{ borderColor: 'var(--theme-border)', paddingBottom: 'var(--safe-b)', paddingLeft: 'var(--safe-l)', paddingRight: 'var(--safe-r)' }}>
      <ul className="mx-auto max-w-md grid grid-cols-5" style={{ height: 'var(--tabbar-h)' }}>
        {TABS.map(tab => {
          const active = tab.match(pathname)
          const Icon = tab.icon
          const label = pt ? tab.pt : tab.en
          const badge = tab.id === 'words' && review > 0 ? review : 0
          return (
            <li key={tab.id} className="contents">
              <Link to={tab.to} aria-current={active ? 'page' : undefined}
                aria-label={badge ? `${label}, ${badge} ${pt ? 'para revisar' : 'to review'}` : label}
                onClick={e => {
                  haptics.selection()
                  if (active && pathname === tab.to) {
                    e.preventDefault()
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }
                }}
                className="pressable relative flex flex-col items-center justify-center gap-[3px] pt-1 text-[11px] font-medium leading-none"
                style={{ color: active ? 'var(--theme-text)' : 'var(--theme-nav-text-muted)' }}>
                <span className="relative">
                  <Icon className="w-[24px] h-[24px]" strokeWidth={active ? 2.3 : 1.7} aria-hidden />
                  {badge ? (
                    <span aria-hidden className="absolute -top-1 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center text-[11px] font-semibold text-white"
                      style={{ backgroundColor: 'var(--color-destructive)' }}>{badge > 99 ? '99+' : badge}</span>
                  ) : null}
                </span>
                <span>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
