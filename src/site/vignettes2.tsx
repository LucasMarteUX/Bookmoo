// Mais representações das funções (tema Dia do app) e o Fit, que reduz a peça para caber na largura disponível (celular).
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { BookOpen, Check, Clock, Coffee, CloudRain, FileText, Flame, Gift, Headphones, Lightbulb, Moon, NotebookPen, Pencil, Smartphone, Sparkles, Star, Sun, Upload, Volume2 } from 'lucide-react'
import { UiCard } from './vignettes'
import { coverSrc } from './covers'
import { tutorAvatar } from './content'

const EASE = [0.2, 0.8, 0.2, 1] as const
const ui = { fontFamily: '"Inter Variable", Inter, system-ui, sans-serif', color: '#15171C' } as const
const display = { fontFamily: '"Newsreader Variable", Newsreader, Georgia, serif', letterSpacing: '-0.015em' } as const
const serif = { fontFamily: '"Literata Variable", Literata, Georgia, serif' } as const
const muted = '#636874'
const G = { bg: '#E3F1E7', fg: '#2D6040' }, A = { bg: '#FBEEDB', fg: '#7A5121' }, B = { bg: '#E4ECF7', fg: '#2F4B73' }, Rr = { bg: '#F8E4E1', fg: '#8A3C33' }

/** Reduz o conteúdo (sem deformar) quando ele é mais largo que o espaço. Nunca amplia. */
export function Fit({ children, className = '' }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState({ scale: 1, height: undefined as number | undefined })
  useLayoutEffect(() => {
    const frame = outer.current, content = inner.current
    if (!frame || !content) return
    const measure = () => {
      const scale = Math.min(1, frame.clientWidth / Math.max(1, content.offsetWidth))
      const height = content.offsetHeight * scale
      setLayout(last => last.scale === scale && last.height === height ? last : { scale, height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={outer} className={`flex w-full min-w-0 items-start justify-center ${className}`} style={{ height: layout.height }}>
      <div ref={inner} className="w-max shrink-0" style={{ transform: `scale(${layout.scale})`, transformOrigin: 'center top' }}>{children}</div>
    </div>
  )
}

/* ---------------------------------------------------------------- Leitura confortável */

export function VThemes() {
  const themes = [{ n: 'Dia', I: Sun, bg: '#FFFFFF', fg: '#15171C' }, { n: 'Tarde', I: Coffee, bg: '#F4EAD8', fg: '#3A2D21' }, { n: 'Noite', I: Moon, bg: '#191919', fg: '#EBEBEA' }]
  return (
    <div className="flex flex-col items-center gap-4" style={ui}>
      <div className="flex gap-3">
        {themes.map((t, i) => (
          <motion.div key={t.n} className="w-[118px] h-[150px] rounded-2xl p-3.5 flex flex-col" style={{ background: t.bg, color: t.fg, boxShadow: '0 20px 40px -20px rgba(80,40,20,.4), 0 0 0 1px rgba(25,25,25,.06)' }}
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: i * 0.08 }}>
            <t.I size={14} />
            <div className="mt-auto flex flex-col gap-1.5">{[90, 100, 75, 95].map((w, k) => <span key={k} className="h-1.5 rounded-full opacity-30" style={{ width: `${w}%`, background: t.fg }} />)}</div>
            <p className="text-[12px] mt-3 font-medium">{t.n}</p>
          </motion.div>
        ))}
      </div>
      <UiCard className="flex items-center gap-2 px-3 py-2 text-[12.5px]" delay={0.3}>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: '#15171C', color: '#fff' }}>🔥 Lareira</span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ color: muted }}><CloudRain size={13} />Chuva</span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ color: muted }}>Aa · Literata</span>
      </UiCard>
    </div>
  )
}

/* ---------------------------------------------------------------- Velocidade e vozes */

