import { AudioLines, BookMarked, House, Library, UserRound, type LucideIcon } from 'lucide-react'

export type Tab = { id: string; to: string; icon: LucideIcon; pt: string; en: string; match: (path: string) => boolean }

/** As 5 abas do celular (limite do iOS). O resto mora na aba "Você". */
export const TABS: Tab[] = [
  { id: 'home', to: '/', icon: House, pt: 'Início', en: 'Home', match: p => p === '/' || p.startsWith('/book/') },
  { id: 'gallery', to: '/gallery', icon: Library, pt: 'Galeria', en: 'Gallery', match: p => p.startsWith('/gallery') },
  { id: 'practice', to: '/practice/speak', icon: AudioLines, pt: 'Praticar', en: 'Practice', match: p => p.startsWith('/practice') },
  { id: 'words', to: '/vocabulary', icon: BookMarked, pt: 'Palavras', en: 'Words', match: p => p.startsWith('/vocabulary') },
  {
    id: 'me', to: '/me', icon: UserRound, pt: 'Você', en: 'You',
    match: p => ['/me', '/settings', '/stats', '/community', '/profile', '/u/', '/post/', '/admin', '/notifications'].some(r => p === r || p.startsWith(r.endsWith('/') ? r : r + '/') || p === r),
  },
]

/** Telas-raiz de cada aba: sem botão voltar. */
const ROOTS = new Set(['/', '/gallery', '/practice/speak', '/practice/write', '/vocabulary', '/me'])
export const isTabRoot = (path: string) => ROOTS.has(path)

export function activeTab(path: string) {
  return TABS.find(t => t.match(path)) ?? TABS[0]
}

/** Título curto que aparece na barra superior. */
export function screenTitle(path: string, pt: boolean): string {
  const map: [RegExp, string, string][] = [
    [/^\/$/, 'Início', 'Home'],
    [/^\/book\//, '', ''],
    [/^\/gallery\/.+/, 'Galeria', 'Gallery'],
    [/^\/gallery$/, 'Galeria', 'Gallery'],
    [/^\/practice\/speak/, 'Falar', 'Speak'],
    [/^\/practice\/write/, 'Ditado', 'Dictation'],
    [/^\/vocabulary/, 'Palavras', 'Words'],
    [/^\/me$/, 'Você', 'You'],
    [/^\/settings/, 'Ajustes', 'Settings'],
    [/^\/stats/, 'Estatísticas', 'Statistics'],
    [/^\/community/, 'Comunidade', 'Community'],
    [/^\/(profile|u)\//, 'Perfil', 'Profile'],
    [/^\/post\//, 'Publicação', 'Post'],
    [/^\/notifications/, 'Notificações', 'Notifications'],
    [/^\/admin/, 'Admin', 'Admin'],
  ]
  const hit = map.find(([re]) => re.test(path))
  return hit ? (pt ? hit[1] : hit[2]) : 'Bookmoo'
}

/** Para onde o "voltar" leva quando não há histórico (link aberto direto). */
export function parentOf(path: string): string {
  if (path.startsWith('/gallery/')) return '/gallery'
  if (path.startsWith('/book/')) return '/'
  if (/^\/(settings|stats|community|admin|notifications)/.test(path)) return '/me'
  if (/^\/(profile|u|post)\//.test(path)) return '/community'
  return '/'
}

/** Rodando como app instalado (PWA na tela inicial ou Capacitor)? */
export function isStandalone() {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return !!nav.standalone || window.matchMedia('(display-mode: standalone)').matches || !!cap?.isNativePlatform?.()
}
