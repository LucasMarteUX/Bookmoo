// Leitor do app reconstruído: página ilustrada de Peter Rabbit com legenda, balão de fala, karaokê, cartão da palavra e
// troca de estilo. `step` escolhe o momento mostrado (0 ouvir, 1 palavra, 2 balão, 3 estilo).
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpen, Check, ChevronLeft, ChevronRight, Eye, FileText, Headphones, Image as ImageIcon, Maximize2, Mic, MousePointer2, Music, NotebookPen, PenLine, Play, Pause, RotateCcw, Settings2, Sparkles, Star, StickyNote, Type, Volume2, GraduationCap } from 'lucide-react'
import { tutorAvatar } from '../content'

const CAPTION = 'The Tale of Peter Rabbit. Once upon a time there were four little Rabbits, and their names were Flopsy, Mopsy, Cottontail, and Peter. They lived with their Mother in a sandbank, underneath the root of a very big fir-tree.'
const WORDS = CAPTION.split(' ')
const KNOWN = new Set(['The', 'and', 'They', 'in', 'the', 'a'])
const RABBITS = WORDS.findIndex(w => w.startsWith('Rabbits'))

const STYLES = [
  ['aquarela-nanquim', 'Aquarela e nanquim'], ['infantil-guache', 'Guache infantil'], ['manga-tradicional', 'Mangá'], ['hq-europeia', 'HQ europeia'], ['romance-aquarela', 'Romance em aquarela'], ['realismo-magico', 'Realismo mágico'],
]

function Caption({ i, step }: { i: number; step: number }) {
  return (
    <div className="absolute left-[3%] top-[2.4%] w-[46%] rounded-[3px] px-4 py-3 text-[15.5px] leading-[1.55]" style={{ background: '#FBF3D5', color: '#1d1a14', boxShadow: '0 0 0 2px #2b261c, 0 6px 0 rgba(0,0,0,.18)', fontFamily: '"Comic Neue", "Nunito", system-ui, sans-serif', fontWeight: 600 }}>
      {WORDS.map((w, k) => {
        const reading = step === 0 && k === i
        const chosen = step === 1 && k === RABBITS
        const known = KNOWN.has(w.replace(/[.,]/g, ''))
        return (
          <span key={k}>
            <span className="rounded-[4px] px-[2px] -mx-[2px] transition-colors duration-150"
              style={chosen ? { background: '#F5C451', boxShadow: '0 0 0 2px #B07B12' } : reading ? { background: '#2b261c', color: '#FBF3D5' } : known ? { background: '#2F4A38', color: '#E8F3EB' } : undefined}>{w}</span>{' '}
          </span>
        )
      })}
    </div>
  )
}

