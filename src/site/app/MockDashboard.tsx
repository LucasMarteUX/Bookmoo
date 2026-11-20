// Home do app reconstruída (mesma estrutura do Dashboard): saudação, continuar lendo, meta do dia, tutores, prática e estante.
import { motion, type MotionValue } from 'motion/react'
import { AudioLines, BookOpen, Clock, Flame, Plus, Search, Star, BookMarked, ArrowRight, MessageCircle, ChevronDown } from 'lucide-react'
import { COVERS, coverSrc } from '../covers'
import { TUTORS, tutorImg, tutorAvatar } from '../content'

const SHELF = ['short-fiction', 'alices-adventures-in-wonderland', 'the-secret-garden', 'the-wonderful-wizard-of-oz', 'the-adventures-of-sherlock-holmes',
  'pride-and-prejudice', 'treasure-island', 'the-little-mermaid', 'a-christmas-carol', 'anne-of-green-gables']
const PROGRESS: Record<string, number> = { 'short-fiction': 34, 'alices-adventures-in-wonderland': 12, 'the-secret-garden': 100, 'the-adventures-of-sherlock-holmes': 58, 'pride-and-prejudice': 7 }

function today() {
  const d = new Date()
  const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const h = d.getHours()
  return { date: s.replace(/(^|[\s-])(\S)/g, (_m, a, b) => a + b.toUpperCase()), hello: h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite' }
}

export function MockDashboard({ scroll, dark }: { scroll?: MotionValue<number>; dark: boolean }) {
  const { date, hello } = today()
  return (
    <div className="flex-1 min-w-0 relative overflow-hidden">
      <motion.div data-dash-content style={{ y: scroll }} className="px-10 pt-7 pb-16 flex flex-col gap-7">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[12.5px]" style={{ color: 'var(--t-muted)' }}>{date}</p>
            <h1 className="mk-display text-[38px] leading-tight mt-0.5">{hello}, Marina</h1>
          </div>
          <span className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium" style={{ border: '1px solid var(--t-border)' }}><Plus size={14} />Adicionar livro</span>
        </div>

        <div className="grid grid-cols-[1fr_320px] gap-4">
          <div className="rounded-2xl p-6 flex gap-6" style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)' }}>
            <img src={coverSrc('short-fiction')} alt="" className="w-[132px] h-[198px] rounded-md object-cover" style={{ boxShadow: '0 12px 28px -10px rgba(0,0,0,.5)' }} />
            <div className="flex-1 flex flex-col">
              <p className="text-[12.5px]" style={{ color: 'var(--t-muted)' }}>Continue de onde parou</p>
              <h2 className="mk-display text-[30px] leading-tight">Short Fiction</h2>
              <p className="text-[13px] mt-1" style={{ color: 'var(--t-muted)' }}>Beatrix Potter · A1</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--t-chip)' }}><div className="h-full w-[34%] rounded-full" style={{ background: 'var(--t-text)' }} /></div>
                <span className="text-[12px]" style={{ color: 'var(--t-muted)' }}>34%</span>
              </div>
              <p className="text-[12.5px] mt-2" style={{ color: 'var(--t-muted)' }}>Página 103 de 303 · “The Tale of Peter Rabbit”</p>
              <div className="mt-auto flex gap-2">
                <span className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13.5px] font-medium" style={{ background: 'var(--t-primary)', color: 'var(--t-primary-text)' }}><BookOpen size={15} />Continuar</span>
                <span className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13.5px]" style={{ background: 'var(--t-chip)' }}><AudioLines size={15} />Praticar fala</span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)' }}>
            <div className="flex items-center gap-4">
              <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
                <circle cx="28" cy="28" r="23" fill="none" stroke="var(--t-chip)" strokeWidth="5" />
                <circle cx="28" cy="28" r="23" fill="none" stroke="var(--t-text)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 23 * 0.8} 999`} transform="rotate(-90 28 28)" />
              </svg>
              <div>
                <p className="text-[12.5px]" style={{ color: 'var(--t-muted)' }}>Meta de hoje</p>
                <p className="text-[20px] font-semibold">12 <span className="text-[13px] font-normal" style={{ color: 'var(--t-muted)' }}>/ 15 min</span></p>
                <div className="flex gap-1 mt-1 text-[11.5px]">{['10 min', '15 min', '30 min'].map(m => <span key={m} className="px-2 py-0.5 rounded-md" style={m === '15 min' ? { background: 'var(--t-chip)' } : { color: 'var(--t-muted)' }}>{m}</span>)}</div>
              </div>
            </div>
            <div className="h-px" style={{ background: 'var(--t-border)' }} />
            <div className="grid grid-cols-2 gap-y-3 text-[12.5px]">
              {[[Flame, 'Sequência', '12', 'dias'], [Star, 'Pontos', '2.480', ''], [BookMarked, 'Palavras', '186', ''], [Clock, 'Tempo de estudo', '14h', '20m']].map(([I, l, v, u]) => {
                const Icon = I as typeof Flame
                return <div key={l as string}><p className="flex items-center gap-1.5" style={{ color: 'var(--t-muted)' }}><Icon size={13} />{l as string}</p><p className="text-[19px] font-semibold mt-0.5">{v as string} <span className="text-[12px] font-normal" style={{ color: 'var(--t-muted)' }}>{u as string}</span></p></div>
              })}
            </div>
          </div>
        </div>

        <div className="rounded-2xl relative overflow-hidden flex items-stretch h-[250px]" style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)' }}>
          <div className="w-[44%] p-7 flex flex-col justify-center gap-3">
            <p className="text-[12.5px] flex items-center gap-1.5" style={{ color: 'var(--t-muted)' }}><MessageCircle size={13} />Conversa com os tutores</p>
            <h3 className="mk-display text-[27px] leading-[1.12]">Pratique inglês conversando com Bia, Luck, Yuno e Yuri</h3>
            <p className="text-[13px]" style={{ color: 'var(--t-muted)' }}>Escolha um tutor e fale em voz alta. Eles respondem, corrigem com calma e lembram do que vocês conversaram.</p>
            <span className="self-start mt-1 h-9 px-4 rounded-lg text-[13.5px] font-medium grid place-items-center" style={{ background: 'var(--t-primary)', color: 'var(--t-primary-text)' }}>Começar a conversar</span>
          </div>
          <div className="flex-1 relative">
            {TUTORS.map((t, i) => (
              <img key={t.id} src={tutorImg(t.id)} alt="" className="absolute top-6 h-[260px] w-auto" style={{ left: `${[2, 22, 45, 64][i]}%`, zIndex: [2, 1, 2, 2][i] }} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-[15px] font-medium mb-3">Pratique hoje</h3>
          <div className="grid grid-cols-3 gap-4">
            {[['Revisar palavras', '18 esperando revisão', '/illustrations/reading.svg'], ['Falar em voz alta', 'Leia e receba retorno da pronúncia', '/illustrations/public-speaking.svg'], ['Ditado', 'Ouça e escreva cada palavra', '/illustrations/on-the-laptop.svg']].map(([t, d, img]) => (
              <div key={t} className="rounded-2xl p-5 h-[132px] relative overflow-hidden" style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)' }}>
                <p className="text-[14.5px] font-medium">{t}</p>
                <p className="text-[12.5px] mt-1 max-w-[60%]" style={{ color: 'var(--t-muted)' }}>{d}</p>
                <p className="absolute left-5 bottom-4 text-[12.5px] flex items-center gap-1">Começar <ArrowRight size={12} /></p>
                <img src={img} alt="" className="absolute -right-3 -bottom-4 h-[130px] opacity-90" style={{ filter: dark ? 'invert(1) brightness(.92)' : 'none', mixBlendMode: dark ? 'lighten' : 'multiply' }} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-medium">Sua biblioteca <span className="font-normal" style={{ color: 'var(--t-muted)' }}>{SHELF.length}</span></h3>
            <div className="flex items-center gap-2 text-[12.5px]">
              <div className="flex p-0.5 rounded-lg" style={{ background: 'var(--t-chip)' }}>{['Todos', 'Lendo', 'Não iniciados', 'Concluídos'].map((f, i) => <span key={f} className="px-2.5 py-1 rounded-md" style={i === 0 ? { background: 'var(--t-card)', fontWeight: 500 } : { color: 'var(--t-muted)' }}>{f}</span>)}</div>
              <span className="flex items-center gap-1.5 h-8 px-2.5 w-[150px] rounded-lg" style={{ border: '1px solid var(--t-border)', color: 'var(--t-muted)' }}><Search size={13} />Filtrar</span>
              <span className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg" style={{ border: '1px solid var(--t-border)' }}>Recentes<ChevronDown size={13} /></span>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-x-4 gap-y-6">
            {SHELF.map(slug => {
              const c = COVERS.find(x => x.slug === slug)!
              const p = PROGRESS[slug] ?? 0
              return (
                <div key={slug}>
                  <div className="relative aspect-[2/3] rounded-md overflow-hidden" style={{ boxShadow: '0 10px 24px -12px rgba(0,0,0,.55)' }}>
                    <img src={coverSrc(slug)} alt="" className="w-full h-full object-cover" />
                    {p > 0 && <div className="absolute left-0 right-0 bottom-0 h-1" style={{ background: 'rgba(0,0,0,.35)' }}><div className="h-full" style={{ width: `${p}%`, background: '#fff' }} /></div>}
                  </div>
                  <p className="text-[13px] font-medium mt-2 truncate">{c.title}</p>
                  <p className="text-[11.5px] truncate" style={{ color: 'var(--t-muted)' }}>🇺🇸 {c.author} · {p === 100 ? 'Concluído' : `${p}%`}</p>
                </div>
              )
            })}
          </div>
        </div>
      </motion.div>
      <img src={tutorAvatar('bia')} alt="" className="absolute right-6 bottom-6 w-12 h-12 rounded-full object-cover" style={{ background: '#F2D5C8', boxShadow: '0 0 0 3px var(--t-bg), 0 8px 20px rgba(0,0,0,.3)' }} />
      <span className="absolute right-6 bottom-6 w-3 h-3 rounded-full" style={{ background: '#3AC77A', boxShadow: '0 0 0 2px var(--t-bg)' }} />
    </div>
  )
}
