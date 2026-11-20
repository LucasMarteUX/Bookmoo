// Outras telas do app reconstruídas: cartão da palavra, Vocabulário, Raio-X e Conversa.
import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'motion/react'
import { Check, ChevronDown, FileText, Image as ImageIcon, Info, Layers, Lightbulb, MessagesSquare, Mic, NotebookPen, RotateCcw, Search, SlidersHorizontal, Sparkles, Star, Volume2, X } from 'lucide-react'
import { tutorAvatar } from '../content'
import { BreathingTutor, LiveTutor, type TutorBeat } from '../LiveTutor'

const chip = (k: 'g' | 'a' | 'l') => ({ background: `var(--${k}-bg)`, color: `var(--${k}-fg)`, boxShadow: `inset 0 0 0 1px var(--${k}-bd)` })

/** Janela da palavra (o que abre ao tocar numa palavra e pedir a explicação). */
export function MockWordCard() {
  return (
    <div className="flex-1 grid place-items-center p-8" style={{ background: 'var(--t-bg)' }}>
      <div className="w-[620px] rounded-2xl overflow-hidden" style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)', boxShadow: '0 40px 80px -30px rgba(0,0,0,.55)' }}>
        <div className="px-7 pt-6 pb-4">
          <div className="flex items-center justify-between text-[12px]" style={{ color: 'var(--t-muted)' }}><span>Nova palavra › Palavra</span><X size={16} /></div>
          <h3 className="mk-display text-[40px] leading-tight mt-1">peeped</h3>
          <div className="flex items-center gap-2 mt-2 text-[12.5px]">
            <span className="flex items-center gap-1.5 h-8 px-3 rounded-lg" style={{ background: 'var(--t-chip)' }}><Volume2 size={13} />Ouvir</span>
            <span className="flex items-center gap-1.5 h-8 px-3 rounded-lg" style={{ background: 'var(--t-chip)', color: 'var(--t-muted)' }}>0,6× Devagar</span>
            <span className="ml-2" style={{ color: 'var(--t-muted)' }}>/piːpt/</span>
          </div>
          <p className="text-[12.5px] mt-4 flex items-center gap-1.5" style={{ color: 'var(--t-muted)' }}>Como está essa palavra para você? <Info size={12} /></p>
          <div className="flex gap-2 mt-2 text-[12.5px] font-medium">
            <span className="h-8 px-3 rounded-lg flex items-center gap-1.5" style={chip('g')}><Check size={13} />Aprendi</span>
            <span className="h-8 px-3 rounded-lg flex items-center gap-1.5" style={{ ...chip('a'), boxShadow: 'inset 0 0 0 2px var(--a-fg)' }}><RotateCcw size={13} />Revisar</span>
            <span className="h-8 px-3 rounded-lg flex items-center gap-1.5" style={chip('l')}><Star size={13} />Importante</span>
          </div>
        </div>
        <div className="flex gap-5 px-7 text-[13px]" style={{ borderBottom: '1px solid var(--t-border)' }}>
          {[[FileText, 'Significado'], [Layers, 'Exemplos'], [Sparkles, 'História'], [ImageIcon, 'Imagens'], [NotebookPen, 'Suas anotações']].map(([I, l], k) => {
            const Icon = I as typeof FileText
            return <span key={l as string} className="flex items-center gap-1.5 py-3" style={k === 0 ? { borderBottom: '2px solid var(--t-text)', fontWeight: 500 } : { color: 'var(--t-muted)' }}><Icon size={13} />{l as string}</span>
          })}
        </div>
        <div className="px-7 py-5 text-[13.5px] leading-relaxed flex flex-col gap-3">
          <p><b className="font-semibold">espiou, deu uma olhadinha</b> <span style={{ color: 'var(--t-muted)' }}>· verbo, passado de <i>peep</i></span></p>
          <p style={{ color: 'var(--t-muted)' }}>Olhar rápido e meio escondido, por uma fresta ou por cima de algo. Em <i>Alice</i>, ela “dá uma espiada” no livro da irmã, sem ler de verdade.</p>
          <div className="rounded-xl p-3.5 flex flex-col gap-1.5" style={{ background: 'var(--t-bg2)' }}>
            {[['+', 'She peeped into the book.', 'Ela espiou o livro.'], ['−', 'She didn’t peep at the answers.', 'Ela não espiou as respostas.'], ['?', 'Did you peep at my phone?', 'Você espiou meu celular?']].map(([s, en, pt]) => (
              <p key={en} className="flex gap-2"><span className="w-4 text-center font-semibold" style={{ color: 'var(--t-muted)' }}>{s}</span><span><b className="font-medium">{en}</b> <span style={{ color: 'var(--t-muted)' }}>{pt}</span></span></p>
            ))}
          </div>
          <p className="text-[12.5px] flex gap-2" style={{ color: 'var(--t-muted)' }}><Lightbulb size={14} className="shrink-0 mt-0.5" />Nota de uso: <i>peep</i> é mais leve e curioso que <i>stare</i> (encarar). Também é o “piu” de passarinho.</p>
        </div>
        <div className="flex justify-end gap-2 px-7 py-4 text-[13px]" style={{ borderTop: '1px solid var(--t-border)' }}>
          <span className="h-9 px-4 grid place-items-center rounded-lg">Cancelar</span>
          <span className="h-9 px-4 grid place-items-center rounded-lg font-medium" style={{ background: 'var(--t-primary)', color: 'var(--t-primary-text)' }}>Salvar</span>
        </div>
      </div>
    </div>
  )
}