export function VSpeed() {
  return (
    <UiCard className="w-[360px] p-5">
      <p className="text-[12px] font-medium mb-3">Quem lê para você</p>
      <div className="grid grid-cols-4 gap-2">
        {[['bia', 'Bia'], ['luck', 'Luck'], ['yuno', 'Yuno'], ['yuri', 'Yuri']].map(([id, n], k) => (
          <div key={id} className="flex flex-col items-center gap-1.5 rounded-xl py-2.5" style={k === 0 ? { background: '#F3F4F6', boxShadow: 'inset 0 0 0 1.5px #15171C' } : undefined}>
            <img src={tutorAvatar(id)} alt="" className="w-10 h-10 rounded-full" style={{ background: 'var(--site-surface)' }} />
            <span className="text-[12px]">{n}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between text-[12px]"><span className="flex items-center gap-1.5"><Volume2 size={13} />Velocidade</span><span className="font-semibold">0,8×</span></div>
      <div className="relative mt-2.5 h-1.5 rounded-full" style={{ background: '#EEF0F4' }}>
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-[#15171C]" initial={{ width: '60%' }} whileInView={{ width: ['60%', '35%', '45%'] }} viewport={{ once: true }} transition={{ duration: 2.4, ease: EASE }} />
      </div>
      <div className="flex justify-between text-[11px] mt-1.5" style={{ color: muted }}><span>0,6×</span><span>1×</span><span>1,5×</span></div>
      <p className="text-[11.5px] mt-3" style={{ color: muted }}>Mais devagar, sem mudar o tom da voz.</p>
    </UiCard>
  )
}

/* ---------------------------------------------------------------- Notas */

export function VNotes() {
  return (
    <div className="relative w-[380px] pb-10" style={ui}>
      <UiCard className="p-5" float={false}>
        <p className="text-[17px] leading-[1.75]" style={serif}>
          “It is a truth universally acknowledged, that <span style={{ background: '#FBEEDB', boxShadow: 'inset 0 -2px 0 #EBC995' }}>a single man in possession of a good fortune</span>, must be in want of a wife.”
        </p>
      </UiCard>
      <UiCard className="absolute right-[-8px] bottom-0 w-[230px] p-3.5" delay={0.2}>
        <p className="text-[11.5px] flex items-center gap-1.5" style={{ color: muted }}><NotebookPen size={12} />Sua nota</p>
        <p className="text-[13px] mt-1 leading-snug">Ironia da Austen: a frase diz o contrário do que parece 😄</p>
      </UiCard>
    </div>
  )
}

/* ---------------------------------------------------------------- Decifrar a página */

export function VGrammar() {
  return (
    <UiCard className="w-[380px] p-5">
      <p className="text-[11px] tracking-[.1em] flex items-center gap-1.5" style={{ color: muted }}><Lightbulb size={12} />DECIFRAR A PÁGINA</p>
      <p className="text-[17px] leading-[1.8] mt-3" style={serif}>
        Alice <span className="rounded px-1" style={{ background: B.bg, color: B.fg }}>had been</span> <span className="rounded px-1" style={{ background: A.bg, color: A.fg }}>wondering</span> what <span className="rounded px-1" style={{ background: G.bg, color: G.fg }}>would</span> happen next.
      </p>
      <div className="mt-4 flex flex-col gap-2 text-[12.5px]">
        <p className="flex gap-2"><span className="px-1.5 rounded font-medium" style={{ background: B.bg, color: B.fg }}>had been</span><span style={{ color: muted }}>past perfect: algo que vinha acontecendo antes</span></p>
        <p className="flex gap-2"><span className="px-1.5 rounded font-medium" style={{ background: A.bg, color: A.fg }}>-ing</span><span style={{ color: muted }}>ação contínua: “ficou se perguntando”</span></p>
        <p className="flex gap-2"><span className="px-1.5 rounded font-medium" style={{ background: G.bg, color: G.fg }}>would</span><span style={{ color: muted }}>futuro visto do passado</span></p>
      </div>
    </UiCard>
  )
}

/* ---------------------------------------------------------------- Mosaico da comunidade */

export function VMosaic() {
  const imgs = ['realismo-magico', 'aquarela-nanquim', 'infantil-guache', 'romance-aquarela', 'pintura-historica', 'anime-colorido']
  return (
    <UiCard className="w-[360px] p-4">
      <div className="flex items-baseline gap-2"><span className="text-[22px]" style={display}>whisper</span><span className="text-[12px]" style={{ color: muted }}>sussurrar</span></div>
      <div className="grid grid-cols-3 gap-1.5 mt-3">
        {imgs.map((s, i) => <motion.img key={s} src={`/styles/${s}.webp`} alt="" className="aspect-square w-full rounded-lg object-cover" initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE, delay: i * 0.06 }} />)}
      </div>
      <p className="text-[11.5px] mt-3" style={{ color: muted }}>Imagens que a comunidade criou para memorizar a palavra.</p>
    </UiCard>
  )
}

/* ---------------------------------------------------------------- História de reforço */

export function VStory() {
  return (
    <UiCard className="w-[370px] p-5">
      <p className="text-[11px] tracking-[.1em] flex items-center gap-1.5" style={{ color: muted }}><Sparkles size={12} />HISTÓRIA DE REFORÇO · PASSADO IRREGULAR</p>
      <p className="text-[19px] mt-2" style={display}>The Lost Key</p>
      <p className="text-[15px] leading-[1.75] mt-2" style={serif}>
        Yesterday Tom <b className="font-semibold" style={{ color: G.fg }}>went</b> to the market. He <b className="font-semibold" style={{ color: G.fg }}>saw</b> an old key on the floor and <b className="font-semibold" style={{ color: G.fg }}>thought</b> it was magic…
      </p>
      <div className="mt-3 flex gap-1.5 text-[11.5px]">{['went', 'saw', 'thought'].map(w => <span key={w} className="px-2 py-0.5 rounded-md" style={{ background: G.bg, color: G.fg }}>{w}</span>)}</div>
    </UiCard>
  )
}

/* ---------------------------------------------------------------- Estilos */

export function VStylesGrid() {
  const s = [['aquarela-nanquim', 'Aquarela'], ['manga-tradicional', 'Mangá'], ['hq-americana', 'HQ americana'], ['noir-misterio', 'Noir'], ['fantasia-epica', 'Fantasia'], ['terror-gotico', 'Gótico']]
  return (
    <div className="grid grid-cols-3 gap-2.5 w-[400px]">
      {s.map(([id, n], i) => (
        <motion.figure key={id} className="relative rounded-xl overflow-hidden" style={{ boxShadow: '0 16px 30px -16px rgba(80,40,20,.45)' }}
          initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: EASE, delay: i * 0.05 }}>
          <img src={`/styles/${id}.webp`} alt={n} className="w-full aspect-square object-cover block" />
          <figcaption className="absolute left-1.5 bottom-1.5 text-[10.5px] px-1.5 py-0.5 rounded-md bg-white/90" style={ui}>{n}</figcaption>
        </motion.figure>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- Balões */

export function VBalloon() {
  return (
    <UiCard className="w-[380px] p-2.5">
      <div className="relative rounded-xl overflow-hidden aspect-[16/10]">
        <img src="/site/reader/peter-rabbit-page.webp" alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: '50% 42%' }} />
        <div className="absolute right-3 top-3 rounded-[3px] px-3 py-2 text-[13px] font-semibold" style={{ background: '#FBF3D5', color: '#1d1a14', boxShadow: '0 0 0 1.5px #2b261c' }}>“Now my dears,” said old Mrs. Rabbit…</div>
        <div className="absolute left-[32%] bottom-4 flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-bold" style={{ background: '#F5C451', color: '#2b261c', boxShadow: '0 0 0 1.5px #2b261c' }}><Volume2 size={11} />MRS. RABBIT</div>
      </div>
    </UiCard>
  )
}

/* ---------------------------------------------------------------- Questionário */

export function VQuiz() {
  const opts = ['Because the book had no pictures.', 'Because she was hungry.', 'Because it was raining.']
  return (
    <UiCard className="w-[370px] p-5">
      <p className="text-[11px] tracking-[.1em]" style={{ color: muted }}>QUESTIONÁRIO · CAPÍTULO 1</p>
      <p className="text-[16px] mt-2 font-medium">Why was Alice bored?</p>
      <div className="mt-3 flex flex-col gap-2">
        {opts.map((o, i) => (
          <div key={o} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px]" style={i === 0 ? { background: G.bg, color: G.fg, boxShadow: `inset 0 0 0 1.5px ${G.fg}` } : { background: '#F3F4F6' }}>
            <span className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-semibold" style={i === 0 ? { background: G.fg, color: '#fff' } : { background: '#fff' }}>{i === 0 ? <Check size={11} /> : String.fromCharCode(65 + i)}</span>{o}
          </div>
        ))}
      </div>
    </UiCard>
  )
}

/* ---------------------------------------------------------------- Cenas */

export function VScenes() {
  const scenes = [['☕️', 'No café', 'Peça seu pedido e puxe conversa', 'A2'], ['💼', 'Entrevista de emprego', 'Fale de você com confiança', 'B2'], ['✈️', 'No aeroporto', 'Check-in, portão e imprevistos', 'B1']]
  return (
    <div className="w-[370px] flex flex-col gap-2.5" style={ui}>
      {scenes.map(([e, t, d, l], i) => (
        <UiCard key={t} className="p-3.5 flex items-center gap-3" delay={i * 0.08} float={false}>
          <span className="w-11 h-11 rounded-xl grid place-items-center text-[20px]" style={{ background: '#F3F4F6' }}>{e}</span>
          <div className="flex-1"><p className="text-[14px] font-medium">{t}</p><p className="text-[12px]" style={{ color: muted }}>{d}</p></div>
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ boxShadow: 'inset 0 0 0 1px #E3E6EB' }}>{l}</span>
        </UiCard>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- Memória do tutor */

export function VMemory() {
  return (
    <UiCard className="w-[360px] p-5">
      <div className="flex items-center gap-3"><img src={tutorAvatar('luck')} alt="" className="w-10 h-10 rounded-full" style={{ background: 'var(--site-surface)' }} /><div><p className="text-[14px] font-medium">Luck lembra de vocês</p><p className="text-[12px]" style={{ color: muted }}>Memória das conversas</p></div></div>
      <div className="mt-4 flex flex-col gap-2 text-[12.5px]">
        {[['📚', 'Está lendo The Hound of the Baskervilles'], ['🎯', 'Quer treinar para uma entrevista'], ['🔁', 'Confunde “since” e “for”']].map(([e, t]) => <p key={t} className="flex gap-2 rounded-lg px-3 py-2" style={{ background: '#F3F4F6' }}><span>{e}</span>{t}</p>)}
      </div>
    </UiCard>
  )
}

/* ---------------------------------------------------------------- Meta e sequência */

export function VGoal() {
  return (
    <UiCard className="w-[360px] p-5">
      <div className="flex items-center gap-4">
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r="26" fill="none" stroke="#EEF0F4" strokeWidth="6" />
          <motion.circle cx="32" cy="32" r="26" fill="none" stroke="#15171C" strokeWidth="6" strokeLinecap="round" transform="rotate(-90 32 32)"
            strokeDasharray={2 * Math.PI * 26} initial={{ strokeDashoffset: 2 * Math.PI * 26 }} whileInView={{ strokeDashoffset: 2 * Math.PI * 26 * 0.2 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: EASE }} />
        </svg>
        <div><p className="text-[12px]" style={{ color: muted }}>Meta de hoje</p><p className="text-[22px] font-semibold">12 <span className="text-[13px] font-normal" style={{ color: muted }}>/ 15 min</span></p></div>
      </div>
      <div className="mt-4 flex justify-between">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 text-[11px]" style={{ color: muted }}>
            <span className="w-8 h-8 rounded-full grid place-items-center" style={i < 6 ? { background: '#15171C', color: '#fff' } : { background: '#EEF0F4' }}>{i < 6 ? <Flame size={13} /> : ''}</span>{d}
          </div>
        ))}
      </div>
      <p className="text-[12.5px] mt-4 flex items-center gap-1.5"><Flame size={13} /><b className="font-semibold">12 dias</b> seguidos · 2.480 pontos</p>
    </UiCard>
  )
}

/* ---------------------------------------------------------------- Estatísticas */

export function VStats() {
  const cells = Array.from({ length: 26 * 7 }, (_, i) => { const r = Math.sin(i * 12.9898) * 43758.5453; const f = r - Math.floor(r); const w = Math.floor(i / 7); return f < (w > 16 ? 0.8 : 0.45) ? Math.ceil(f * 4.9) : 0 })
  const tone = ['#EEF0F4', '#C9CDD6', '#9AA0AD', '#5C6370', '#15171C']
  return (
    <UiCard className="w-[400px] p-5">
      <div className="flex justify-between text-[12px]"><span className="font-medium">284 atividades no último ano</span><span style={{ color: muted }}>42h de estudo</span></div>
      <div className="mt-3 grid grid-flow-col grid-rows-7 gap-[3px] justify-start">{cells.map((v, i) => <span key={i} className="w-[11px] h-[11px] rounded-[2.5px]" style={{ background: tone[Math.min(4, v)] }} />)}</div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-[12px]">
        {[['Palavras', '186'], ['Aprendidas', '162'], ['Recorde', '31 dias']].map(([l, v]) => <div key={l} className="rounded-lg p-2.5" style={{ background: '#F3F4F6' }}><p style={{ color: muted }}>{l}</p><p className="text-[16px] font-semibold">{v}</p></div>)}
      </div>
    </UiCard>
  )
}

/* ---------------------------------------------------------------- Importar */

export function VImport() {
  return (
    <div className="w-[360px] flex flex-col items-center gap-3" style={ui}>
      <UiCard className="w-full p-6 flex flex-col items-center text-center" float={false}>
        <span className="w-12 h-12 rounded-2xl grid place-items-center" style={{ background: '#F3F4F6' }}><Upload size={20} /></span>
        <p className="text-[14px] font-medium mt-3">Arraste seu EPUB ou PDF</p>
        <p className="text-[12px] mt-1" style={{ color: muted }}>Seus livros ficam só na sua conta</p>
      </UiCard>
      {[['O Pequeno Príncipe (EN).epub', '100%'], ['Artigo da faculdade.pdf', '68%']].map(([n, p], i) => (
        <UiCard key={n} className="w-full px-4 py-3 flex items-center gap-3" delay={0.15 + i * 0.1} float={false}>
          <FileText size={16} /><span className="flex-1 text-[12.5px] truncate">{n}</span>
          <div className="w-20 h-1.5 rounded-full" style={{ background: '#EEF0F4' }}><motion.div className="h-full rounded-full bg-[#15171C]" initial={{ width: 0 }} whileInView={{ width: p }} viewport={{ once: true }} transition={{ duration: 1.4, ease: EASE, delay: 0.3 + i * 0.2 }} /></div>
        </UiCard>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- Livro de presente */

export function VGift() {
  return (
    <div className="relative w-[340px] h-[230px]" style={ui}>
      <motion.div className="absolute left-0 top-6 w-[220px] h-[150px] rounded-2xl p-5 text-white" style={{ background: '#191919', boxShadow: '0 30px 50px -24px rgba(0,0,0,.55)' }}
        initial={{ rotate: -10, opacity: 0, y: 20 }} whileInView={{ rotate: -6, opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE }}>
        <Gift size={18} /><p className="text-[18px] mt-6" style={display}>Um livro, para sempre.</p><p className="text-[11px] opacity-70 mt-1">Presente do plano Grátis</p>
      </motion.div>
      <motion.img src={coverSrc('the-secret-garden')} alt="" className="absolute right-6 top-0 w-[128px] rounded-md" style={{ boxShadow: '0 26px 40px -18px rgba(60,30,10,.55)' }}
        initial={{ rotate: 12, opacity: 0, y: 20 }} whileInView={{ rotate: 6, opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE, delay: 0.15 }} />
    </div>
  )
}

/* ---------------------------------------------------------------- No celular */

export function VPhone() {
  return (
    <div className="w-[230px] h-[440px] rounded-[38px] p-2.5" style={{ background: '#15171C', boxShadow: '0 40px 70px -30px rgba(40,20,10,.55)' }}>
      <div className="w-full h-full rounded-[30px] overflow-hidden bg-white relative" style={ui}>
        <div className="px-4 pt-7">
          <p className="text-[10px]" style={{ color: muted }}>Boa tarde,</p>
          <p className="text-[20px] leading-tight" style={display}>Marina</p>
          <div className="mt-3 flex gap-2.5 rounded-xl p-2.5" style={{ background: '#F3F4F6' }}>
            <img src={coverSrc('short-fiction')} alt="" className="w-11 rounded" />
            <div className="flex-1"><p className="text-[11px] font-medium">Short Fiction</p><div className="h-1 rounded-full mt-2" style={{ background: '#E3E6EB' }}><div className="h-full w-1/3 rounded-full bg-[#15171C]" /></div><p className="text-[9.5px] mt-1.5" style={{ color: muted }}>34% · Continuar</p></div>
          </div>
          <p className="text-[11px] font-medium mt-4 mb-2">Sua biblioteca</p>
          <div className="grid grid-cols-3 gap-1.5">{['alices-adventures-in-wonderland', 'the-secret-garden', 'pride-and-prejudice', 'treasure-island', 'little-women', 'dracula'].map(s => <img key={s} src={coverSrc(s)} alt="" className="w-full aspect-[2/3] object-cover rounded" />)}</div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-12 flex justify-around items-center border-t" style={{ borderColor: '#EEF0F3', color: muted }}>{[BookOpen, Headphones, Star, Smartphone].map((I, i) => <I key={i} size={15} style={i === 0 ? { color: '#15171C' } : undefined} />)}</div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Prova: barra da prova */

export function VExamBar() {
  return (
    <UiCard className="w-[460px] p-4">
      <div className="flex items-center gap-3 text-[12.5px]">
        <span className="font-semibold">Reading</span><span style={{ color: muted }}>Parte 1 de 2</span>
        <span className="ml-auto flex items-center gap-1" style={{ color: G.fg }}><Check size={12} />Salvo</span>
        <span className="flex items-center gap-1 px-2 py-1 rounded-md font-semibold tabular-nums" style={{ background: A.bg, color: A.fg }}><Clock size={12} />00:52</span>
      </div>
      <div className="mt-3 h-1 rounded-full" style={{ background: '#EEF0F4' }}><div className="h-full w-[62%] rounded-full bg-[#15171C]" /></div>
      <p className="text-[11px] tracking-[.1em] mt-5" style={{ color: muted }}>COMPLETE THE WORDS</p>
      <p className="text-[16px] leading-[1.9] mt-1.5" style={serif}>
        The library is one of the most impor<span className="inline-block w-12 border-b-2 mx-0.5 align-baseline" style={{ borderColor: '#15171C' }}>tant</span> places in a commu<span className="inline-block w-10 border-b-2 mx-0.5" style={{ borderColor: '#C9CDD6' }} /> …
      </p>
    </UiCard>
  )
}

/* ---------------------------------------------------------------- Prova: módulo adaptativo */

export function VAdaptive() {
  return (
    <div className="w-[440px] flex flex-col items-center gap-3" style={ui}>
      <UiCard className="px-5 py-3.5 text-center" float={false}><p className="text-[11px] tracking-[.1em]" style={{ color: muted }}>PARTE 1 · ROUTER</p><p className="text-[15px] font-medium mt-0.5">21 itens · acerto de 68%</p></UiCard>
      <svg width="260" height="46" viewBox="0 0 260 46" aria-hidden><path d="M130 0 V16 M130 16 C130 30 50 26 50 46 M130 16 C130 30 210 26 210 46" fill="none" stroke="#15171C" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="4 4" /></svg>
      <div className="grid grid-cols-2 gap-4 w-full">
        <UiCard className="p-4 text-center opacity-50" float={false}><p className="text-[13px] font-medium">Módulo fácil</p><p className="text-[11.5px]" style={{ color: muted }}>até a faixa 4</p></UiCard>
        <UiCard className="p-4 text-center" float={false} style={{ boxShadow: '0 0 0 2px #15171C, 0 24px 48px -20px rgba(80,40,20,.35)' }}><p className="text-[13px] font-medium">Módulo difícil</p><p className="text-[11.5px]" style={{ color: muted }}>acertou 60% ou mais</p></UiCard>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Prova: rubrica */

export function VRubric() {
  return (
    <UiCard className="w-[400px] p-5">
      <div className="flex items-center justify-between"><p className="text-[14px] font-medium flex items-center gap-1.5"><Pencil size={14} />Write an Email</p><span className="text-[13px] font-semibold px-2 py-0.5 rounded-md" style={{ background: G.bg, color: G.fg }}>4 / 5</span></div>
      <div className="mt-3 flex flex-col gap-1.5 text-[12.5px]">
        {[['Cumpre os 3 pontos pedidos', true], ['Tom adequado ao destinatário', true], ['Variedade de conectores', false]].map(([t, ok]) => <p key={t as string} className="flex items-center gap-2"><span className="w-4 h-4 rounded grid place-items-center" style={{ background: ok ? G.bg : Rr.bg, color: ok ? G.fg : Rr.fg }}>{ok ? <Check size={10} /> : '–'}</span>{t as string}</p>)}
      </div>
      <p className="text-[12.5px] mt-4 rounded-xl p-3 leading-relaxed" style={{ background: '#F3F4F6', color: '#3b3f47' }}>“Você usou <i>however</i> e <i>so</i> com precisão. Para subir, varie com <i>although</i> e <i>as a result</i>.”</p>
    </UiCard>
  )
}

/* ---------------------------------------------------------------- Prova: escala */

export function VScale() {
  const bands: [string, string][] = [['1', 'A1'], ['2', 'A2'], ['3', 'B1'], ['4', 'B2'], ['5', 'C1'], ['6', 'C2']]
  return (
    <UiCard className="w-[440px] p-5">
      <p className="text-[11px] tracking-[.1em]" style={{ color: muted }}>FAIXA → NÍVEL CEFR</p>
      <div className="mt-4 grid grid-cols-6 gap-1.5">
        {bands.map(([b, c], i) => (
          <div key={b} className="rounded-xl py-3 text-center" style={i === 3 ? { background: '#15171C', color: '#fff' } : { background: '#F3F4F6' }}>
            <p className="text-[20px]" style={display}>{b}</p><p className="text-[11px] font-semibold mt-0.5 opacity-80">{c}</p>
          </div>
        ))}
      </div>
      <p className="text-[11.5px] mt-3" style={{ color: muted }}>Meios pontos entre as faixas. Aproximação interna, sem equivalência oficial.</p>
    </UiCard>
  )
}
