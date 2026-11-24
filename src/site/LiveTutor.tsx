// Tutor animado no site: o mesmo personagem 2.5D do app, sem voz, num roteiro automático de reações e gestos
// (sorri, pisca, fica surpreso, pensa, acena), com balão. No celular ou sem WebGL2: a foto, que "respira" e sorri sozinha.
//
// Troca de tutor sem "pulo": o anterior continua na tela (desfocado e mais claro) até o próximo estar carregado e
// enquadrado; aí os dois fazem uma transição cruzada. A foto só aparece na primeira carga, e some com a mesma transição.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { Mood } from '@/components/voice/TutorAvatar'
import type { VoiceState } from '@/hooks/useVoiceConversation'
import { tutorImg } from './content'

const LivLivAvatar = lazy(() => import('@/components/voice/LivLivAvatar').then(m => ({ default: m.LivLivAvatar })))

const CHARACTER: Record<string, string> = { bia: 'bookmoo-mulher', luck: 'bookmoo-homem', yuno: 'bookmoo-yuno', yuri: 'bookmoo-yuri' }
const EASE = [0.2, 0.8, 0.2, 1] as const

type Beat = { mood: Mood; state: VoiceState; line?: string; ms: number; wave?: boolean }

const SCRIPTS: Record<string, Beat[]> = {
  bia: [
    { mood: 'happy', state: 'idle', line: 'Oi! Me conta o que você está lendo?', ms: 3600, wave: true },
    { mood: 'neutral', state: 'listening', ms: 2200 },
    { mood: 'surprised', state: 'idle', line: 'Alice? Eu amo esse livro!', ms: 3000 },
    { mood: 'laughing', state: 'idle', line: 'Vamos ler juntas o capítulo 1?', ms: 3400 },
    { mood: 'wink', state: 'idle', line: 'Pode errar à vontade, tá?', ms: 2800 },
    { mood: 'confused', state: 'thinking', line: 'Hmm… “peeped”… quer que eu explique?', ms: 3200 },
  ],
  luck: [
    { mood: 'happy', state: 'idle', line: 'Bora conversar sobre o seu dia?', ms: 3400, wave: true },
    { mood: 'neutral', state: 'listening', ms: 2200 },
    { mood: 'confused', state: 'thinking', line: 'Interessante. Me explica melhor?', ms: 3000 },
    { mood: 'happy', state: 'idle', line: 'Boa frase. Só um detalhe no verbo.', ms: 3400 },
    { mood: 'surprised', state: 'idle', line: 'Você já leu Sherlock Holmes?', ms: 3000 },
  ],
  yuno: [
    { mood: 'excited', state: 'idle', line: 'Vamos praticar? Sem pressão!', ms: 3200, wave: true },
    { mood: 'laughing', state: 'idle', line: 'Hahaha, essa foi boa!', ms: 2600 },
    { mood: 'neutral', state: 'listening', ms: 2200 },
    { mood: 'wink', state: 'idle', line: 'Fala mais alto, eu tô ouvindo!', ms: 2800 },
    { mood: 'surprised', state: 'idle', line: 'Você já assistiu essa série em inglês?', ms: 3200 },
  ],
  yuri: [
    { mood: 'happy', state: 'idle', line: 'E aí! Eu ajudo com as palavras.', ms: 3200, wave: true },
    { mood: 'confused', state: 'thinking', line: '“Bored” ou “boring”? Bora ver.', ms: 3200 },
    { mood: 'excited', state: 'idle', line: 'Mandou bem! Salvei no seu vocabulário.', ms: 3200 },
    { mood: 'neutral', state: 'listening', ms: 2200 },
    { mood: 'wink', state: 'idle', line: 'Essa gíria o pessoal usa muito.', ms: 2800 },
  ],
}

export function canRunLive() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(max-width: 900px), (pointer: coarse), (prefers-reduced-motion: reduce)').matches) return false
  try { return !!document.createElement('canvas').getContext('webgl2') } catch { return false }
}

function useScript(id: string, playing: boolean, script?: Beat[]) {
  const list = script ?? SCRIPTS[id] ?? SCRIPTS.bia
  const [i, setI] = useState(0)
  useEffect(() => { setI(0) }, [id])
  useEffect(() => {
    if (!playing) return
    const t = window.setTimeout(() => setI(n => (n + 1) % list.length), list[i % list.length].ms)
    return () => window.clearTimeout(t)
  }, [i, playing, list])
  return list[i % list.length]
}

