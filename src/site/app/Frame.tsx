// Moldura das telas reconstruídas: desenha em tamanho real (1280 px) e escala para caber, então o texto continua nítido.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Award, AudioLines, Bell, BookMarked, Brain, ChartNoAxesColumn, ChevronsUpDown, Flame, GraduationCap, House, Layers, Library, MessagesSquare, PanelLeft, PenLine, Search, Sparkles, Star, Users, BadgeCheck } from 'lucide-react'
import { Logo } from '../SiteLogo'
import { coverSrc } from '../covers'
import './mock.css'

export type MockTheme = 'dark' | 'light' | 'sepia'

export function Scaled({ width = 1280, height = 800, children, className = '' }: { width?: number; height?: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [s, setS] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setS(e.contentRect.width / width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])
  return (
    <div ref={ref} className={`relative w-full overflow-hidden ${className}`} style={{ aspectRatio: `${width} / ${height}` }}>
      {s > 0 && <div style={{ width, height, transform: `scale(${s})`, transformOrigin: '0 0', position: 'absolute', inset: '0 auto auto 0' }}>{children}</div>}
    </div>
  )
}

/** Janela de navegador em volta da tela do app. */
export function Window({ theme, children, url = 'upoonly.com', height = 800 }: { theme: MockTheme; children: ReactNode; url?: string; height?: number }) {
  const dark = theme === 'dark'
  return (
    <div className="rounded-[14px] overflow-hidden" style={{ boxShadow: dark ? '0 0 0 1px rgba(255,255,255,.08), 0 50px 100px -30px rgba(0,0,0,.6)' : '0 0 0 1px rgba(25,25,25,.08), 0 50px 100px -40px rgba(60,45,25,.45)' }}>
      <Scaled height={height + 38}>
        <div className={`mk mk-${theme} w-[1280px] flex flex-col`} style={{ height: height + 38 }}>
          <div className="h-[38px] shrink-0 flex items-center gap-2 px-4" style={{ background: 'var(--t-bg2)', borderBottom: '1px solid var(--t-border)' }}>
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" /><span className="w-3 h-3 rounded-full bg-[#febc2e]" /><span className="w-3 h-3 rounded-full bg-[#28c840]" />
            <div className="mx-auto h-6 w-[340px] rounded-md flex items-center justify-center gap-1.5 text-[12px]" style={{ background: 'var(--t-bg)', color: 'var(--t-muted)' }}>
              <span className="w-2.5 h-2.5 rounded-sm border" style={{ borderColor: 'var(--t-muted)' }} />{url}
            </div>
            <span className="w-[52px]" />
          </div>
          <div className="flex-1 min-h-0 flex">{children}</div>
        </div>
      </Scaled>
    </div>
  )
}

const NAV: { title?: string; items: { id: string; icon: typeof House; label: string; badge?: number }[] }[] = [
  { items: [{ id: 'home', icon: House, label: 'Início' }] },
  { title: 'Explorar', items: [
    { id: 'gallery', icon: Library, label: 'Galeria' }, { id: 'collections', icon: Layers, label: 'Coleções' },
    { id: 'vocab', icon: BookMarked, label: 'Vocabulário', badge: 18 }, { id: 'community', icon: Users, label: 'Comunidade' },
    { id: 'notifications', icon: Bell, label: 'Notificações', badge: 3 },
  ] },
  { title: 'Praticar', items: [
    { id: 'talk', icon: MessagesSquare, label: 'Conversar' }, { id: 'speak', icon: AudioLines, label: 'Falar' }, { id: 'write', icon: PenLine, label: 'Ditado' },
  ] },
  { title: 'Progresso', items: [
    { id: 'stats', icon: ChartNoAxesColumn, label: 'Estatísticas' }, { id: 'insights', icon: Brain, label: 'Raio-X' },
    { id: 'level', icon: GraduationCap, label: 'Teste de nível' }, { id: 'exam', icon: Award, label: 'Prova de proficiência' },
  ] },
]

export function Sidebar({ active = 'home' }: { active?: string }) {
  return (
    <aside className="w-[244px] shrink-0 flex flex-col text-[13.5px]" style={{ background: 'var(--t-nav)', color: 'var(--t-nav-text)', borderRight: '1px solid var(--t-border)' }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Logo height={21} />
        <PanelLeft size={16} style={{ color: 'var(--t-nav-muted)' }} />
      </div>
      <div className="px-2 flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="flex items-center gap-2.5 px-2.5 h-8 rounded-md" style={{ color: 'var(--t-nav-muted)' }}>
          <Search size={15} /><span className="flex-1">Buscar</span><span className="text-[11px] px-1.5 rounded" style={{ background: 'var(--t-nav-active)' }}>⌘ K</span>
        </div>
        {NAV.map((sec, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {sec.title && <p className="px-2.5 pb-1 text-[11.5px]" style={{ color: 'var(--t-nav-muted)' }}>{sec.title}</p>}
            {sec.items.map(it => (
              <div key={it.id} className="flex items-center gap-2.5 px-2.5 h-8 rounded-md" style={active === it.id ? { background: 'var(--t-nav-active)', color: 'var(--t-text)', fontWeight: 500 } : undefined}>
                <it.icon size={15} style={{ color: active === it.id ? 'var(--t-text)' : 'var(--t-nav-muted)' }} />
                <span className="flex-1">{it.label}</span>
                {it.badge && <span className="text-[11px] min-w-5 h-5 px-1.5 rounded-full grid place-items-center" style={{ background: 'var(--t-nav-active)', color: 'var(--t-nav-text)' }}>{it.badge}</span>}
              </div>
            ))}
          </div>
        ))}
        <div className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-[11.5px]" style={{ color: 'var(--t-nav-muted)' }}>Lendo agora</p>
          {[['short-fiction', 'Short Fiction', 34], ['alices-adventures-in-wonderland', 'Alice’s Adventures…', 12]].map(([s, t, p]) => (
            <div key={s as string} className="flex items-center gap-2.5 px-2.5 h-8 rounded-md">
              <img src={coverSrc(s as string)} alt="" className="w-4 h-5 rounded-[2px] object-cover" />
              <span className="flex-1 truncate">{t}</span><span className="text-[11.5px]" style={{ color: 'var(--t-nav-muted)' }}>{p}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="px-3 pt-3 pb-3 flex flex-col gap-3" style={{ borderTop: '1px solid var(--t-border)' }}>
        <div>
          <div className="flex items-center justify-between text-[12px]" style={{ color: 'var(--t-nav-muted)' }}><span className="flex items-center gap-1.5"><Sparkles size={12} />Créditos</span><span>412 / 550</span></div>
          <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'var(--t-nav-active)' }}><div className="h-full w-[75%] rounded-full" style={{ background: 'var(--t-text)' }} /></div>
        </div>
        <div className="flex items-center gap-3 text-[12.5px]">
          <span className="flex items-center gap-1"><Flame size={13} />12</span><span className="flex items-center gap-1"><Star size={13} />2.480</span>
          <span className="ml-auto flex items-center gap-1 px-2 h-6 rounded-full text-[11.5px] font-medium" style={{ background: 'var(--t-primary)', color: 'var(--t-primary-text)' }}><BadgeCheck size={12} />Intermediário</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full grid place-items-center text-[13px] font-medium" style={{ background: '#E9D7C5', color: '#5A3A1F' }}>M</span>
          <div className="flex-1 leading-tight"><p className="text-[13px] font-medium">Marina Costa</p><p className="text-[11.5px]" style={{ color: 'var(--t-nav-muted)' }}>Aparência, idioma e voz</p></div>
          <ChevronsUpDown size={14} style={{ color: 'var(--t-nav-muted)' }} />
        </div>
      </div>
    </aside>
  )
}