const VOCAB: { w: string; ipa?: string; st: 'a' | 'g' | 'l'; def: string; book: string }[] = [
  { w: 'peeped', ipa: 'piːpt', st: 'a', def: 'Espiou, deu uma olhadinha rápida e meio escondida.', book: 'Alice’s Adventures in Wonderland' },
  { w: 'sandbank', ipa: 'ˈsænd.bæŋk', st: 'g', def: 'Banco de areia, um morro de areia na beira de um rio.', book: 'Short Fiction' },
  { w: 'mischief', ipa: 'ˈmɪs.tʃɪf', st: 'l', def: 'Travessura; comportamento que causa pequenos problemas.', book: 'Short Fiction' },
  { w: 'whereupon', st: 'a', def: 'Logo depois disso; em seguida (formal, usado em narrativas).', book: 'The Adventures of Sherlock Holmes' },
  { w: 'wretched', ipa: 'ˈretʃ.ɪd', st: 'g', def: 'Miserável, muito infeliz ou de má qualidade.', book: 'A Christmas Carol' },
  { w: 'hurried', ipa: 'ˈhʌr.id', st: 'g', def: 'Apressou-se, foi depressa.', book: 'Alice’s Adventures in Wonderland' },
]
const ST = { a: ['Revisar', RotateCcw], g: ['Aprendido', Check], l: ['Importante', Star] } as const

