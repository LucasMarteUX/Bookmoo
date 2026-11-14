// Motor de conversa por voz, mãos-livres (como o modo de voz dos assistentes): depois de começar, ele fica
// ouvindo; quando a pessoa para de falar ele espera o silêncio, toca uma fala-ponte, responde e volta a ouvir.
// Dá para interromper a IA falando por cima. A pausa de fim de fala se adapta a quem fala devagar.
// Sem API de voz em tempo real: reconhecimento de fala do aparelho + IA de texto + voz Kokoro/VoiceStudio/navegador.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createRecognizer, defaultEngine, MicPermissionError, type Recognizer } from '@/lib/speech/recognizers'
import { isTtsConfigured, speak, stopSpeaking } from '@/lib/tts'
import { activeKokoroVoice, kokoroAudioUrl } from '@/lib/kokoro/engine'
import { pickFiller } from '../../supabase/functions/_shared/scenes'

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
export type Bubble = { id: number; role: 'user' | 'ai'; text: string; pending?: boolean }

const SPEECH_RMS = 0.022
const BARGE_RMS = 0.075
const BARGE_MS = 380
const MIN_SILENCE = 1100
const MAX_SILENCE = 2300
const IDLE_MS = 45_000
const MAX_UTTERANCE_MS = 40_000

async function say(text: string, rate: number, alive: () => boolean): Promise<void> {
  if (!alive() || !text.trim()) return
  if (activeKokoroVoice() || isTtsConfigured()) {
    const h = await speak(text, { rate, context: 'phrase' })
    await h.done
    return
  }
  await new Promise<void>(resolve => {
    const synth = window.speechSynthesis
    if (!synth) { resolve(); return }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = rate
    const voices = synth.getVoices()
    const voice = voices.find(v => /en(-|_)US/i.test(v.lang) && /natural|premium|enhanced|samantha|google/i.test(v.name)) ?? voices.find(v => /^en/i.test(v.lang))
    if (voice) u.voice = voice
    u.onend = () => resolve()
    u.onerror = () => resolve()
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

export type TurnResult = { reply: string; extra?: Record<string, unknown> }

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
}) {
  const [state, setState] = useState<VoiceState>('idle')
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [interim, setInterim] = useState('')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
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
  const silenceMs = useRef(1400)
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
      const st = stateRef.current
      if (st === 'listening') setLevel(Math.min(1, rms.current * 9))
      else if (st === 'speaking') { t++; setLevel(0.35 + 0.28 * Math.abs(Math.sin(t / 7)) + Math.random() * 0.12) }
      else setLevel(l => l * 0.85)
      // Interrupção: a pessoa falou alto o bastante, por tempo suficiente, enquanto a IA falava.
      if (st === 'speaking' && optsRef.current.bargeIn !== false) {
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

  const speakReply = useCallback(async (reply: string) => {
    const token = ++speakToken.current
    const alive = () => token === speakToken.current && active.current
    const sentences = splitSentences(reply)
    sentences.slice(1).forEach(warm)
    set('speaking')
    for (const s of sentences) {
      if (!alive()) return false
      await say(s, optsRef.current.rate ?? 0.95, alive)
    }
    metrics.current.aiEndedAt = performance.now()
    return alive()
  }, [])

  const handleUtterance = useCallback(async (text: string) => {
    const o = optsRef.current
    const filler = pickFiller(text, { persona: o.fillers, keywords: o.keywords, recent: recentFillers.current })
    if (filler) recentFillers.current = [...recentFillers.current.slice(-5), filler]
    push({ role: 'user', text })
    const aiId = push({ role: 'ai', text: filler ?? '', pending: true })
    const token = ++speakToken.current
    const alive = () => token === speakToken.current && active.current
    set(filler ? 'speaking' : 'thinking')
    const fillerDone = filler ? say(filler, o.rate ?? 0.95, alive) : Promise.resolve()
    const turn = o.onTurn(text, filler)
    try {
      await fillerDone
      if (alive() && filler) set('thinking')
      const { reply, extra } = await turn
      if (!active.current) return
      patch(aiId, { text: filler ? `${filler} ${reply}` : reply, pending: false })
      if (extra) o.onExtra?.(extra)
      if (token !== speakToken.current) return // a pessoa já interrompeu: segue ouvindo
      const finished = await speakReply(reply)
      if (!finished) return
    } catch (e) {
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
    setInterim('')
    let text = ''
    let heardAt = 0
    let lastVoice = 0
    let lastChange = performance.now()
    let pausedAt = 0
    const startedAt = performance.now()
    const r = createRecognizer(engine, { onTranscript: t => { text = t; setInterim(t); lastChange = performance.now(); if (!heardAt) heardAt = lastChange } })
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
      out = out.trim()
      if (!active.current || stateRef.current !== 'listening') return
      if (!out) {
        if (!heardAt) { active.current = false; set('idle'); optsRef.current.onIdle?.(); return }
        metrics.current.unclear++
        void listenRef.current()
        return
      }
      // Ninguém retomou a fala no meio: aos poucos volta a responder mais rápido.
      silenceMs.current = Math.max(MIN_SILENCE, silenceMs.current - 60)
      const m = metrics.current
      m.words += out.split(/\s+/).length
      if (heardAt) m.speechMs += Math.max(500, performance.now() - heardAt - silenceMs.current)
      if (m.aiEndedAt && heardAt) m.responseMs.push(Math.max(0, heardAt - m.aiEndedAt))
      await handleUtterance(out)
    }
    const iv = window.setInterval(() => {
      if (!active.current || stateRef.current !== 'listening') { window.clearInterval(iv); return }
      const now = performance.now()
      if (rms.current > SPEECH_RMS) {
        // Voltou a falar depois de uma pausa: esta pessoa pausa no meio da frase → espera mais da próxima vez.
        if (pausedAt && now - pausedAt > 500) silenceMs.current = Math.min(MAX_SILENCE, silenceMs.current + 180)
        pausedAt = 0
        lastVoice = now
        if (!heardAt) heardAt = now
      } else if (lastVoice && !pausedAt) pausedAt = now
      const quietFor = now - Math.max(lastVoice, lastChange)
      const heard = heardAt > 0 && (text.trim().length > 0 || engine === 'whisper')
      if ((heard && quietFor > silenceMs.current) || (!heardAt && now - startedAt > IDLE_MS) || now - startedAt > MAX_UTTERANCE_MS) void finish()
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

  return { state, bubbles, interim, level, error, start, listen, stop, preload, getMetrics, setBubbles, active: () => active.current }
}
