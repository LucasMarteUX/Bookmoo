// Motor de conversa por voz, mãos-livres (como o modo de voz dos assistentes): depois de começar, ele fica
// ouvindo; quando a pessoa para de falar ele espera o silêncio, toca uma fala-ponte, responde e volta a ouvir.
// Dá para interromper a IA falando por cima. A pausa de fim de fala se adapta a quem fala devagar.
// Sem API de voz em tempo real: reconhecimento de fala do aparelho + IA de texto + voz Kokoro/VoiceStudio/navegador.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createRecognizer, defaultEngine, MicPermissionError, type Recognizer } from '@/lib/speech/recognizers'
import { speak, stopSpeaking } from '@/lib/tts'
import { isMobileDevice } from '@/lib/deviceVoice'

// Celular: o microfone fica fechado enquanto o tutor fala. Com ele aberto, o iPhone silencia ou abafa a voz do aparelho
// (sessão de áudio de gravação) e o som da própria voz no alto-falante disparava a interrupção. Volta a abrir para ouvir.
const MOBILE = isMobileDevice()
import { activeKokoroVoice, getKokoroState, kokoroAudioUrl } from '@/lib/kokoro/engine'
import { getKokoroVoice } from '@/lib/kokoro/voices'
import { pickFiller } from '../../supabase/functions/_shared/scenes'
import { boundaryClock, clearSpeechClock, setSpeechClock } from '@/lib/speechClock'
import { getSpeakerVoice, resolveSpeakerVoice } from '@/lib/speakerVoice'

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
export type Bubble = { id: number; role: 'user' | 'ai'; text: string; pending?: boolean }

const SPEECH_RMS_MIN = 0.01
const BARGE_RMS = 0.075
const BARGE_MS = 380
// Quem está aprendendo pausa para pensar no meio da frase: a espera de fim de fala começa generosa.
const START_SILENCE = 1800
const MIN_SILENCE = 1400
const MAX_SILENCE = 3400
// Frase que termina "pendurada" (and, the, because…) quase nunca acabou: espera mais.
const DANGLING = /\b(and|or|but|so|because|the|a|an|to|of|in|on|at|for|with|my|your|his|her|their|our|is|are|was|were|i|i'm|i am|it's|that|this|if|when|then|like|very|um+|uh+|e|o|a|de|que|um|uma|mas|porque)\s*$/i
const RESUME_MS = 260
const IDLE_MS = 45_000
const MAX_UTTERANCE_MS = 40_000

/** Voz instalada que combina com o gênero do personagem (senão, a voz ativa). */
export function voiceForGender(gender: 'female' | 'male' | undefined): string | undefined {
  if (!gender) return undefined
  const installed = getKokoroState().voices
  return installed.find(id => getKokoroVoice(id)?.gender === gender)
}

/** O aparelho tem alguma voz em português? (null enquanto a lista de vozes ainda não carregou) */
export function hasPortugueseVoice(): boolean | null {
  const list = window.speechSynthesis?.getVoices() ?? []
  if (!window.speechSynthesis) return false
  if (!list.length) return null
  return list.some(v => /^pt/i.test(v.lang))
}

/** Melhor voz pt-BR do aparelho (o Kokoro no navegador só fala inglês). */
function ptVoice(gender?: 'female' | 'male') {
  const voices = window.speechSynthesis?.getVoices() ?? []
  const br = voices.filter(v => /^pt(-|_)BR/i.test(v.lang))
  const pool = br.length ? br : voices.filter(v => /^pt/i.test(v.lang))
  const female = /luciana|francisca|thalita|vitoria|vitória|maria|female|feminina/i
  const male = /daniel|antonio|antônio|felipe|male|masculina/i
  const good = /natural|premium|enhanced|neural|google/i
  const byGender = pool.filter(v => (gender === 'male' ? male : female).test(v.name))
  return (byGender.find(v => good.test(v.name)) ?? byGender[0] ?? pool.find(v => good.test(v.name)) ?? pool[0]) || null
}

/** Riso escrito vira riso falado: "kkk", "rsrs", "lol" e emojis de riso saem como "Haha!" na voz (o texto na tela não muda). */
function vocalize(text: string) {
  return text
    .replace(/\bk{3,}\b/gi, 'Haha!')
    .replace(/\b(rs){2,}\b/gi, 'Haha!')
    .replace(/\blol\b/gi, 'Haha!')
    .replace(/(😂|🤣)+/g, ' Haha! ')
    .replace(/\s{2,}/g, ' ').trim()
}

