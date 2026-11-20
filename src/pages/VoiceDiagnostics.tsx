// Diagnóstico de voz (aberto, sem login): mostra o que o aparelho oferece e testa cada caminho da fala, registrando cada
// evento (começou, palavra, terminou, erro). Serve para descobrir no celular de verdade por que um tutor não fala.
import { useEffect, useState } from 'react'
import { deviceSpeak, hasDeviceVoice, isMobileDevice } from '@/lib/deviceVoice'
import { activeKokoroVoice, clearKokoroCrash, getKokoroState, isKokoroSupported, kokoroCrashedHere, kokoroWarm } from '@/lib/kokoro/engine'
import { speak, stopSpeaking } from '@/lib/tts'

export default function VoiceDiagnostics() {
  const [log, setLog] = useState<string[]>([])
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const t0 = useState(() => performance.now())[0]
  const add = (s: string) => setLog(l => [...l, `${((performance.now() - t0) / 1000).toFixed(1)}s  ${s}`])

  useEffect(() => {
    const s = window.speechSynthesis
    if (!s) return
    const load = () => setVoices(s.getVoices())
    load()
    s.addEventListener?.('voiceschanged', load)
    return () => s.removeEventListener?.('voiceschanged', load)
  }, [])

  const raw = (gender: 'female' | 'male') => {
    const s = window.speechSynthesis
    if (!s) { add('speechSynthesis não existe neste navegador'); return }
    const u = new SpeechSynthesisUtterance(gender === 'female' ? 'Hello, this is a female test voice.' : 'Hello, this is a male test voice.')
    u.lang = 'en-US'
    let words = 0
    u.onstart = () => add(`aparelho (direto): começou`)
    u.onboundary = () => { words++ }
    u.onend = () => add(`aparelho (direto): terminou, ${words} avisos de palavra`)
    u.onerror = e => add(`aparelho (direto): ERRO ${(e as SpeechSynthesisErrorEvent).error}`)
    s.cancel(); s.resume(); s.speak(u)
    add(`aparelho (direto): pedido enviado (speaking=${s.speaking}, pending=${s.pending})`)
    window.setTimeout(() => add(`aparelho (direto) +3s: speaking=${s.speaking}, pending=${s.pending}, paused=${s.paused}`), 3000)
  }

  const viaApp = async (gender: 'female' | 'male') => {
    add(`voz do aparelho pelo app (${gender}): pedido`)
    const h = await deviceSpeak('Hi! I am your tutor. Let us talk a little.', { gender })
    await h.done
    add(`voz do aparelho pelo app (${gender}): terminou`)
  }

  const viaTts = async () => {
    add(`fala completa do app: pedido (voz baixada ${activeKokoroVoice() ?? 'nenhuma'}, motor ${kokoroWarm() ? 'carregado' : 'frio'})`)
    const t = performance.now()
    const h = await speak('Hello! I am ready to read with you.', { gender: 'female', onFallback: r => add(`caiu para a voz do aparelho: ${r}`) })
    add(`fala completa: tocando por "${h.source}" depois de ${Math.round(performance.now() - t)} ms`)
    await h.done
    add('fala completa: terminou')
  }

  const st = getKokoroState()
  const en = voices.filter(v => /^en/i.test(v.lang))
  const row = (k: string, v: string) => <p className="text-[13.5px]"><span style={{ color: 'var(--theme-text-secondary)' }}>{k}: </span>{v}</p>
  const btn = 'h-11 px-4 rounded-xl border text-[14px] font-medium text-left'

  return (
    <div className="min-h-dvh px-5 py-8 max-w-xl mx-auto space-y-6" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      <div>
        <h1 className="font-display text-[26px]">Diagnóstico de voz</h1>
        <p className="mt-1 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>Toque em cada teste, um por vez, e tire um print desta tela no final.</p>
      </div>
      <section className="space-y-1">
        {row('Aparelho', navigator.userAgent)}
        {row('Celular', isMobileDevice() ? 'sim' : 'não')}
        {row('Voz do aparelho', hasDeviceVoice() ? `sim, ${voices.length} vozes (${en.length} em inglês)` : 'não')}
        {row('Vozes em inglês', en.slice(0, 12).map(v => `${v.name}${v.localService ? '' : ' (online)'}`).join(', ') || 'nenhuma')}
        {row('Pacote de voz', `${st.modelReady ? 'modelo instalado' : 'sem modelo'}; vozes: ${st.voices.join(', ') || 'nenhuma'}`)}
        {row('Voz baixada ativa', `${isKokoroSupported() ? 'permitida' : 'desligada'}${kokoroCrashedHere() ? ' (a página caiu ao usar o pacote)' : ''}`)}
      </section>
      <section className="grid gap-2">
        <button type="button" className={btn} style={{ borderColor: 'var(--theme-border)' }} onClick={() => raw('female')}>1. Voz do aparelho direto</button>
        <button type="button" className={btn} style={{ borderColor: 'var(--theme-border)' }} onClick={() => void viaApp('female')}>2. Voz do aparelho pelo app (feminina)</button>
        <button type="button" className={btn} style={{ borderColor: 'var(--theme-border)' }} onClick={() => void viaApp('male')}>3. Voz do aparelho pelo app (masculina)</button>
        <button type="button" className={btn} style={{ borderColor: 'var(--theme-border)' }} onClick={() => void viaTts()}>4. Fala completa do app (como o tutor)</button>
        <button type="button" className={btn} style={{ borderColor: 'var(--theme-border)' }} onClick={() => { stopSpeaking(); window.speechSynthesis?.cancel(); add('parado') }}>Parar</button>
        {kokoroCrashedHere() && <button type="button" className={btn} style={{ borderColor: 'var(--theme-border)' }} onClick={() => { clearKokoroCrash(); add('voz baixada liberada de novo') }}>Liberar a voz baixada de novo</button>}
      </section>
      <section>
        <h2 className="text-[15px] font-semibold">Registro</h2>
        <pre className="mt-2 text-[12.5px] whitespace-pre-wrap rounded-xl p-3" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{log.join('\n') || 'Nenhum teste ainda.'}</pre>
      </section>
    </div>
  )
}
