// De-esser dinâmico split-band para a fala do Kokoro (usado no worker, antes de virar WAV).
// Divide o sinal em grave (x − agudo) e agudo (passa-altas na faixa das sibilantes). Fora das sibilantes o ganho do agudo é 1
// e grave + agudo reconstrói o sinal original exatamente (transparente). Só quando a energia do agudo domina a da fala
// (S, SH, F, Z) o agudo é reduzido, no máximo `maxDb`, com ataque rápido e soltura suave.
// Frequências: quando o personagem toca mais agudo (playbackRate = tom), tudo sobe pelo tom; por isso quem chama passa a
// frequência já dividida pelo tom (ex.: 5,5 kHz audíveis com tom 1,2 = 4,6 kHz no áudio gerado).

export type DeEssOptions = { maxDb: number; hz: number; thresh?: number }

export function deEss(x: Float32Array, fs: number, { maxDb, hz, thresh = 0.3 }: DeEssOptions): Float32Array {
  if (!(maxDb > 0) || hz <= 0 || hz >= fs / 2) return x
  // Passa-altas biquad (RBJ, Butterworth).
  const w0 = (2 * Math.PI * hz) / fs
  const cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * Math.SQRT1_2)
  const a0 = 1 + alpha
  const b0 = (1 + cos) / 2 / a0, b1 = -(1 + cos) / a0, b2 = (1 + cos) / 2 / a0
  const a1 = (-2 * cos) / a0, a2 = (1 - alpha) / a0
  const coef = (ms: number) => Math.exp(-1 / ((ms / 1000) * fs))
  const atk = coef(1), rel = coef(45), gAtk = coef(2), gRel = coef(60)
  const minGain = Math.pow(10, -maxDb / 20)
  const THRESH = thresh // agudo acima dessa fração da energia da fala = sibilante forte
  const FLOOR = 0.004 // abaixo disso é silêncio/respiração: não mexe
  const out = new Float32Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  let envH = 0, envX = 0, g = 1
  let peak = 0
  for (let i = 0; i < x.length; i++) {
    const s = x[i]
    const h = b0 * s + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1; x1 = s; y2 = y1; y1 = h
    const ah = Math.abs(h), ax = Math.abs(s)
    envH = ah > envH ? atk * envH + (1 - atk) * ah : rel * envH + (1 - rel) * ah
    envX = ax > envX ? atk * envX + (1 - atk) * ax : rel * envX + (1 - rel) * ax
    let target = 1
    if (envH > FLOOR && envX > 0) {
      const r = envH / envX
      if (r > THRESH) target = Math.max(minGain, Math.pow(THRESH / r, 2))
    }
    g = target < g ? gAtk * g + (1 - gAtk) * target : gRel * g + (1 - gRel) * target
    const y = (s - h) + h * g
    out[i] = y
    const ay = Math.abs(y)
    if (ay > peak) peak = ay
  }
  // Proteção contra clipping (o WAV é 16 bits).
  if (peak > 0.97) { const k = 0.97 / peak; for (let i = 0; i < out.length; i++) out[i] *= k }
  return out
}

/**
 * Tom do personagem aplicado no próprio áudio: reamostra por `pitch` (mais agudo e mais curto, igual a tocar acelerado sem
 * preservar o tom). Assim o player fica livre para mudar só a velocidade (com tom preservado) e o tom do personagem é o
 * mesmo em qualquer velocidade. Antes de reamostrar, um passa-baixas evita o serrilhado (aliasing) no agudo.
 */
export function pitchUp(x: Float32Array, fs: number, pitch: number): Float32Array {
  if (!(pitch > 1.001)) return x
  const cut = (fs / 2 / pitch) * 0.92
  const w0 = (2 * Math.PI * cut) / fs
  const cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * Math.SQRT1_2), a0 = 1 + alpha
  const b0 = (1 - cos) / 2 / a0, b1 = (1 - cos) / a0, b2 = b0, a1 = (-2 * cos) / a0, a2 = (1 - alpha) / a0
  let src = x
  for (let pass = 0; pass < 2; pass++) { // 2 passadas = 24 dB/oitava
    const y = new Float32Array(src.length)
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0
    for (let i = 0; i < src.length; i++) {
      const v = b0 * src[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1; x1 = src[i]; y2 = y1; y1 = v; y[i] = v
    }
    src = y
  }
  const n = Math.floor((src.length - 1) / pitch)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = i * pitch, k = Math.floor(p), f = p - k
    out[i] = src[k] * (1 - f) + src[k + 1] * f
  }
  return out
}
