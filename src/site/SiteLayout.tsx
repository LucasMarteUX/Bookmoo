import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowRight, Menu, X } from 'lucide-react'
import { Logo } from './SiteLogo'
import { useScrollReveal } from './ScrollReveal'
import { SUPPORT_EMAIL } from './content'
import './site.css'
import './site-shell.css'
import './dither.css'
import './home/journey.css'
import './pages/editorial-pages.css'

const navigation = [
  { to: '/leitor', label: 'Leitor' },
  { to: '/tutores', label: 'Tutores' },
  { to: '/biblioteca', label: 'Biblioteca' },
  { to: '/prova', label: 'Prova' },
  { to: '/planos', label: 'Planos' },
  { to: '/sobre', label: 'Sobre' },
]

const footerLinks = [
  { title: 'Explore', links: navigation },
  { title: 'Aprenda', links: [
    { to: '/leitor', label: 'Leitor' },
    { to: '/ilustracoes', label: 'Ilustrações' },
    { to: '/pratica', label: 'Prática' },
    { to: '/evolucao', label: 'Evolução e Raio-X' },
    { to: '/biblioteca', label: 'Biblioteca' },
    { to: '/recursos', label: 'Todos os recursos' },
  ] },
  { title: 'Ajuda', links: [
    { to: '/faq', label: 'Perguntas frequentes' },
    { to: '/contato', label: 'Contato' },
    { to: '/conduta', label: 'Código de conduta' },
    { to: '/login', label: 'Entrar na conta' },
  ] },
]

function Nav() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    dialog.current?.close()
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const previous = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    const desktop = window.matchMedia('(min-width: 850px)')
    const onResize = () => { if (desktop.matches) dialog.current?.close() }
    desktop.addEventListener('change', onResize)
    return () => {
      desktop.removeEventListener('change', onResize)
      document.documentElement.style.overflow = previous
    }
  }, [open])

  return <header className="public-header">
    <a className="public-skip" href="#conteudo">Pular para o conteúdo</a>
    <div className="public-bar">
      <Link to="/" aria-label="Upoonly, início" className="public-logo"><Logo height={32}/></Link>
      <nav className="public-links" aria-label="Navegação principal">
        {navigation.map(item => <NavLink key={item.to} to={item.to}>{item.label}</NavLink>)}
      </nav>
      <div className="public-account">
        <Link to="/login" className="public-signin">Entrar</Link>
        <Link to="/signup" className="public-register">Começar grátis <ArrowRight size={15}/></Link>
        <button type="button" className="public-menu-trigger" aria-expanded={open} aria-controls="site-menu" aria-label="Abrir menu" onClick={() => {
          dialog.current?.showModal()
          setOpen(true)
        }}><Menu size={21}/></button>
      </div>
    </div>
    <dialog ref={dialog} id="site-menu" aria-label="Menu do Upoonly" className="public-menu" onClose={() => setOpen(false)}>
      <div className="public-menu-top"><Logo height={30}/><button type="button" aria-label="Fechar menu" onClick={() => dialog.current?.close()}><X size={21}/></button></div>
      <nav aria-label="Navegação no celular">
        {[{to:'/',label:'Início'}, ...navigation].map(item => <NavLink key={item.to} end to={item.to} onClick={() => dialog.current?.close()}>{item.label}<ArrowRight size={19}/></NavLink>)}
      </nav>
      <div className="public-menu-account">
        <Link to="/login" className="public-signin">Entrar na minha conta</Link>
        <Link to="/signup" className="public-register">Começar grátis <ArrowRight size={15}/></Link>
      </div>
    </dialog>
  </header>
}

function Footer() {
  return <footer className="public-footer">
    <div className="public-footer-grid">
      <div className="public-brand">
        <Link to="/" aria-label="Upoonly, início"><Logo height={40}/></Link>
        <p>Livros em inglês, áudio e conversas sobre o que você lê.</p>
        <a href={'mailto:' + SUPPORT_EMAIL}>{SUPPORT_EMAIL}</a>
      </div>
      {footerLinks.map(group => <div className="public-footer-col" key={group.title}>
        <h2>{group.title}</h2>
        {group.links.map(item => <Link key={item.to} to={item.to}>{item.label}</Link>)}
      </div>)}
    </div>
    <div className="public-colophon">
      <span>© {new Date().getFullYear()} Upoonly</span>
      <div><Link to="/terms">Termos de uso</Link><Link to="/privacy">Privacidade</Link><Link to="/conduta">Conduta</Link><Link to="/contato">Contato</Link></div>
    </div>
  </footer>
}

export function SiteLayout({ children }: { children: ReactNode }) {
  const { pathname, hash } = useLocation()
  useScrollReveal()
  useEffect(() => {
    const target = hash && document.getElementById(hash.slice(1))
    if (!target) { window.scrollTo({ top: 0, behavior: 'instant' }); return }
    const frame = requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'instant' }))
    return () => cancelAnimationFrame(frame)
  }, [pathname, hash])
  return <div className="site">
    <Nav/>
    <main id="conteudo" className="home-journey">{children}</main>
    <Footer/>
  </div>
}