export function MockVocab() {
  return (
    <div className="flex-1 min-w-0 px-12 pt-8 overflow-hidden">
      <div className="flex items-start justify-between">
        <div><h1 className="mk-display text-[38px] flex items-center gap-2">Vocabulário <Info size={15} style={{ color: 'var(--t-muted)' }} /></h1><p className="text-[13px]" style={{ color: 'var(--t-muted)' }}>Lista centralizada de todos os termos salvos com explicações e áudio.</p></div>
        <span className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-medium" style={{ background: 'var(--t-primary)', color: 'var(--t-primary-text)' }}><Layers size={14} />Revisar agora · 18</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-6">
        {([['a', 'Revisar', 18, RotateCcw], ['l', 'Importante', 6, Star], ['g', 'Aprendido', 162, Check]] as const).map(([k, l, n, I]) => (
          <div key={l} className="rounded-xl p-4" style={{ background: `var(--${k}-bg)`, color: `var(--${k}-fg)`, boxShadow: `inset 0 0 0 1px var(--${k}-bd)` }}>
            <p className="text-[12.5px] flex items-center gap-1.5"><I size={13} />{l}</p><p className="text-[26px] font-semibold mt-1">{n}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-5 text-[13px]">
        <span className="flex-1 flex items-center gap-2 h-9 px-3 rounded-lg" style={{ border: '1px solid var(--t-border)', color: 'var(--t-muted)' }}><Search size={14} />Buscar palavra ou significado</span>
        <span className="flex items-center gap-2 h-9 px-3 rounded-lg" style={{ border: '1px solid var(--t-border)' }}>Todos os livros<ChevronDown size={14} /></span>
      </div>
      <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-border)', background: 'var(--t-card)' }}>
        {VOCAB.map((v, i) => {
          const [label, Icon] = ST[v.st]
          return (
            <div key={v.w} className="px-5 py-3.5" style={i ? { borderTop: '1px solid var(--t-border)' } : undefined}>
              <p className="flex items-center gap-2"><span className="mk-display text-[19px]">{v.w}</span>{v.ipa && <span className="text-[11px] tracking-wide" style={{ color: 'var(--t-muted)' }}>{v.ipa}</span>}
                <span className="text-[11px] h-5 px-1.5 rounded-md flex items-center gap-1 font-medium" style={chip(v.st)}><Icon size={10} />{label}</span></p>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--t-muted)' }}>{v.def}</p>
              <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--t-muted)', opacity: 0.75 }}>{v.book}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const BARS: [string, number][] = [['Fala', 81], ['Conversa', 74], ['Vocabulário', 68], ['Ditado', 59], ['Constância', 90]]

export function MockRaioX() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })
  const [score, setScore] = useState(0)
  useEffect(() => {
    if (!inView) return
    let raf = 0; const t0 = performance.now()
    const tick = (now: number) => { const t = Math.min(1, (now - t0) / 1400); setScore(Math.round(74 * (1 - Math.pow(1 - t, 3)))); if (t < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView])
  const evo = [38, 44, 49, 55, 61, 66, 74]
  return (
    <div ref={ref} className="flex-1 min-w-0 px-12 pt-8 overflow-hidden">
      <div className="flex items-start justify-between">
        <div><h1 className="mk-display text-[38px]">Raio-X</h1><p className="text-[13px]" style={{ color: 'var(--t-muted)' }}>Como está o seu inglês, o que melhorou e onde focar.</p></div>
        <div className="flex gap-2 text-[13px]"><span className="h-9 px-3.5 rounded-full grid place-items-center" style={{ border: '1px solid var(--t-border)' }}>Seu nível · <b className="font-semibold ml-1">B1</b></span><span className="h-9 px-3.5 rounded-full grid place-items-center font-medium" style={{ background: 'var(--t-primary)', color: 'var(--t-primary-text)' }}>Nova avaliação</span></div>
      </div>
      <div className="mt-6 rounded-2xl p-6" style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)' }}>
        <p className="text-[11.5px] tracking-[.08em]" style={{ color: 'var(--t-muted)' }}>AVALIAÇÃO DE ESTA SEMANA</p>
        <p className="mt-1"><span className="text-[56px] font-semibold tabular-nums leading-none">{score}</span> <span style={{ color: 'var(--t-muted)' }}>/ 100</span> <span className="ml-2 text-[13px] px-2 py-0.5 rounded-md" style={chip('g')}>+8 desde a última</span></p>
        <div className="mt-5 flex flex-col gap-3">
          {BARS.map(([l, v], k) => (
            <div key={l} className="grid grid-cols-[110px_1fr_36px] items-center gap-4 text-[13px]">
              <span>{l}</span>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--t-chip)' }}>
                <motion.div className="h-full rounded-full" style={{ background: 'var(--t-text)' }} initial={{ width: 0 }} animate={{ width: inView ? `${v}%` : 0 }} transition={{ duration: 1.1, delay: 0.15 + k * 0.08, ease: [0.2, 0.8, 0.2, 1] }} />
              </div>
              <span className="text-right tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-[1.3fr_1fr] gap-4">
        <div className="rounded-2xl p-5" style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)' }}>
          <p className="text-[14px] font-medium">Evolução</p>
          <svg viewBox="0 0 300 100" className="w-full h-[110px] mt-2" aria-hidden>
            <motion.polyline fill="none" stroke="var(--t-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              points={evo.map((v, i) => `${i * 50},${100 - v}`).join(' ')} initial={{ pathLength: 0 }} animate={{ pathLength: inView ? 1 : 0 }} transition={{ duration: 1.4, delay: 0.3 }} />
            {evo.map((v, i) => <circle key={i} cx={i * 50} cy={100 - v} r="3.5" fill="var(--t-card)" stroke="var(--t-text)" strokeWidth="2" />)}
          </svg>
        </div>
        <div className="rounded-2xl p-5 text-[13px] leading-relaxed" style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)' }}>
          <p className="text-[14px] font-medium mb-2">Diagnóstico</p>
          <p style={{ color: 'var(--t-muted)' }}>Sua pronúncia evoluiu muito. Foque no passado irregular: preparei 3 histórias de reforço com <i>went, saw</i> e <i>thought</i>.</p>
        </div>
      </div>
    </div>
  )
}

const TALK: TutorBeat[] = [
  { mood: 'happy', state: 'speaking', line: 'So, Marina, what did you think about Peter going into the garden?', ms: 4200, wave: true },
  { mood: 'neutral', state: 'listening', ms: 2600 },
  { mood: 'laughing', state: 'speaking', line: 'Ha! He was brave… and a little naughty. Just one tip: “he didn’t listen to his mother”.', ms: 5200 },
  { mood: 'neutral', state: 'listening', ms: 2400 },
  { mood: 'surprised', state: 'speaking', line: 'Wow, great sentence! Would you go into Mr. McGregor’s garden?', ms: 4200 },
]

/** Tela Conversar, como no app: tutor grande no centro, balão sobre a cabeça e o botão de falar embaixo. */
export function MockConversa({ active = true }: { active?: boolean }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col relative overflow-hidden">
      <div className="flex items-center justify-between px-[170px] h-[68px] shrink-0 relative z-10">
        <div><p className="text-[14px] font-medium flex items-center gap-1">Conversa sobre o livro <ChevronDown size={14} /></p><p className="text-[12px]" style={{ color: 'var(--t-muted)' }}>Com a Bia, sua tutora · Short Fiction</p></div>
        <div className="flex items-center gap-4" style={{ color: 'var(--t-muted)' }}><Lightbulb size={17} /><MessagesSquare size={17} /><SlidersHorizontal size={17} /><img src={tutorAvatar('bia')} alt="" className="w-7 h-7 rounded-full" style={{ background: '#F2D5C8' }} /></div>
      </div>
      <div className="absolute inset-x-0 top-[40px] bottom-[96px]">
        {active ? <LiveTutor id="bia" bubble="head" script={TALK} /> : <div className="absolute inset-0 flex items-end justify-center"><BreathingTutor id="bia" className="h-[92%]" /></div>}
      </div>
      <div className="mt-auto relative z-10 px-[300px] pb-7 flex flex-col items-center gap-3">
        <p className="text-[13px] px-3 py-1.5 rounded-full" style={{ background: 'var(--t-chip)', color: 'var(--t-muted)' }}>“I think he was very brave, but he didn’t listen to his mother.”</p>
        <div className="w-full h-12 rounded-full flex items-center justify-center gap-2.5 text-[14px] font-medium" style={{ background: 'var(--t-primary)', color: 'var(--t-primary-text)' }}>
          <span className="flex items-end gap-[3px] h-4">{[6, 12, 8, 14, 7, 11, 5].map((h, i) => <motion.span key={i} className="w-[3px] rounded-full bg-current" animate={{ height: [h * 0.5, h, h * 0.4, h * 0.8] }} transition={{ duration: 0.9, repeat: Infinity, repeatType: 'mirror', delay: i * 0.08 }} />)}</span>
          Ouvindo você… <Mic size={15} />
        </div>
      </div>
    </div>
  )
}