/** Voz da fala: a do personagem na tela (gênero e tom dele), senão a do gênero da cena. */
function speakerFor(gender?: 'female' | 'male'): { voice?: string; gender?: 'female' | 'male'; pitch: number } {
  const sp = getSpeakerVoice()
  if (sp) return { voice: resolveSpeakerVoice(sp), gender: sp.gender, pitch: sp.pitch }
  return { voice: voiceForGender(gender), gender, pitch: 1 }
}

async function say(text: string, rate: number, alive: () => boolean, voice?: string, lang: 'en' | 'pt' = 'en', gender?: 'female' | 'male', pitch = 1): Promise<void> {
  if (!alive() || !text.trim()) return
  // Inglês: sempre pela camada de voz (Kokoro baixada, servidor ou, sem nenhuma, a voz do aparelho com gênero e tom do personagem).
  if (lang === 'en') {
    const h = await speak(text, { rate, context: 'phrase', kokoroVoice: voice, pitch, gender })
    await h.done
    return
  }
  // Português sem voz em português no aparelho: não lê com sotaque inglês; o texto aparece nas legendas.
  if (lang === 'pt' && hasPortugueseVoice() === false) { await new Promise(r => setTimeout(r, Math.min(2500, text.length * 45))); return }
  await new Promise<void>(resolve => {
    const synth = window.speechSynthesis
    if (!synth) { resolve(); return }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === 'pt' ? 'pt-BR' : 'en-US'
    u.rate = lang === 'pt' ? Math.min(1.1, rate + 0.08) : rate
    u.pitch = Math.max(0.5, Math.min(2, pitch))
    const bc = boundaryClock(text, rate)
    setSpeechClock(bc.clock)
    u.onstart = () => bc.start()
    u.onboundary = e => bc.boundary(e.charIndex)
    const voices = synth.getVoices()
    const voice = lang === 'pt' ? ptVoice(gender) : voices.find(v => /en(-|_)US/i.test(v.lang) && /natural|premium|enhanced|samantha|google/i.test(v.name)) ?? voices.find(v => /^en/i.test(v.lang))
    if (voice) u.voice = voice
    u.onend = () => { bc.end(); clearSpeechClock(bc.clock); resolve() }
    u.onerror = () => { bc.end(); clearSpeechClock(bc.clock); resolve() }
    synth.speak(u)
  })
}

function warm(text: string) {
  const voice = activeKokoroVoice()
  if (voice) void kokoroAudioUrl(text, voice, 1, 'low').catch(() => {})
}

export function splitSentences(text: string) {
  return text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s+/).filter(Boolean)
}

export type SpokenSegment = { lang: 'en' | 'pt'; text: string }
export type TurnResult = { reply: string; extra?: Record<string, unknown>; segments?: SpokenSegment[] | null }

