// Visitante vê o site; quem está logado (ou no app nativo) vê o app. Mesma URL para os dois.
import { lazy, Suspense, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '@/contexts/AuthContext'

const SiteHome = lazy(() => import('./pages/Home'))
const SiteRecursos = lazy(() => import('./story/FeaturePages').then(m => ({ default: m.SiteRecursos })))
const SiteLeitor = lazy(() => import('./story/FeaturePages').then(m => ({ default: m.SiteLeitor })))
const SiteIlustracoes = lazy(() => import('./story/FeaturePages').then(m => ({ default: m.SiteIlustracoes })))
const SitePratica = lazy(() => import('./story/FeaturePages').then(m => ({ default: m.SitePratica })))
const SiteEvolucao = lazy(() => import('./story/FeaturePages').then(m => ({ default: m.SiteEvolucao })))
const SiteBiblioteca = lazy(() => import('./story/FeaturePages').then(m => ({ default: m.SiteBiblioteca })))
const SiteTutores = lazy(() => import('./pages/Pages').then(m => ({ default: m.SiteTutores })))
const SitePlanos = lazy(() => import('./pages/Pages').then(m => ({ default: m.SitePlanos })))
const SiteProva = lazy(() => import('./pages/Pages').then(m => ({ default: m.SiteProva })))
const SiteSobre = lazy(() => import('./pages/Pages').then(m => ({ default: m.SiteSobre })))
const SiteLivros = lazy(() => import('./pages/Books').then(m => ({ default: m.SiteLivros })))
const SiteLivro = lazy(() => import('./pages/Books').then(m => ({ default: m.SiteLivro })))

export type SitePage = 'home' | 'recursos' | 'tutores' | 'planos' | 'prova' | 'sobre' | 'leitor' | 'ilustracoes' | 'pratica' | 'evolucao' | 'biblioteca' | 'livros' | 'livro'

const PAGES: Record<SitePage, React.ComponentType> = {
  home: SiteHome, recursos: SiteRecursos, tutores: SiteTutores, planos: SitePlanos, prova: SiteProva, sobre: SiteSobre,
  leitor: SiteLeitor, ilustracoes: SiteIlustracoes, pratica: SitePratica, evolucao: SiteEvolucao, biblioteca: SiteBiblioteca, livros: SiteLivros, livro: SiteLivro,
}

/** Rotas que têm versão pública (as do app com o mesmo caminho continuam para quem está logado). */
export const SITE_PATHS: Record<string, SitePage> = {
  '/': 'home', '/recursos': 'recursos', '/tutores': 'tutores', '/planos': 'planos', '/prova': 'prova', '/sobre': 'sobre',
}

const isNative = Capacitor.isNativePlatform()

function Blank() {
  return <div style={{ minHeight: '100dvh', background: '#f9f8f7' }} />
}

export function SitePageView({ page }: { page: SitePage }) {
  const Page = PAGES[page]
  return <Suspense fallback={<Blank />}><Page /></Suspense>
}

/** Mostra a página do site para o visitante; para quem está logado, mostra `children` (o app). */
export function VisitorGate({ children, page }: { children: ReactNode; page?: SitePage }) {
  const { hasSupabase, session, loading } = useAuth()
  const { pathname } = useLocation()
  const target = page ?? SITE_PATHS[pathname.replace(/\/+$/, '') || '/']
  if (!target || isNative || !hasSupabase) return <>{children}</>
  if (loading) return <Blank />
  if (session) return <>{children}</>
  return <SitePageView page={target} />
}

/** Páginas só do site (/recursos, /tutores, /sobre): logado também vê o site. */
export function SiteOnly({ page }: { page: SitePage }) {
  return <SitePageView page={page} />
}
