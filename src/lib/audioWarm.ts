// Mantém a saída de som do aparelho "acordada" com um sinal silencioso enquanto o app está visível.
// Sem isso, depois de um tempo em silêncio o sistema desliga a saída e, ao religar para a próxima fala, os primeiros
// 1–2 segundos saíam picotados (pior com o personagem animado disputando o processador no mesmo instante).
let ctx: AudioContext | null = null

function start() {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      ctx = new AC({ latencyHint: 'playback' })
      const src = ctx.createConstantSource()
      const gain = ctx.createGain()
      gain.gain.value = 0 // silêncio de verdade: só mantém o fluxo de áudio aberto
      src.connect(gain).connect(ctx.destination)
      src.start()
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  } catch { /* sem WebAudio: segue sem aquecer */ }
}

export function installAudioWarmup() {
  if (typeof window === 'undefined') return
  // O navegador só deixa abrir o áudio depois de um toque/clique.
  const onGesture = () => start()
  window.addEventListener('pointerdown', onGesture, { passive: true })
  window.addEventListener('keydown', onGesture)
  // Em segundo plano, libera a saída (economiza bateria); ao voltar, religa antes da próxima fala.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) void ctx.suspend().catch(() => {})
    else void ctx.resume().catch(() => {})
  })
}