export function useVoiceConversation(opts: {
  onTurn: (text: string, filler: string | null) => Promise<TurnResult>
  onExtra?: (extra: Record<string, unknown>) => void
  onError?: (code: string) => void
  onIdle?: () => void
  fillers?: string[]
  keywords?: string[]
  /** Volta a ouvir sozinho depois de responder (mãos-livres). */
  continuous?: boolean
  /** Velocidade da voz da IA (0.8 lenta · 0.95 natural · 1.1 rápida). */
  rate?: number
  /** Permite interromper a IA falando por cima. */
  bargeIn?: boolean
  /** Gênero da voz do personagem. */
  gender?: 'female' | 'male'
}) {
  const [state, setState] = useState<VoiceState>('idle')
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [interim, setInterim] = useState('')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [speakingText, setSpeakingText] = useState('')
  const optsRef = useRef(opts)
  optsRef.current = opts

  const active = useRef(false)
  const stateRef = useRef<VoiceState>('idle')
  const rec = useRef<Recognizer | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const ctx = useRef<AudioContext | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const raf = useRef<number | null>(null)
  const rms = useRef(0)
  const speakToken = useRef(0)
  const silenceMs = useRef(START_SILENCE)
  const noiseFloor = useRef(0.006)
  const speechRms = () => Math.max(SPEECH_RMS_MIN, noiseFloor.current * 3)
  // Turno ainda sem resposta falada: se a pessoa continua falando, junta com o que ela já disse.
  const resumable = useRef<{ text: string; userId: number; aiId: number } | null>(null)
  const pendingPrefix = useRef('')
  const resumeSince = useRef(0)
  const recentFillers = useRef<string[]>([])
  const idSeq = useRef(0)
  const metrics = useRef({ words: 0, speechMs: 0, responseMs: [] as number[], unclear: 0, aiEndedAt: 0 })
  const bargeSince = useRef(0)
  const listenRef = useRef<() => Promise<void>>(async () => {})

  const set = (s: VoiceState) => { stateRef.current = s; setState(s) }
  const push = (b: Omit<Bubble, 'id'>) => {
    const id = ++idSeq.current
    setBubbles(prev => [...prev.slice(-40), { ...b, id }])
    return id
  }
  const patch = (id: number, p: Partial<Bubble>) => setBubbles(prev => prev.map(b => (b.id === id ? { ...b, ...p } : b)))

  const resumeTurn = () => {
    const r = resumable.current
    if (!r || !active.current) return
    resumable.current = null
    speakToken.current++
    stopSpeaking()
    window.speechSynthesis?.cancel()
    setBubbles(prev => prev.filter(b => b.id !== r.userId && b.id !== r.aiId))
    pendingPrefix.current = r.text
    setSpeakingText('')
    void listenRef.current()
  }

  /** Microfone aberto a sessão inteira: anima o orbe e detecta quando a pessoa fala por cima da IA. */
  const openMic = useCallback(async () => {
    if (stream.current) return
    stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    ctx.current = new AudioContext()
    const src = ctx.current.createMediaStreamSource(stream.current)
    analyser.current = ctx.current.createAnalyser()
    analyser.current.fftSize = 1024
    src.connect(analyser.current)
    const buf = new Float32Array(analyser.current.fftSize)
    let t = 0
    const loop = () => {
      if (!analyser.current) return
      analyser.current.getFloatTimeDomainData(buf)
      let sum = 0
      for (const v of buf) sum += v * v
      rms.current = Math.sqrt(sum / buf.length)
      // Ruído de fundo: sobe devagar e desce rápido (acompanha o ambiente sem confundir com voz).
      noiseFloor.current = rms.current < noiseFloor.current ? noiseFloor.current * 0.9 + rms.current * 0.1 : noiseFloor.current * 0.998 + rms.current * 0.002
      const st = stateRef.current
      // A pessoa continuou falando enquanto a IA pensava (ou na fala-ponte): era a mesma frase.
      if (resumable.current && (st === 'thinking' || st === 'speaking')) {
        const loud = st === 'thinking' ? rms.current > speechRms() * 1.4 : rms.current > BARGE_RMS
        if (loud) {
          if (!resumeSince.current) resumeSince.current = performance.now()
          else if (performance.now() - resumeSince.current > RESUME_MS) { resumeSince.current = 0; resumeTurn() }
        } else resumeSince.current = 0
      }
      if (st === 'listening') setLevel(Math.min(1, rms.current * 9))
      else if (st === 'speaking') { t++; setLevel(0.35 + 0.28 * Math.abs(Math.sin(t / 7)) + Math.random() * 0.12) }
      else setLevel(l => l * 0.85)
      // Interrupção: a pessoa falou alto o bastante, por tempo suficiente, enquanto a IA falava.
      if (st === 'speaking' && !resumable.current && optsRef.current.bargeIn !== false && !MOBILE) {
        if (rms.current > BARGE_RMS) {
          if (!bargeSince.current) bargeSince.current = performance.now()
          else if (performance.now() - bargeSince.current > BARGE_MS) {
            bargeSince.current = 0
            speakToken.current++
            stopSpeaking()
            window.speechSynthesis?.cancel()
            if (active.current) void listenRef.current()
          }
        } else bargeSince.current = 0
      }
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
  }, [])

  const closeMic = () => {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = null
    stream.current?.getTracks().forEach(t => t.stop())
    stream.current = null
    analyser.current = null
    void ctx.current?.close().catch(() => {})
    ctx.current = null
  }

  const speakReply = useCallback(async (reply: string, segments?: SpokenSegment[] | null) => {
    const token = ++speakToken.current
    const alive = () => token === speakToken.current && active.current
    // Fala por trechos de idioma: inglês na voz Kokoro, português na voz pt-BR do aparelho.
    const parts = (segments?.length ? segments : [{ lang: 'en' as const, text: reply }])
      .flatMap(seg => splitSentences(seg.text).map(text => ({ lang: seg.lang, text })))
    parts.slice(1).filter(p => p.lang === 'en').forEach(p => warm(vocalize(p.text)))
    resumable.current = null
    if (MOBILE) closeMic()
    set('speaking')
    for (const p of parts) {
      if (!alive()) return false
      setSpeakingText(p.text)
      // Lido a cada frase: trocar de personagem no meio da conversa já muda a próxima fala.
      const sp = speakerFor(optsRef.current.gender)
      await say(vocalize(p.text), optsRef.current.rate ?? 0.95, alive, sp.voice, p.lang, sp.gender, sp.pitch)
    }
    setSpeakingText('')
    metrics.current.aiEndedAt = performance.now()
    return alive()
  }, [])

  const handleUtterance = useCallback(async (text: string) => {
    const o = optsRef.current
    const filler = pickFiller(text, { persona: o.fillers, keywords: o.keywords, recent: recentFillers.current })
    if (filler) recentFillers.current = [...recentFillers.current.slice(-5), filler]
    const userId = push({ role: 'user', text })
    const aiId = push({ role: 'ai', text: filler ?? '', pending: true })
    const token = ++speakToken.current
    resumable.current = { text, userId, aiId }
    const alive = () => token === speakToken.current && active.current
    set(filler ? 'speaking' : 'thinking')
    if (filler) setSpeakingText(filler)
    const fsp = speakerFor(o.gender)
    if (MOBILE) { resumable.current = null; closeMic() }
    const fillerDone = filler ? say(filler, o.rate ?? 0.95, alive, fsp.voice, 'en', fsp.gender, fsp.pitch) : Promise.resolve()
    const turn = o.onTurn(text, filler)
    try {
      await fillerDone
      if (alive() && filler) set('thinking')
      const { reply, extra, segments } = await turn
      if (!active.current || token !== speakToken.current) return
      patch(aiId, { text: filler ? `${filler} ${reply}` : reply, pending: false })
      if (extra) o.onExtra?.(extra)
      if (token !== speakToken.current) return // a pessoa já interrompeu: segue ouvindo
      const finished = await speakReply(reply, segments)
      if (!finished) return
    } catch (e) {
      if (token !== speakToken.current) return // turno cancelado porque a pessoa continuou falando
      resumable.current = null
      const code = (e as { code?: string }).code ?? 'request_failed'
      patch(aiId, { text: filler ?? '', pending: false })
      setError(code)
      o.onError?.(code)
      active.current = false
      set('error')
      return
    }
    if (!active.current) return
    if (o.continuous) void listenRef.current()
    else set('idle')
  }, [speakReply])

  const listen = useCallback(async () => {
    setError(null)
    const engine = defaultEngine(false)
    if (!engine) { setError('no_speech_engine'); set('error'); return }
    active.current = true
    try { await openMic() } catch (e) {
      setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'mic_denied' : 'mic_failed'); set('error'); active.current = false; return
    }
    try { rec.current?.abort() } catch { /* ignore */ }
    const prefix = pendingPrefix.current
    pendingPrefix.current = ''
    setInterim(prefix)
    let text = ''
    let heardAt = 0
    let lastVoice = 0
    let lastChange = performance.now()
    let pausedAt = 0
    const startedAt = performance.now()
    const r = createRecognizer(engine, { onTranscript: t => { text = t; setInterim(prefix ? `${prefix} ${t}` : t); lastChange = performance.now(); if (!heardAt) heardAt = lastChange } })
    rec.current = r
    try { await r.start() } catch (e) {
      setError(e instanceof MicPermissionError ? 'mic_denied' : 'mic_failed'); set('error'); active.current = false; return
    }
    set('listening')
    let finished = false
    const finish = async () => {
      if (finished) return
      finished = true
      window.clearInterval(iv)
      let out = text
      try { out = (await r.stop()).text || text } catch { /* usa o parcial */ }
      if (rec.current === r) rec.current = null
      setInterim('')
      out = `${prefix} ${out}`.trim()
      if (!active.current || stateRef.current !== 'listening') return
      if (!out) {
        if (!heardAt) { active.current = false; set('idle'); optsRef.current.onIdle?.(); return }
        metrics.current.unclear++
        void listenRef.current()
        return
      }
      // Ninguém retomou a fala no meio: aos poucos volta a responder um pouco mais rápido.
      silenceMs.current = Math.max(MIN_SILENCE, silenceMs.current - 40)
      const m = metrics.current
      m.words += out.split(/\s+/).length
      if (heardAt) m.speechMs += Math.max(500, performance.now() - heardAt - silenceMs.current)
      if (m.aiEndedAt && heardAt) m.responseMs.push(Math.max(0, heardAt - m.aiEndedAt))
      await handleUtterance(out)
    }
    const iv = window.setInterval(() => {
      if (!active.current || stateRef.current !== 'listening') { window.clearInterval(iv); return }
      const now = performance.now()
      if (rms.current > speechRms()) {
        // Voltou a falar depois de uma pausa: esta pessoa pausa no meio da frase → espera mais da próxima vez.
        if (pausedAt && now - pausedAt > 500) silenceMs.current = Math.min(MAX_SILENCE, silenceMs.current + 250)
        pausedAt = 0
        lastVoice = now
        if (!heardAt) heardAt = now
      } else if (lastVoice && !pausedAt) pausedAt = now
      const quietFor = now - Math.max(lastVoice, lastChange)
      const heard = heardAt > 0 && (text.trim().length > 0 || engine === 'whisper')
      const wait = silenceMs.current + (DANGLING.test(text.trim()) ? 1100 : 0)
      if ((heard && quietFor > wait) || (!heardAt && now - startedAt > IDLE_MS) || now - startedAt > MAX_UTTERANCE_MS) void finish()
    }, 100)
  }, [handleUtterance, openMic])
  listenRef.current = listen

  /** Começa a sessão mãos-livres (precisa de um toque por causa do microfone). */
  const start = useCallback(async (opening?: string) => {
    active.current = true
    try { await openMic() } catch (e) {
      setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'mic_denied' : 'mic_failed'); set('error'); active.current = false; return
    }
    if (opening) {
      push({ role: 'ai', text: opening })
      const finished = await speakReply(opening)
      if (!finished && !active.current) return
    }
    if (active.current && stateRef.current !== 'listening') void listen()
  }, [listen, openMic, speakReply])

  /** Pausa: fecha o microfone e para a voz. */
  const stop = useCallback(() => {
    active.current = false
    resumable.current = null
    pendingPrefix.current = ''
    speakToken.current++
    try { rec.current?.abort() } catch { /* ignore */ }
    rec.current = null
    closeMic()
    stopSpeaking()
    window.speechSynthesis?.cancel()
    setInterim('')
    setLevel(0)
    set('idle')
  }, [])

  /** Mensagem escrita (chat por texto): mesma conversa, sem microfone. A resposta chega como texto; com `speak`, também é
   *  falada pela voz do personagem. Se uma chamada estiver aberta, ela é encerrada antes. */
  const ask = useCallback(async (text: string, speak = false) => {
    const msg = text.trim()
    if (!msg) return
    if (active.current) stop()
    const o = optsRef.current
    push({ role: 'user', text: msg })
    const aiId = push({ role: 'ai', text: '', pending: true })
    set('thinking')
    try {
      const { reply, extra, segments } = await o.onTurn(msg, null)
      patch(aiId, { text: reply, pending: false })
      if (extra) o.onExtra?.(extra)
      if (speak) {
        active.current = true
        await speakReply(reply, segments)
        active.current = false
      }
      set('idle')
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'request_failed'
      patch(aiId, { text: '', pending: false })
      setBubbles(prev => prev.filter(b => b.id !== aiId))
      setError(code)
      o.onError?.(code)
      set('error')
    }
  }, [speakReply, stop])

  const preload = useCallback((phrases: string[]) => phrases.forEach(warm), [])

  const getMetrics = () => {
    const m = metrics.current
    return {
      wpm: m.speechMs > 0 ? m.words / (m.speechMs / 60000) : 0,
      avgResponseMs: m.responseMs.length ? m.responseMs.reduce((a, x) => a + x, 0) / m.responseMs.length : 0,
      unclear: m.unclear,
    }
  }

  useEffect(() => () => { stop() }, [stop])

  return { state, bubbles, interim, level, error, speakingText, start, listen, stop, ask, preload, getMetrics, setBubbles, active: () => active.current }
}
