// Tutor animado no site: o mesmo personagem 2.5D do app, sem voz, num roteiro automático de reações e gestos
// (sorri, pisca, fica surpreso, pensa, acena), com balão, no desktop e no celular. Sem WebGL2: retrato com reações.
//
// Troca de tutor sem "pulo": o anterior continua na tela (desfocado e mais claro) até o próximo estar carregado e
// enquadrado; aí os dois fazem uma transição cruzada. A foto só aparece na primeira carga, e some com a mesma transição.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { Mood } from '@/components/voice/TutorAvatar'
import type { VoiceState } from '@/hooks/useVoiceConversation'
import { tutorImg } from './content'
import { characterAvatarUrl } from '@/lib/livliv/characters'

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
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    const supported = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return supported
  } catch { return false }
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

/** Roteiro de reações (falas, humor e gestos) de um tutor, para quem desenha o tutor por conta própria. */
export function useTutorBeat(id: string, playing: boolean) { return useScript(id, playing) }

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
      animate={reduce || style?.transform === 'none' ? undefined : { scaleY: [1, 1.006, 1] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
      <img src={tutorImg(id)} alt="" draggable={false} className="block h-full w-auto select-none transition-opacity duration-100" style={{ opacity: on ? 0 : 1 }} />
      <img src={tutorImg(id, true)} alt="" draggable={false} aria-hidden className="absolute inset-0 h-full w-auto select-none transition-opacity duration-100" style={{ opacity: on ? 1 : 0 }} />
    </motion.div>
  )
}

type Layer = { id: string; ready: boolean; key: number }

/** Palco animado em qualquer tamanho, com retrato de reserva e roteiro automático. */
export function LiveTutor({ id, playing = true, bubble = 'top-left', script, name, portrait = true, onLive }: { id: string; playing?: boolean; bubble?: 'top-left' | 'head' | 'none'; script?: Beat[]; name?: string; portrait?: boolean; onLive?: (s: { readyId: string | null; failed: boolean }) => void }) {
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

  useEffect(() => {
    onLive?.({ readyId: live && !failed && top?.ready ? top.id : null, failed: !live || failed })
  }, [onLive, live, failed, top?.ready, top?.id])

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
            initial={false}
            animate={{ opacity: isTop && l.ready ? 1 : 0 }}
            transition={{ duration: bubble === 'head' ? 0 : 0.7, ease: EASE }}>
            <Suspense fallback={null}>
              <LivLivAvatar characterId={CHARACTER[l.id]} stage state={isTop ? beat.state : 'idle'} mood={isTop ? beat.mood : 'neutral'} wave={isTop && !!beat.wave}
                followPointer={false} onFail={() => setFailed(true)}
                onReady={r => { if (!r) return; setLayers(ls => ls.map(x => (x.key === l.key ? { ...x, ready: true } : x))) }} />
            </Suspense>
          </motion.div>
        )
      })}
      {portrait && (!showLive || !top?.ready) && (
        <motion.div key={id} className="absolute inset-0 flex items-end justify-center pointer-events-none"
          initial={bubble === 'head' ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, ease: EASE }}>
          <BreathingTutor id={id} style={bubble === 'head' ? { transform: 'none' } : undefined} className={bubble === "head" ? "h-[76%]" : "h-[88%]"} smile={beat.mood !== 'neutral' && beat.mood !== 'confused' ? true : undefined} />
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

/** Igual ao "Chamando…" do avatar, para o instante em que o código do personagem ainda está chegando. */
function CallPlaceholder({ id, name }: { id: string; name: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none">
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-28 h-28 grid place-items-center">
          {[0, 0.7, 1.4].map(d => <span key={d} aria-hidden className="absolute inset-0 rounded-full animate-ping" style={{ border: '1.5px solid color-mix(in srgb, var(--theme-text) 28%, transparent)', animationDuration: '2.1s', animationDelay: `${d}s` }} />)}
          <img src={characterAvatarUrl(CHARACTER[id])} alt="" className="relative w-24 h-24 rounded-full object-cover" style={{ boxShadow: '0 0 0 3px var(--theme-bg), 0 0 0 4px color-mix(in srgb, var(--theme-text) 18%, transparent)' }} />
        </div>
        <div className="text-center">
          <p className="text-[17px] font-medium leading-tight" style={{ color: 'var(--theme-text)' }}>{name}</p>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>Chamando…</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Palco do tutor como no app: um único personagem. Ao trocar de tutor (e na primeira vez), aparece a
 * ligação de 3 s do próprio avatar ("Chamando Luck…", foto num círculo com ondas) e depois ele, animado.
 * Nada de retrato pintado no meio: era isso que fazia "uma imagem pequena virar o tutor".
 * Sem WebGL ou com movimento reduzido: retrato de reserva.
 */
export function CallingTutor({ id, name, playing = true }: { id: string; name: string; playing?: boolean }) {
  const live = useMemo(canRunLive, [])
  const [failed, setFailed] = useState(false)
  const [visible, setVisible] = useState(false)
  const reduce = useReducedMotion()
  const beat = useScript(id, playing && !reduce && (visible || !live || failed))
  useEffect(() => { setVisible(false); setFailed(false) }, [id])
  // Rede lenta ou contexto perdido nunca deixam o site preso em ‘Chamando’.
  useEffect(() => {
    if (!live || failed || visible) return
    const timer = window.setTimeout(() => setFailed(true), 20000)
    return () => window.clearTimeout(timer)
  }, [id, live, failed, visible])
  const bubble = <div className="absolute top-[7%] inset-x-0 flex justify-center pointer-events-none"><Bubble text={beat.line} tail="center" className="max-w-[60%] text-center" /></div>
  if (!live || failed) {
    return (
      <div className="absolute inset-0">
        <div className="site-call-fallback absolute inset-0 flex items-end justify-center pointer-events-none"><BreathingTutor key={id} id={id} className="h-[76%]" smile={['happy', 'laughing', 'excited', 'wink'].includes(beat.mood)} /></div>
        {bubble}
      </div>
    )
  }
  return (
    <div className="absolute inset-0 site-call">
      <Suspense fallback={<CallPlaceholder id={id} name={name} />}>
        <LivLivAvatar key={id} characterId={CHARACTER[id]} stage callOnMount state={beat.state} mood={beat.mood} wave={!!beat.wave}
          followPointer={false} onFail={() => setFailed(true)} onReady={setVisible} />
      </Suspense>
      {visible && bubble}
    </div>
  )
}
