// Mais telas do app reconstruídas: Galeria, Falar, Ditado, Estatísticas, Prova de proficiência e Comunidade.
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useInView } from 'motion/react'
import { Award, BookOpen, Calendar, Check, ChevronDown, Clock, Flame, Headphones, Heart, MessageCircle, Mic, PenLine, Play, Search, Share2, Sparkles, Star, Trophy, Volume2, ImageIcon } from 'lucide-react'
import { COVERS, coverSrc } from '../covers'

const card = { background: 'var(--t-card)', border: '1px solid var(--t-border)' } as const
const chip = (k: 'g' | 'a' | 'l' | 'r' | 'b') => ({ background: `var(--${k}-bg)`, color: `var(--${k}-fg)` })

function PageHead({ title, sub, right }: { title: string; sub: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between">
      <div><h1 className="mk-display text-[38px] leading-tight">{title}</h1><p className="text-[13px]" style={{ color: 'var(--t-muted)' }}>{sub}</p></div>
      {right}
    </div>
  )
}

/* ---------------------------------------------------------------- Galeria */

const CATS = [['adventure', 'Aventura', 14], ['classic', 'Clássico', 31], ['short', 'Contos', 9], ['fantasy', 'Fantasia', 22], ['children', 'Infantil', 38], ['mystery', 'Mistério', 24], ['poetry', 'Poesia', 4]] as const

