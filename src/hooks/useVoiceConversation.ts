// Motor de conversa por voz turno a turno (Cenas, tutor livre, Tutor de leitura).
// Ouve → detecta o fim da fala → toca uma fala-ponte pronta na hora → manda o texto (com a ponte) para a IA
// → fala a resposta frase a frase → volta a ouvir. Sem API de voz em tempo real: usa o reconhecimento
// de fala do aparelho (Web Speech / Whisper local) e a voz baixada (Kokoro), o VoiceStudio ou a do navegador.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createRecognizer, defaultEngine, MicPermissionError, type Recognizer } from '@/lib/speech/recognizers'
import { isTtsConfigured, speak, stopSpeaking } from '@/lib/tts'
import { activeKokoroVoice, kokoroAudioUrl } from '@/lib/kokoro/engine'
import { pickFiller } from '../../supabase/functions/_shared/scenes'

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
export type Bubble = { id: number; role: 'user' | 'ai'; text: string; pending?: boolean }

const SILENCE_MS = 900
const SPEECH_RMS = 0.025
const MAX_UTTERANCE_MS = 30_000

/** Fala com a voz instalada; sem voz baixada nem VoiceStudio, usa a voz do navegador (sempre há resposta). */
async function say(text: string, rate: number, signal: { cancelled: boolean }): Promise<void> {
  if (signal.cancelled || !text.trim()) return
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
    const voice = synth.getVoices().find(v => /en(-|_)US/i.test(v.lang) && /natural|premium|enhanced|samantha|google/i.test(v.name)) ?? synth.getVoices().find(v => /^en/i.test(v.lang))
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
  /** Manda a fala do aluno (com a ponte já dita) e devolve a resposta da IA. */
  onTurn: (text: string, filler: string | null) => Promise<TurnResult>
  onExtra?: (extra: Record<string, unknown>) => void
  onError?: (code: string) => void
  /** Fillers do personagem e palavras-chave da cena (para o eco). */
  fillers?: string[]
  keywords?: string[]
  /** Depois de responder, volta a ouvir sozinho. */
  continuous?: boolean
  rate?: number
  onIdle?: () => void
}) {
  const [state, setState] = useState<VoiceState>('idle')
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [interim, setInterim] = useState('')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts

  const rec = useRef<Recognizer | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const ctx = useRef<AudioContext | null>(null)
  const raf = useRef<number | null>(null)
  const cancel = useRef({ cancelled: false })
  const recentFillers = useRef<string[]>([])
  const active = useRef(false)
  const idSeq = useRef(0)
  const metrics = useRef({ words: 0, speechMs: 0, responseMs: [] as number[], unclear: 0, aiEndedAt: 0 })
  const speakPulse = useRef<number | null>(null)

  const push = (b: Omit<Bubble, 'id'>) => {
    const id = ++idSeq.current
    setBubbles(prev => [...prev.slice(-40), { ...b, id }])
    return id
  }
  const patch = (id: number, p: Partial<Bubble>) => setBubbles(prev => prev.map(b => (b.id === id ? { ...b, ...p } : b)))

  const stopMeter = () => {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = null
    stream.current?.getTracks().forEach(t => t.stop())
    stream.current = null
    void ctx.current?.close().catch(() => {})
    ctx.current = null
  }

  const pulse = (on: boolean) => {
    if (speakPulse.current) window.clearInterval(speakPulse.current)
    speakPulse.current = null
    if (on) {
      let t = 0
      speakPulse.current = window.setInterval(() => { t += 1; setLevel(0.35 + 0.3 * Math.abs(Math.sin(t / 2.3)) + Math.random() * 0.2) }, 90)
    } else setLevel(0)
  }

  /** Fala uma resposta frase a frase (a primeira sai logo; as outras já vão sendo preparadas). */
  const speakReply = useCallback(async (reply: string) => {
    const sentences = splitSentences(reply)
    sentences.slice(1).forEach(warm)
    setState('speaking')
    pulse(true)
    for (const s of sentences) {
      if (cancel.current.cancelled) break
      await say(s, optsRef.current.rate ?? 1, cancel.current)
    }
    pulse(false)
    metrics.current.aiEndedAt = performance.now()
  }, [])

  const handleUtterance = useCallback(async (text: string) => {
    const o = optsRef.current
    const filler = pickFiller(text, { persona: o.fillers, keywords: o.keywords, recent: recentFillers.current })
    if (filler) recentFillers.current = [...recentFillers.current.slice(-5), filler]
    push({ role: 'user', text })
    const aiId = push({ role: 'ai', text: filler ?? '', pending: true })
    setState(filler ? 'speaking' : 'thinking')
    if (filler) pulse(true)
    // A ponte toca enquanto a IA pensa; a resposta continua a partir dela.
    const fillerDone = filler ? say(filler, o.rate ?? 1, cancel.current) : Promise.resolve()
    const turn = o.onTurn(text, filler)
    try {
      await fillerDone
      if (filler) { pulse(false); if (!cancel.current.cancelled) setState('thinking') }
      const { reply, extra } = await turn
      if (cancel.current.cancelled) return
      patch(aiId, { text: filler ? `${filler} ${reply}` : reply, pending: false })
      if (extra) o.onExtra?.(extra)
      await speakReply(reply)
    } catch (e) {
      pulse(false)
      const code = (e as { code?: string }).code ?? 'request_failed'
      patch(aiId, { text: filler ?? '', pending: false })
      setError(code)
      o.onError?.(code)
      active.current = false
      setState('error')
      return
    }
    if (cancel.current.cancelled) return
    if (o.continuous && active.current) void listen()
    else setState('idle')
  }, [speakReply])

  const listen = useCallback(async () => {
    setError(null)
    const engine = defaultEngine(false)
    if (!engine) { setError('no_speech_engine'); setState('error'); return }
    cancel.current = { cancelled: false }
    active.current = true
    setInterim('')
    let lastChange = performance.now()
    let heardAt = 0
    let lastVoice = 0
    const startedAt = performance.now()
    let text = ''
    const r = createRecognizer(engine, { onTranscript: t => { text = t; setInterim(t); lastChange = performance.now(); if (!heardAt) heardAt = lastChange } })
    rec.current = r
    try {
      await r.start()
    } catch (e) {
      setError(e instanceof MicPermissionError ? 'mic_denied' : 'mic_failed')
      setState('error')
      active.current = false
      return
    }
    setState('listening')
    // Medidor de volume (anel do avatar) + detecção de silêncio.
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      ctx.current = new AudioContext()
      const src = ctx.current.createMediaStreamSource(stream.current)
      const analyser = ctx.current.createAnalyser()
      analyser.fftSize = 1024
      src.connect(analyser)
      const buf = new Float32Array(analyser.fftSize)
      const loop = () => {
        analyser.getFloatTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += v * v
        const rms = Math.sqrt(sum / buf.length)
        setLevel(Math.min(1, rms * 8))
        const now = performance.now()
        if (rms > SPEECH_RMS) { lastVoice = now; if (!heardAt) heardAt = now }
        const quietFor = now - Math.max(lastVoice, lastChange)
        const heard = heardAt > 0 && (text.trim().length > 0 || engine === 'whisper')
        if ((heard && quietFor > SILENCE_MS) || now - startedAt > MAX_UTTERANCE_MS) { void finish(); return }
        raf.current = requestAnimationFrame(loop)
      }
      raf.current = requestAnimationFrame(loop)
    } catch {
      // Sem medidor: encerra pela estabilidade da transcrição.
      const iv = window.setInterval(() => {
        if (!active.current) { window.clearInterval(iv); return }
        if (text.trim() && performance.now() - lastChange > SILENCE_MS + 300) { window.clearInterval(iv); void finish() }
      }, 150)
    }

    let finished = false
    async function finish() {
      if (finished) return
      finished = true
      stopMeter()
      setLevel(0)
      let out = text
      try { out = (await r.stop()).text || text } catch { /* usa o parcial */ }
      rec.current = null
      setInterim('')
      out = out.trim()
      if (!active.current || cancel.current.cancelled) return
      if (!out) {
        // 30 s sem ninguém falar: pausa sozinho (economiza minutos e protege a privacidade).
        if (!heardAt) { active.current = false; setState('idle'); optsRef.current.onIdle?.(); return }
        metrics.current.unclear++
        if (optsRef.current.continuous) void listen()
        else setState('idle')
        return
      }
      const m = metrics.current
      m.words += out.split(/\s+/).length
      if (heardAt) m.speechMs += Math.max(500, performance.now() - heardAt - SILENCE_MS)
      if (m.aiEndedAt && heardAt) m.responseMs.push(Math.max(0, heardAt - m.aiEndedAt))
      await handleUtterance(out)
    }
  }, [handleUtterance])

  /** Para tudo agora (escuta, voz e o que estiver pendente). */
  const stop = useCallback(() => {
    active.current = false
    cancel.current.cancelled = true
    try { rec.current?.abort() } catch { /* ignore */ }
    rec.current = null
    stopMeter()
    pulse(false)
    stopSpeaking()
    window.speechSynthesis?.cancel()
    setInterim('')
    setState('idle')
  }, [])

  /** O personagem fala primeiro (abertura da cena). */
  const aiSays = useCallback(async (text: string, thenListen = true) => {
    cancel.current = { cancelled: false }
    active.current = thenListen
    push({ role: 'ai', text })
    await speakReply(text)
    if (cancel.current.cancelled) return
    if (thenListen) void listen()
    else setState('idle')
  }, [listen, speakReply])

  const preload = useCallback((phrases: string[]) => phrases.forEach(warm), [])

  const getMetrics = () => {
    const m = metrics.current
    return {
      wpm: m.speechMs > 0 ? (m.words / (m.speechMs / 60000)) : 0,
      avgResponseMs: m.responseMs.length ? m.responseMs.reduce((a, x) => a + x, 0) / m.responseMs.length : 0,
      unclear: m.unclear,
    }
  }

  useEffect(() => () => { stop() }, [stop])

  return { state, bubbles, interim, level, error, listen, stop, aiSays, preload, getMetrics, setBubbles }
}