export function MockReader({ step }: { step: number }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (step !== 0) return
    const t = window.setInterval(() => setI(n => (n + 1) % WORDS.length), 260)
    return () => window.clearInterval(t)
  }, [step])
  const pageY = step === 2 ? -260 : 0

  return (
    <div className="flex-1 min-w-0 flex flex-col relative">
      <div className="h-[52px] shrink-0 flex items-center gap-1 px-5 text-[13px]" style={{ borderBottom: '1px solid var(--t-border)' }}>
        {[[BookOpen, 'Ler'], [PenLine, 'Escrever'], [Headphones, 'Escutar'], [Mic, 'Falar']].map(([I, l], k) => {
          const Icon = I as typeof BookOpen
          return <span key={l as string} className="flex items-center gap-1.5 h-8 px-3 rounded-md" style={k === 0 ? { background: 'var(--t-chip)', fontWeight: 500 } : { color: 'var(--t-muted)' }}><Icon size={14} />{l as string}</span>
        })}
        <span className="w-px h-5 mx-2" style={{ background: 'var(--t-border)' }} />
        {[Type, ImageIcon, Music, GraduationCap, Eye, Maximize2].map((I, k) => <span key={k} className="w-8 h-8 grid place-items-center rounded-md" style={k === 1 ? { background: 'var(--t-chip)' } : { color: 'var(--t-muted)' }}><I size={15} /></span>)}
        <span className="ml-auto flex items-center gap-2">
          <img src="/styles/aquarela-nanquim.webp" alt="" className="w-7 h-7 rounded-md object-cover" />
          <img src={tutorAvatar('bia')} alt="" className="w-7 h-7 rounded-full object-cover" style={{ background: '#F2D5C8' }} />
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-[250px] pt-5 relative">
        <p className="mk-display text-[19px]">Short Fiction</p>
        <p className="text-[12px] mb-4" style={{ color: 'var(--t-muted)' }}>31.697 palavras · Beatrix Potter</p>
        <motion.div animate={{ y: pageY }} transition={{ type: 'spring', stiffness: 90, damping: 22 }} className="relative rounded-md overflow-hidden" style={{ boxShadow: '0 0 0 3px #f4efe6' }}>
          <img src="/site/reader/peter-rabbit-page.webp" alt="Página ilustrada de The Tale of Peter Rabbit no Upoonly" className="w-full block" draggable={false} />
          <Caption i={i} step={step} />
          {/* Balão de fala da Mamãe Coelho no 2º quadro */}
          <motion.div animate={{ opacity: step >= 2 ? 1 : 0.0, scale: step >= 2 ? 1 : 0.9 }} transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="absolute right-[5%] top-[36.5%] rounded-[3px] px-4 py-2.5 text-[20px]" style={{ background: '#FBF3D5', color: '#1d1a14', boxShadow: '0 0 0 2px #2b261c, 0 6px 0 rgba(0,0,0,.18)', fontFamily: '"Comic Neue", system-ui', fontWeight: 600 }}>
            “Now <span className="rounded px-1" style={{ background: '#2F4A38', color: '#E8F3EB' }}>my</span> dears,” said old Mrs. Rabbit one morning…
          </motion.div>
          <motion.div animate={{ opacity: step >= 2 ? 1 : 0 }} className="absolute left-[34%] top-[47.5%] flex items-center gap-1.5 px-3 h-8 rounded-full text-[12.5px] font-bold" style={{ background: '#F5C451', color: '#2b261c', boxShadow: '0 0 0 2px #2b261c' }}>
            <Volume2 size={13} />MRS. RABBIT
          </motion.div>
        </motion.div>

        {/* Cartão da palavra (clique em "Rabbits") */}
        <AnimatePresence>
          {step === 1 && (
            <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="absolute left-[330px] top-[228px] w-[330px] rounded-xl p-3.5 z-10" style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)', boxShadow: '0 24px 50px -16px rgba(0,0,0,.5)' }}>
              <div className="flex items-center justify-between"><span className="mk-display text-[21px]">Rabbits</span><Volume2 size={15} style={{ color: 'var(--t-muted)' }} /></div>
              <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--t-muted)' }}>/ˈræb.ɪts/ · coelhos</p>
              <div className="grid grid-cols-3 gap-1.5 mt-3 text-[12px] font-medium">
                <span className="h-8 rounded-lg flex items-center justify-center gap-1" style={{ background: 'var(--g-bg)', color: 'var(--g-fg)', boxShadow: 'inset 0 0 0 1px var(--g-bd)' }}><Check size={12} />Aprendido</span>
                <span className="h-8 rounded-lg flex items-center justify-center gap-1" style={{ background: 'var(--a-bg)', color: 'var(--a-fg)', boxShadow: 'inset 0 0 0 1px var(--a-bd)' }}><RotateCcw size={12} />Revisão</span>
                <span className="h-8 rounded-lg flex items-center justify-center gap-1" style={{ background: 'var(--l-bg)', color: 'var(--l-fg)', boxShadow: 'inset 0 0 0 1px var(--l-bd)' }}><Star size={12} />Importante</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-2 text-[12px]" style={{ color: 'var(--t-muted)' }}>
                {[[FileText, 'Explicação'], [StickyNote, 'Nota'], [ImageIcon, 'Imagem']].map(([I, l]) => { const Icon = I as typeof FileText; return <span key={l as string} className="h-8 rounded-lg flex items-center justify-center gap-1.5"><Icon size={12} />{l as string}</span> })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Estilo da ilustração */}
        <AnimatePresence>
          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute right-4 top-4 bottom-20 w-[300px] rounded-xl p-4 z-10 flex flex-col gap-3" style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)', boxShadow: '0 24px 50px -16px rgba(0,0,0,.5)' }}>
              <p className="text-[14px] font-medium flex items-center gap-1.5"><Sparkles size={14} />Estilo das ilustrações</p>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map(([id, name], k) => (
                  <div key={id} className="rounded-lg overflow-hidden relative" style={{ boxShadow: k === 0 ? '0 0 0 2px var(--t-text)' : '0 0 0 1px var(--t-border)' }}>
                    <img src={`/styles/${id}.webp`} alt="" className="w-full aspect-square object-cover" />
                    <span className="absolute left-1 bottom-1 right-1 text-[10.5px] px-1.5 py-0.5 rounded bg-black/55 text-white truncate">{name}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11.5px] mt-auto" style={{ color: 'var(--t-muted)' }}>Esta página já foi ilustrada pela comunidade: não gasta créditos.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 bottom-4 flex items-center gap-1 h-11 px-2 rounded-xl text-[12.5px] z-10 whitespace-nowrap" style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)', boxShadow: '0 12px 30px -10px rgba(0,0,0,.4)' }}>
        <span className="flex items-center gap-1 px-2.5" style={{ color: 'var(--t-muted)' }}><ChevronLeft size={14} />Página anterior</span>
        <span className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg" style={step === 1 ? { background: 'var(--t-chip)' } : { color: 'var(--t-muted)' }}><MousePointer2 size={13} />Clicar palavra</span>
        <span className="flex items-center gap-1.5 px-2.5" style={{ color: 'var(--t-muted)' }}><Type size={13} />Selecionar texto</span>
        <span className="flex items-center gap-1.5 px-2.5" style={{ color: 'var(--t-muted)' }}><NotebookPen size={13} />Nota</span>
        <span className="w-8 h-8 rounded-full grid place-items-center mx-1" style={{ background: 'var(--t-primary)', color: 'var(--t-primary-text)' }}>{step === 0 ? <Pause size={13} /> : <Play size={13} />}</span>
        <span className="px-2">0,9x</span>
        <Settings2 size={14} className="mx-1.5" style={{ color: 'var(--t-muted)' }} />
        <span className="px-2 tabular-nums">103 / 303</span>
        <span className="flex items-center gap-1 px-2.5">Próxima página<ChevronRight size={14} /></span>
      </div>
      <div className="absolute right-5 bottom-[76px] flex flex-col items-end gap-2 z-10">
        <AnimatePresence>
          {step === 2 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-[230px] rounded-2xl rounded-br-md px-3 py-2 text-[12.5px]" style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)' }}>
              Quer que eu leia com a voz da Mamãe Coelho? 🐇
            </motion.div>
          )}
        </AnimatePresence>
        <span className="relative">
          <img src={tutorAvatar('bia')} alt="" className="w-12 h-12 rounded-full object-cover" style={{ background: '#F2D5C8', boxShadow: '0 0 0 3px var(--t-bg)' }} />
          <span className="absolute right-0 bottom-0 w-3 h-3 rounded-full" style={{ background: '#3AC77A', boxShadow: '0 0 0 2px var(--t-bg)' }} />
        </span>
      </div>
    </div>
  )
}