export function MockGallery({ step = 0 }: { step?: number }) {
  const starters = COVERS.filter(c => c.level === 'A1' || c.level === 'A2').slice(0, 7)
  const mystery = COVERS.filter(c => c.category === 'Mistério').slice(0, 7)
  return (
    <div className="flex-1 min-w-0 overflow-hidden relative">
      <motion.div animate={{ y: step === 0 ? 0 : step === 1 ? -330 : -560 }} transition={{ type: 'spring', stiffness: 80, damping: 20 }} className="px-10 pt-7 flex flex-col gap-6">
        <PageHead title="Galeria" sub="Clássicos escolhidos pelo nível, para ler e estudar no Upoonly."
          right={<span className="flex items-center gap-2 h-10 w-[280px] px-4 rounded-full text-[13px]" style={{ background: 'var(--t-chip)', color: 'var(--t-muted)' }}><Search size={14} />Buscar título, autor ou tema</span>} />
        <div className="rounded-3xl p-9 flex gap-10 items-center" style={card}>
          <div className="flex-1">
            <p className="text-[11.5px] tracking-[.1em] flex items-center gap-1.5" style={{ color: 'var(--t-muted)' }}><Sparkles size={12} />DESTAQUE DA GALERIA</p>
            <h2 className="mk-display text-[46px] leading-[1.05] mt-3">Alice’s Adventures in Wonderland</h2>
            <p className="text-[14px] mt-2" style={{ color: 'var(--t-muted)' }}>Lewis Carroll</p>
            <div className="flex gap-2 mt-4 text-[12px]"><span className="px-2.5 py-1 rounded-md font-medium" style={chip('a')}>B2 · Intermediário superior</span><span className="px-2.5 py-1 rounded-md" style={{ background: 'var(--t-chip)' }}>Clássico</span><span className="px-2.5 py-1 rounded-md flex items-center gap-1" style={{ background: 'var(--t-chip)' }}><ImageIcon size={11} />Ilustrado</span></div>
            <p className="text-[14px] leading-relaxed mt-4 max-w-[520px]" style={{ color: 'var(--t-muted)' }}>Alice segue um coelho apressado e cai num mundo onde nada faz sentido. Um clássico cheio de jogos de palavras, ótimo para quem já lê com alguma confiança.</p>
            <span className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-[13.5px] font-medium mt-6" style={{ background: 'var(--t-primary)', color: 'var(--t-primary-text)' }}><BookOpen size={15} />Conhecer o livro</span>
          </div>
          <img src={coverSrc('alices-adventures-in-wonderland')} alt="" className="w-[230px] rounded-lg" style={{ boxShadow: '0 30px 50px -20px rgba(0,0,0,.45)', transform: 'rotate(2deg)' }} />
        </div>
        <div className="grid grid-cols-7 gap-3">
          {CATS.map(([id, name, n]) => (
            <div key={id} className="rounded-2xl overflow-hidden relative aspect-[1/1.05]" style={{ background: 'var(--t-chip)' }}>
              <img src={`/categories/${id}.webp`} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ mixBlendMode: 'multiply' }} />
              <div className="absolute left-2.5 right-2.5 bottom-2 flex justify-between text-[12px] font-medium"><span>{name}</span><span style={{ color: 'var(--t-muted)' }}>{n}</span></div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[12.5px]">
          <div className="flex p-0.5 rounded-lg" style={{ background: 'var(--t-chip)' }}>{['Todos', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l, i) => <span key={l} className="px-2.5 py-1 rounded-md" style={i === (step === 1 ? 1 : 0) ? { background: 'var(--t-card)', fontWeight: 600 } : { color: 'var(--t-muted)' }}>{l}</span>)}</div>
          {['Categoria', 'Em destaque', 'Autor'].map(f => <span key={f} className="flex items-center gap-6 h-8 px-3 rounded-lg" style={{ border: '1px solid var(--t-border)' }}>{f}<ChevronDown size={13} /></span>)}
          <span className="flex items-center gap-1 h-8 px-3 rounded-lg" style={{ border: '1px solid var(--t-border)' }}><Star size={12} fill="#F5B83D" stroke="#F5B83D" />4+</span>
        </div>
        {[['Para começar', 'Textos A1 e A2', starters], ['Mistério e suspense', 'Sherlock, Poe, Stevenson e mais', mystery]].map(([t, d, list]) => (
          <div key={t as string}>
            <div className="flex items-end justify-between mb-3"><div><p className="mk-display text-[24px]">{t as string}</p><p className="text-[12.5px]" style={{ color: 'var(--t-muted)' }}>{d as string}</p></div><span className="text-[12.5px]">Ver todos →</span></div>
            <div className="grid grid-cols-7 gap-4">
              {(list as typeof COVERS).map(c => (
                <div key={c.slug}>
                  <div className="relative"><img src={coverSrc(c.slug)} alt="" className="w-full aspect-[2/3] object-cover rounded-md" style={{ boxShadow: '0 12px 24px -14px rgba(0,0,0,.5)' }} />
                    <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/90 text-[#15171C]">{c.level}</span></div>
                  <p className="text-[12.5px] font-medium mt-2 truncate">{c.title}</p><p className="text-[11px] truncate" style={{ color: 'var(--t-muted)' }}>{c.author}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

/* ---------------------------------------------------------------- Falar */

const SPOKEN: [string, 'ok' | 'near' | 'bad' | 'skip'][] = [
  ['Once', 'ok'], ['upon', 'ok'], ['a', 'ok'], ['time', 'ok'], ['there', 'ok'], ['were', 'near'], ['four', 'ok'], ['little', 'ok'], ['Rabbits,', 'ok'], ['and', 'ok'], ['their', 'near'], ['names', 'ok'], ['were', 'ok'],
  ['Flopsy,', 'ok'], ['Mopsy,', 'bad'], ['Cottontail,', 'ok'], ['and', 'skip'], ['Peter.', 'ok'], ['They', 'ok'], ['lived', 'ok'], ['with', 'ok'], ['their', 'ok'], ['Mother', 'ok'], ['in', 'ok'], ['a', 'ok'], ['sandbank,', 'near'],
  ['underneath', 'ok'], ['the', 'ok'], ['root', 'ok'], ['of', 'ok'], ['a', 'ok'], ['very', 'ok'], ['big', 'ok'], ['fir-tree.', 'bad'],
]
const MARK = { ok: 'g', near: 'a', bad: 'r', skip: null } as const

export function MockSpeak() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.3 })
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!inView) return
    setN(0)
    const t = window.setInterval(() => setN(v => (v >= SPOKEN.length + 8 ? 0 : v + 1)), 230)
    return () => window.clearInterval(t)
  }, [inView])
  const done = Math.min(n, SPOKEN.length)
  const ok = SPOKEN.slice(0, done).filter(([, s]) => s === 'ok').length
  return (
    <div ref={ref} className="flex-1 min-w-0 px-[120px] pt-8 overflow-hidden">
      <div className="flex items-center gap-1 text-[13px] mb-6">
        {[[BookOpen, 'Ler'], [PenLine, 'Escrever'], [Headphones, 'Escutar'], [Mic, 'Falar']].map(([I, l], k) => { const Icon = I as typeof BookOpen; return <span key={l as string} className="flex items-center gap-1.5 h-8 px-3 rounded-md" style={k === 3 ? { background: 'var(--t-chip)', fontWeight: 500 } : { color: 'var(--t-muted)' }}><Icon size={14} />{l as string}</span> })}
      </div>
      <div className="grid grid-cols-[1fr_300px] gap-6">
        <div className="rounded-2xl p-8" style={card}>
          <p className="text-[12px] tracking-[.08em]" style={{ color: 'var(--t-muted)' }}>LEIA EM VOZ ALTA · PÁGINA 1</p>
          <p className="mk-serif text-[23px] leading-[1.75] mt-4">
            {SPOKEN.map(([w, s], i) => {
              const k = MARK[s]
              const shown = i < done
              return <span key={i}><span className="rounded-[5px] px-[3px] -mx-[3px] transition-all duration-200" style={!shown ? { color: 'var(--t-muted)', opacity: 0.55 } : k ? { ...chip(k) } : { textDecoration: 'line-through', color: 'var(--t-muted)' }}>{w}</span>{' '}</span>
            })}
          </p>
          <div className="mt-8 flex items-center gap-4">
            <span className="relative w-16 h-16 rounded-full grid place-items-center" style={{ background: 'var(--t-primary)', color: 'var(--t-primary-text)' }}>
              {done < SPOKEN.length && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: 'var(--t-primary)', opacity: 0.15 }} />}
              <Mic size={24} />
            </span>
            <div className="flex items-end gap-[3px] h-10">{Array.from({ length: 34 }, (_, i) => <motion.span key={i} className="w-[4px] rounded-full" style={{ background: 'var(--t-text)', opacity: 0.6 }} animate={{ height: done < SPOKEN.length ? [6, 10 + ((i * 37) % 26), 8] : 4 }} transition={{ duration: 0.6, repeat: Infinity, repeatType: 'mirror', delay: (i % 7) * 0.06 }} />)}</div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-6" style={card}>
            <p className="text-[12.5px]" style={{ color: 'var(--t-muted)' }}>Acerto nesta leitura</p>
            <p className="text-[52px] font-semibold leading-none mt-2 tabular-nums">{done ? Math.round((ok / done) * 100) : 0}<span className="text-[22px]">%</span></p>
            <div className="mt-5 flex flex-col gap-2 text-[13px]">
              {([['g', 'Certo'], ['a', 'Quase'], ['r', 'Errado']] as const).map(([k, l]) => <p key={l} className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: `var(--${k}-bg)`, boxShadow: `inset 0 0 0 1px var(--${k}-fg)` }} />{l}</p>)}
              <p className="flex items-center gap-2"><span className="w-3 h-3 rounded border" style={{ borderColor: 'var(--t-muted)' }} /><span className="line-through" style={{ color: 'var(--t-muted)' }}>Pulou</span></p>
            </div>
          </div>
          <div className="rounded-2xl p-5 text-[13px] leading-relaxed" style={card}>
            <p className="font-medium flex items-center gap-1.5"><Volume2 size={14} />Ouça de novo</p>
            <p className="mt-1" style={{ color: 'var(--t-muted)' }}>“Mopsy” e “fir-tree”: toque para ouvir a pronúncia e tentar outra vez.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Ditado */

const DICT: [string, string | null][] = [['Peter', null], ['was', null], ['most', null], ['dreadfully', 'dredfully'], ['frightened;', null], ['he', null], ['rushed', 'rushd'], ['all', null], ['over', null], ['the', null], ['garden.', null]]

export function MockDictation() {
  return (
    <div className="flex-1 min-w-0 px-[120px] pt-8 overflow-hidden">
      <div className="flex items-center gap-1 text-[13px] mb-6">
        {[[BookOpen, 'Ler'], [PenLine, 'Escrever'], [Headphones, 'Escutar'], [Mic, 'Falar']].map(([I, l], k) => { const Icon = I as typeof BookOpen; return <span key={l as string} className="flex items-center gap-1.5 h-8 px-3 rounded-md" style={k === 1 ? { background: 'var(--t-chip)', fontWeight: 500 } : { color: 'var(--t-muted)' }}><Icon size={14} />{l as string}</span> })}
      </div>
      <div className="grid grid-cols-[1fr_300px] gap-6">
        <div className="rounded-2xl p-8" style={card}>
          <p className="text-[12px] tracking-[.08em]" style={{ color: 'var(--t-muted)' }}>TREINO DE DITADO · FRASE 4 DE 9</p>
          <div className="mt-5 flex items-center gap-3">
            <span className="w-12 h-12 rounded-full grid place-items-center" style={{ background: 'var(--t-primary)', color: 'var(--t-primary-text)' }}><Play size={18} /></span>
            <span className="h-9 px-3 rounded-lg grid place-items-center text-[13px]" style={{ background: 'var(--t-chip)' }}>0,6× devagar</span>
            <span className="h-9 px-3 rounded-lg grid place-items-center text-[13px]" style={{ background: 'var(--t-chip)' }}>Repetir</span>
          </div>
          <div className="mt-6 rounded-xl px-5 py-4 text-[20px] mk-serif" style={{ background: 'var(--t-bg2)' }}>peter was most dredfully frightened; he rushd all over the garden<span className="inline-block w-[2px] h-6 align-middle ml-0.5 animate-pulse" style={{ background: 'var(--t-text)' }} /></div>
          <p className="text-[12.5px] mt-6 mb-2" style={{ color: 'var(--t-muted)' }}>Correção</p>
          <p className="mk-serif text-[21px] leading-[1.9]">
            {DICT.map(([w, wrong], i) => (
              <span key={i}>{wrong ? <span className="relative inline-block"><span className="absolute -top-[16px] left-0 text-[12px] line-through font-sans" style={{ color: 'var(--r-fg)' }}>{wrong}</span><span className="rounded px-1" style={chip('g')}>{w}</span></span> : w}{' '}</span>
            ))}
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-6" style={card}>
            <p className="text-[12.5px]" style={{ color: 'var(--t-muted)' }}>Nota da página</p>
            <p className="text-[52px] font-semibold leading-none mt-2">8,2</p>
            <div className="mt-4 grid grid-cols-9 gap-1">{[10, 9, 7, 8, 10, 6, 9, 8, 7].map((v, i) => <div key={i} className="h-14 rounded flex items-end" style={{ background: 'var(--t-chip)' }}><div className="w-full rounded" style={{ height: `${v * 10}%`, background: i === 3 ? 'var(--t-text)' : 'var(--t-muted)', opacity: i === 3 ? 1 : 0.5 }} /></div>)}</div>
          </div>
          <div className="rounded-2xl p-5" style={card}>
            <p className="text-[13px] font-medium">Palavras que mais escapam</p>
            <div className="flex flex-wrap gap-1.5 mt-3 text-[12.5px]">{['dreadfully', 'rushed', 'through', 'thought', 'caught'].map(w => <span key={w} className="px-2 py-1 rounded-md" style={chip('a')}>{w}</span>)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Estatísticas */

export function MockStats() {
  const cells = useMemo(() => Array.from({ length: 52 * 7 }, (_, i) => {
    const w = Math.floor(i / 7)
    const r = Math.sin(i * 12.9898) * 43758.5453
    const f = r - Math.floor(r)
    const base = w > 30 ? 0.75 : w > 18 ? 0.5 : 0.25
    return f < base ? Math.min(4, Math.ceil(f / base * 4)) : 0
  }), [])
  const tone = ['var(--t-chip)', 'color-mix(in srgb, var(--t-text) 22%, var(--t-chip))', 'color-mix(in srgb, var(--t-text) 45%, var(--t-chip))', 'color-mix(in srgb, var(--t-text) 70%, var(--t-chip))', 'var(--t-text)']
  return (
    <div className="flex-1 min-w-0 px-10 pt-7 overflow-hidden">
      <PageHead title="Estatísticas" sub="Seu ritmo de estudo, palavras e prática, tudo num só lugar." />
      <div className="grid grid-cols-4 gap-3 mt-6">
        {[[Clock, 'Tempo total de estudo', '42h 15m', ''], [BookOpen, 'Vocabulário total', '186', ''], [Check, 'Aprendidas', '162', ''], [Flame, 'Sequência atual', '12 dias', 'Recorde: 31 dias']].map(([I, l, v, d]) => {
          const Icon = I as typeof Clock
          return <div key={l as string} className="rounded-2xl p-5" style={card}><p className="text-[12.5px] flex items-center gap-1.5" style={{ color: 'var(--t-muted)' }}><Icon size={13} />{l as string}</p><p className="text-[26px] font-semibold mt-1">{v as string}</p>{d && <p className="text-[11.5px]" style={{ color: 'var(--t-muted)' }}>{d as string}</p>}</div>
        })}
      </div>
      <div className="rounded-2xl p-5 mt-4" style={card}>
        <p className="text-[14px] font-medium flex items-center gap-1.5"><Calendar size={14} />284 atividades no último ano</p>
        <div className="mt-4 grid grid-flow-col grid-rows-7 gap-[3px]">{cells.map((v, i) => <span key={i} className="w-[15px] h-[15px] rounded-[3px]" style={{ background: tone[v] }} />)}</div>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="rounded-2xl p-5" style={card}>
          <p className="text-[14px] font-medium">De onde vêm seus pontos</p>
          {[['Páginas lidas', 920], ['Falar', 640], ['Palavras aprendidas', 486], ['Ditado', 312], ['Desafios da página', 122]].map(([l, v]) => (
            <div key={l as string} className="grid grid-cols-[150px_1fr_40px] items-center gap-3 text-[12.5px] mt-2.5"><span>{l}</span><div className="h-1.5 rounded-full" style={{ background: 'var(--t-chip)' }}><div className="h-full rounded-full" style={{ width: `${(v as number) / 9.2}%`, background: 'var(--t-text)' }} /></div><span className="text-right tabular-nums">{v}</span></div>
          ))}
        </div>
        <div className="rounded-2xl p-5" style={card}>
          <p className="text-[14px] font-medium">Horários em que você estuda</p>
          <div className="flex items-end gap-1.5 h-[120px] mt-4">{[1, 0, 0, 0, 0, 0, 1, 3, 2, 1, 1, 2, 4, 2, 1, 1, 2, 3, 5, 7, 8, 6, 3, 1].map((v, i) => <div key={i} className="flex-1 rounded-t" style={{ height: `${v * 12 + 3}%`, background: v > 5 ? 'var(--t-text)' : 'var(--t-muted)', opacity: v > 5 ? 1 : 0.45 }} />)}</div>
          <div className="flex justify-between text-[11px] mt-1" style={{ color: 'var(--t-muted)' }}><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Prova */

export function MockProva() {
  return (
    <div className="flex-1 min-w-0 px-10 pt-7 overflow-hidden">
      <div className="rounded-3xl p-10 grid grid-cols-[1fr_400px] gap-10 items-center" style={card}>
        <div>
          <div className="flex items-center gap-2 text-[12px]"><span className="px-2.5 py-1 rounded-full flex items-center gap-1 font-medium" style={{ background: 'var(--t-primary)', color: 'var(--t-primary-text)' }}><Award size={12} />Plano Pro</span><span style={{ color: 'var(--t-muted)' }}>4 habilidades · 90 min</span></div>
          <h1 className="mk-display text-[60px] leading-[1] mt-5">English<br />Proficiency</h1>
          <p className="text-[14px] leading-relaxed mt-5 max-w-[460px]" style={{ color: 'var(--t-muted)' }}>Uma prova completa de leitura, compreensão auditiva, escrita e fala. No fim, um relatório detalhado, a estimativa do seu nível CEFR e um selo no seu perfil.</p>
          <div className="flex items-center gap-4 mt-7 text-[13.5px]"><span className="h-11 px-5 rounded-xl grid place-items-center font-medium" style={{ background: 'var(--t-primary)', color: 'var(--t-primary-text)' }}>→ Começar a prova</span><span className="flex items-center gap-1" style={{ color: 'var(--t-muted)' }}>Como funciona<ChevronDown size={14} /></span></div>
        </div>
        <div className="rounded-2xl p-6" style={{ background: 'var(--t-bg2)', border: '1px solid var(--t-border)' }}>
          <div className="flex justify-between text-[11px] tracking-[.08em]" style={{ color: 'var(--t-muted)' }}><span>RELATÓRIO DE RESULTADO</span><span>EXEMPLO</span></div>
          <div className="flex items-center gap-5 mt-4">
            <svg width="96" height="60" viewBox="0 0 96 60" aria-hidden><path d="M8 54 A40 40 0 0 1 88 54" fill="none" stroke="var(--t-chip)" strokeWidth="9" strokeLinecap="round" /><path d="M8 54 A40 40 0 0 1 78 28" fill="none" stroke="var(--t-text)" strokeWidth="9" strokeLinecap="round" /></svg>
            <div><p className="text-[12px]" style={{ color: 'var(--t-muted)' }}>Faixa geral</p><p className="text-[34px] font-semibold leading-none">4,0</p><span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md text-[12px] font-semibold" style={{ border: '1px solid var(--t-border)' }}><Award size={11} />B2</span></div>
          </div>
          {[['Reading', 4.5], ['Listening', 4], ['Writing', 3.5], ['Speaking', 4]].map(([l, v]) => (
            <div key={l as string} className="mt-3.5 text-[13px]"><div className="flex justify-between"><span>{l}</span><span>{String(v).replace('.', ',')}</span></div><div className="h-1.5 rounded-full mt-1.5" style={{ background: 'var(--t-chip)' }}><div className="h-full rounded-full" style={{ width: `${(v as number) / 6 * 100}%`, background: 'var(--t-text)' }} /></div></div>
          ))}
          <p className="mt-5 text-[12.5px] rounded-xl p-3 leading-relaxed" style={{ background: 'var(--t-card)' }}>“Você organiza bem as ideias no e-mail. Para subir, varie os conectores e desenvolva mais os exemplos.”</p>
        </div>
      </div>
      <p className="text-[11px] tracking-[.1em] mt-8" style={{ color: 'var(--t-muted)' }}>ESTRUTURA</p>
      <p className="mk-display text-[28px]">Quatro seções, uma depois da outra</p>
      <div className="grid grid-cols-4 gap-3 mt-4">
        {[[BookOpen, 'Reading', '50 itens · 30 min'], [Headphones, 'Listening', '47 itens · 29 min'], [PenLine, 'Writing', '12 itens · 23 min'], [Mic, 'Speaking', '11 itens · 8 min']].map(([I, t, d], k) => {
          const Icon = I as typeof BookOpen
          return <div key={t as string} className="rounded-2xl p-5" style={card}><div className="flex justify-between"><Icon size={18} /><span className="text-[12px]" style={{ color: 'var(--t-muted)' }}>0{k + 1}</span></div><p className="text-[16px] font-medium mt-4">{t as string}</p><p className="text-[12.5px]" style={{ color: 'var(--t-muted)' }}>{d as string}</p></div>
        })}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Comunidade */

const PEOPLE = [['Ana Lima', 'AL', '#E9D7C5'], ['Rafael Souza', 'RS', '#D5DFEA'], ['Júlia Prado', 'JP', '#E3F1E7'], ['Caio Mendes', 'CM', '#FBEEDB']] as const

export function MockCommunity() {
  return (
    <div className="flex-1 min-w-0 px-10 pt-7 overflow-hidden grid grid-cols-[1fr_300px] gap-8">
      <div>
        <PageHead title="Comunidade" sub="Momentos de leitura de quem estuda com você." />
        <div className="flex gap-5 text-[13.5px] mt-5" style={{ borderBottom: '1px solid var(--t-border)' }}>{['Para você', 'Seguindo', 'Momentos de leitura', 'Pessoas'].map((t, i) => <span key={t} className="pb-2.5" style={i === 0 ? { borderBottom: '2px solid var(--t-text)', fontWeight: 500 } : { color: 'var(--t-muted)' }}>{t}</span>)}</div>
        <div className="rounded-2xl p-4 mt-5 flex items-center gap-3 text-[13.5px]" style={card}><span className="w-9 h-9 rounded-full grid place-items-center text-[13px] font-medium" style={{ background: '#E9D7C5', color: '#5A3A1F' }}>M</span><span style={{ color: 'var(--t-muted)' }}>Compartilhe um momento da sua leitura…</span></div>
        {[
          { p: PEOPLE[0], when: 'há 2 h', text: 'Terminei o primeiro capítulo de Pride and Prejudice sem traduzir nenhuma frase inteira. A Bia me ajudou com “amiable” 😍', book: 'pride-and-prejudice', likes: 48, comments: 12 },
          { p: PEOPLE[1], when: 'há 5 h', text: '“Elementary, my dear Watson” não aparece em nenhum livro do Sherlock. Descobri lendo aqui. Alguém mais lendo The Hound of the Baskervilles?', book: 'the-hound-of-the-baskervilles', likes: 31, comments: 9 },
        ].map(post => (
          <div key={post.p[0]} className="rounded-2xl p-5 mt-4" style={card}>
            <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-full grid place-items-center text-[13px] font-semibold" style={{ background: post.p[2], color: '#2b261c' }}>{post.p[1]}</span><div><p className="text-[14px] font-medium">{post.p[0]}</p><p className="text-[12px]" style={{ color: 'var(--t-muted)' }}>{post.when} · Momento de leitura</p></div></div>
            <p className="text-[14.5px] leading-relaxed mt-3">{post.text}</p>
            <div className="mt-3 rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--t-bg2)' }}><img src={coverSrc(post.book)} alt="" className="w-10 rounded" /><div className="text-[12.5px]"><p className="font-medium">{COVERS.find(c => c.slug === post.book)?.title}</p><p style={{ color: 'var(--t-muted)' }}>{COVERS.find(c => c.slug === post.book)?.author}</p></div></div>
            <div className="flex gap-5 mt-3 text-[12.5px]" style={{ color: 'var(--t-muted)' }}><span className="flex items-center gap-1.5"><Heart size={14} />{post.likes}</span><span className="flex items-center gap-1.5"><MessageCircle size={14} />{post.comments}</span><span className="flex items-center gap-1.5"><Share2 size={14} />Compartilhar</span></div>
          </div>
        ))}
      </div>
      <div className="pt-[86px] flex flex-col gap-4">
        <div className="rounded-2xl p-5" style={card}>
          <p className="text-[14px] font-medium flex items-center gap-1.5"><Trophy size={14} />Leitores da semana</p>
          {PEOPLE.map(([n, i, c], k) => <div key={n} className="flex items-center gap-3 mt-3 text-[13px]"><span className="w-4 text-[12px]" style={{ color: 'var(--t-muted)' }}>{k + 1}</span><span className="w-8 h-8 rounded-full grid place-items-center text-[11.5px] font-semibold" style={{ background: c, color: '#2b261c' }}>{i}</span><span className="flex-1">{n}</span><span style={{ color: 'var(--t-muted)' }}>{[1240, 980, 860, 715][k]} pts</span></div>)}
        </div>
        <div className="rounded-2xl p-5" style={card}>
          <p className="text-[14px] font-medium">Lendo agora na comunidade</p>
          <div className="grid grid-cols-3 gap-2 mt-3">{['little-women', 'dracula', 'the-secret-garden'].map(s => <img key={s} src={coverSrc(s)} alt="" className="rounded-md w-full aspect-[2/3] object-cover" />)}</div>
        </div>
      </div>
    </div>
  )
}
