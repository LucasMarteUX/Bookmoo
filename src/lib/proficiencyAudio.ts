// Áudio da prova de proficiência: tocar uma vez, gravar a fala, testar som e microfone e (no admin) gerar os áudios das
// questões com as vozes do leitor (Kokoro) antes de publicar. Nada é sintetizado enquanto o aluno faz a prova.
import { kokoroAudioUrl } from '@/lib/kokoro/engine'
import { splitIntoSegments } from '@/lib/tts'

let ctx: AudioContext | null = null
function audioCtx() {
  ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Toca um áudio do começo ao fim, sem controles (sem pausar nem voltar). */
export function playOnce(url: string, onProgress?: (fraction: number) => void): { done: Promise<void>; stop: () => void } {
  const el = new Audio()
  el.preload = 'auto'
  el.src = url
  let raf = 0
  const tick = () => { if (el.duration) onProgress?.(Math.min(1, el.currentTime / el.duration)); raf = requestAnimationFrame(tick) }
  const done = new Promise<void>((resolve, reject) => {
    el.onended = () => { cancelAnimationFrame(raf); onProgress?.(1); resolve() }
    el.onerror = () => { cancelAnimationFrame(raf); reject(new Error('audio_error')) }
    el.play().then(() => { raf = requestAnimationFrame(tick) }, reject)
  })
  return { done, stop: () => { cancelAnimationFrame(raf); el.pause(); el.src = '' } }
}

/** Som curto (aviso de que a gravação vai começar e teste de áudio). */
export function beep(freq = 880, ms = 160, gain = 0.12): Promise<void> {
  const c = audioCtx()
  const o = c.createOscillator(), g = c.createGain()
  o.type = 'sine'; o.frequency.value = freq
  g.gain.setValueAtTime(0, c.currentTime)
  g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.015)
  g.gain.linearRampToValueAtTime(0, c.currentTime + ms / 1000)
  o.connect(g).connect(c.destination)
  o.start(); o.stop(c.currentTime + ms / 1000 + 0.02)
  return new Promise(r => setTimeout(r, ms + 40))
}

/** Teste de som: três notas. */
export async function testChime() {
  await beep(523, 180); await beep(659, 180); await beep(784, 260)
}

// ---------------------------------------------------------------------------------------------------------------------
// Gravação
let stream: MediaStream | null = null
export async function micStream(): Promise<MediaStream> {
  if (stream && stream.getAudioTracks().some(t => t.readyState === 'live')) return stream
  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
  return stream
}
export function releaseMic() { stream?.getTracks().forEach(t => t.stop()); stream = null }

function recorderMime() {
  const opts = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return opts.find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? ''
}

export type Recording = { blob: Blob; durationMs: number; peak: number }

/** Grava até `maxMs` (ou até chamar stop). `onLevel` recebe o volume (0–1) para o medidor. */
export async function record(maxMs: number, onLevel?: (level: number) => void, onTick?: (msLeft: number) => void): Promise<{ stop: () => void; done: Promise<Recording> }> {
  const s = await micStream()
  const mime = recorderMime()
  const rec = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 48_000 } : undefined)
  const chunks: Blob[] = []
  const c = audioCtx()
  const src = c.createMediaStreamSource(s)
  const an = c.createAnalyser()
  an.fftSize = 512
  src.connect(an)
  const buf = new Uint8Array(an.fftSize)
  let peak = 0, raf = 0
  const t0 = performance.now()
  const loop = () => {
    an.getByteTimeDomainData(buf)
    let sum = 0
    for (const v of buf) { const x = (v - 128) / 128; sum += x * x }
    const level = Math.min(1, Math.sqrt(sum / buf.length) * 4)
    peak = Math.max(peak, level)
    onLevel?.(level)
    onTick?.(Math.max(0, maxMs - (performance.now() - t0)))
    raf = requestAnimationFrame(loop)
  }
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
  const done = new Promise<Recording>(resolve => {
    rec.onstop = () => {
      cancelAnimationFrame(raf); src.disconnect(); onLevel?.(0)
      resolve({ blob: new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' }), durationMs: Math.round(performance.now() - t0), peak })
    }
  })
  rec.start(250)
  raf = requestAnimationFrame(loop)
  const timer = setTimeout(() => { if (rec.state !== 'inactive') rec.stop() }, maxMs)
  return { stop: () => { clearTimeout(timer); if (rec.state !== 'inactive') rec.stop() }, done }
}

// ---------------------------------------------------------------------------------------------------------------------
// Geração dos áudios das questões (admin): Kokoro no navegador, frase por frase, juntando falas com pausas naturais.
type Line = { voice: string; text: string; speaker?: string }

async function decode(blob: Blob): Promise<AudioBuffer> {
  return await audioCtx().decodeAudioData(await blob.arrayBuffer())
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) { const x = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true) }
  return new Blob([buf], { type: 'audio/wav' })
}

/** Sintetiza um roteiro (uma ou mais falas, cada uma com a sua voz) num único WAV mono. */
export async function synthesizeScript(lines: Line[], onProgress?: (done: number, total: number) => void): Promise<{ blob: Blob; durationMs: number }> {
  const parts: { buffer: AudioBuffer; gapAfter: number }[] = []
  const chunks = lines.flatMap((l, li) => splitIntoSegments(l.text, 280).map((t, ci, arr) => ({ voice: l.voice, text: t, gap: ci < arr.length - 1 ? 0.12 : li < lines.length - 1 ? 0.45 : 0 })))
  for (let i = 0; i < chunks.length; i++) {
    const clip = await kokoroAudioUrl(chunks[i].text, chunks[i].voice, 1, 'high')
    const blob = await (await fetch(clip.url)).blob()
    parts.push({ buffer: await decode(blob), gapAfter: chunks[i].gap })
    onProgress?.(i + 1, chunks.length)
  }
  const rate = 24_000
  const total = parts.reduce((n, p) => n + Math.round(p.buffer.duration * rate) + Math.round(p.gapAfter * rate), 0) + Math.round(0.25 * rate)
  const out = new Float32Array(total)
  let at = Math.round(0.25 * rate)
  for (const p of parts) {
    // Reamostra para 24 kHz (o decodificador pode devolver a taxa do aparelho).
    const src = p.buffer.getChannelData(0)
    const ratio = p.buffer.sampleRate / rate
    const n = Math.round(p.buffer.duration * rate)
    for (let i = 0; i < n && at + i < out.length; i++) out[at + i] = src[Math.min(src.length - 1, Math.floor(i * ratio))]
    at += n + Math.round(p.gapAfter * rate)
  }
  return { blob: encodeWav(out, rate), durationMs: Math.round((total / rate) * 1000) }
}