/** Balão de fala com troca suave. */
export function Bubble({ text, className = '', tail = 'left' }: { text?: string; className?: string; tail?: 'left' | 'center' }) {
  return (
    <AnimatePresence mode="wait">
      {text && (
        <motion.div key={text} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className={`bg-white rounded-2xl ${tail === 'left' ? 'rounded-bl-md' : ''} px-4 py-3 text-[15px] leading-snug s-head ${className}`} style={{ boxShadow: '0 12px 30px -12px rgba(0,0,0,.22), 0 0 0 1px rgba(25,25,25,.05)' }}>
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Foto que respira e sorri sozinha (celular, sem WebGL2, ou na primeira carga). */
export function BreathingTutor({ id, smile, className = '', style }: { id: string; smile?: boolean; className?: string; style?: React.CSSProperties }) {
  const reduce = useReducedMotion()
  const [auto, setAuto] = useState(false)
  useEffect(() => {
    if (reduce || smile !== undefined) return
    let t = 0
    const loop = () => {
      setAuto(true)
      t = window.setTimeout(() => { setAuto(false); t = window.setTimeout(loop, 2600 + Math.random() * 2600) }, 1300 + Math.random() * 900)
    }
    t = window.setTimeout(loop, 900 + Math.random() * 1800)
    return () => window.clearTimeout(t)
  }, [reduce, smile])
  const on = smile ?? auto
  return (
    <motion.div className={`relative ${className}`} style={{ transformOrigin: '50% 100%', ...style }}
      animate={reduce ? undefined : { scaleY: [1, 1.006, 1] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
      <img src={tutorImg(id)} alt="" draggable={false} className="block h-full w-auto select-none" />
      <img src={tutorImg(id, true)} alt="" draggable={false} aria-hidden className="absolute inset-0 h-full w-auto select-none transition-opacity duration-500" style={{ opacity: on ? 1 : 0 }} />
    </motion.div>
  )
}

type Layer = { id: string; ready: boolean; key: number }

/** Palco do tutor: animado no computador; foto que respira no celular. Balão com o roteiro automático. */
export function LiveTutor({ id, playing = true, bubble = 'top-left', script, name, portrait = true }: { id: string; playing?: boolean; bubble?: 'top-left' | 'head' | 'none'; script?: Beat[]; name?: string; portrait?: boolean }) {
  const live = useMemo(canRunLive, [])
  const [failed, setFailed] = useState(false)
  const [layers, setLayers] = useState<Layer[]>(() => [{ id, ready: false, key: 0 }])

  // Novo tutor: entra uma camada nova por cima; as antigas ficam até ela ficar pronta.
  useEffect(() => {
    setLayers(ls => (ls[ls.length - 1]?.id === id ? ls : [...ls.filter(l => l.ready).slice(-1), { id, ready: false, key: Date.now() }]))
  }, [id])
  // Quando a mais nova fica pronta, as antigas saem depois da transição.
  const top = layers[layers.length - 1]
  useEffect(() => {
    if (!top?.ready || layers.length < 2) return
    const t = window.setTimeout(() => setLayers(ls => ls.slice(-1)), 750)
    return () => window.clearTimeout(t)
  }, [top?.ready, top?.key, layers.length])

  const shownId = top?.ready || !live || failed ? id : (layers.find(l => l.ready)?.id ?? id)
  const reduce = useReducedMotion()
  const beat = useScript(shownId, playing && !reduce, script)
  const showLive = live && !failed

  return (
    <div className="absolute inset-0 site-live">
      {showLive && layers.map(l => {
        const isTop = l.key === top.key
        return (
          <motion.div key={l.key} className="absolute inset-0"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: isTop && l.ready ? 1 : 0, y: l.ready ? 0 : 12, scale: isTop ? 1 : 0.995 }}
            transition={{ duration: 0.7, ease: EASE }}>
            <Suspense fallback={null}>
              <LivLivAvatar characterId={CHARACTER[l.id]} stage state={isTop ? beat.state : 'idle'} mood={isTop ? beat.mood : 'neutral'} wave={isTop && !!beat.wave}
                followPointer onFail={() => setFailed(true)}
                onReady={r => { if (!r) return; setLayers(ls => ls.map(x => (x.key === l.key ? { ...x, ready: true } : x))) }} />
            </Suspense>
          </motion.div>
        )
      })}
      {portrait && (!showLive || !top?.ready) && (
        <motion.div key={id} className="absolute inset-0 flex items-end justify-center pointer-events-none"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
          <BreathingTutor id={id} className={bubble === "head" ? "h-[76%]" : "h-[88%]"} smile={beat.mood !== 'neutral' && beat.mood !== 'confused' ? true : undefined} />
        </motion.div>
      )}
      {showLive && !top?.ready && name && (
        <motion.p className="site-live-calling" initial={{ opacity: 0 }} animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
          chamando {name}…
        </motion.p>
      )}
      {bubble === 'top-left' && <div className="absolute top-6 left-6 right-6 flex pointer-events-none"><Bubble text={beat.line} className="max-w-[78%]" /></div>}
      {bubble === 'head' && <div className="absolute top-[7%] inset-x-0 flex justify-center pointer-events-none"><Bubble text={beat.line} tail="center" className="max-w-[60%] text-center" /></div>}
    </div>
  )
}

export type { Beat as TutorBeat }
