// Diagnóstico de voz (/diagnostico-voz): testa, em etapas e com tempo, cada peça que faz o tutor falar no aparelho, só com
// a nossa voz (Kokoro, no próprio aparelho). Estado do pacote, carga do motor, 3 gerações com a velocidade medida, toque
// pelo player do app, toque por Web Audio e toque depois de abrir e fechar o microfone (o que o iPhone mais estranha).
// No fim junta o registro de voz deste aparelho (voiceLog) num relatório para copiar ou enviar (tabela voice_reports).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isMobileDevice } from '@/lib/deviceVoice'
import {
  activeKokoroVoice, clearKokoroCrash, getKokoroState, isKokoroSupported, kokoroAudioUrl, kokoroBackend, kokoroCrashedHere,
  kokoroRtf, kokoroWarm, mobilePackReady, mobileVoiceFor, waitKokoroWarm,
} from '@/lib/kokoro/engine'
import { AUDIO_BLOCKED_EVENT, audioOutputState, speak, stopSpeaking, unlockAudioOutput, VOICE_FAILED_EVENT } from '@/lib/tts'
import { clearVoiceLog, voiceLog, voiceLogEntries } from '@/lib/voiceLog'
import { supabase } from '@/lib/supabase'

type Status = 'idle' | 'running' | 'ok' | 'warn' | 'fail'
type StepId = 'env' | 'load' | 'gen' | 'play' | 'webaudio' | 'mic'
type Step = { status: Status; detail: string; data?: Record<string, unknown> }

const STEPS: { id: StepId; label: string }[] = [
  { id: 'env', label: 'Aparelho e pacote de voz' },
  { id: 'load', label: 'Carregar o motor de voz' },
  { id: 'gen', label: 'Gerar 3 frases' },
  { id: 'play', label: 'Tocar pelo player do app (como o tutor)' },
  { id: 'webaudio', label: 'Tocar por Web Audio' },
  { id: 'mic', label: 'Tocar depois de usar o microfone' },
]
const SENTENCES = [
  'Hi there!',
  'I really enjoyed this chapter. What did you think about the ending?',
  'When Alice followed the white rabbit down the hole, she had no idea how strange and wonderful her day was about to become.',
]
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`demorou mais de ${Math.round(ms / 1000)} s`)), ms))])
const errText = (e: unknown) => String((e as Error)?.message ?? e)

type Nav = Navigator & {
  deviceMemory?: number
  audioSession?: { type: string }
  gpu?: { requestAdapter(): Promise<unknown> }
}

export default function VoiceDiagnostics() {
  const [steps, setSteps] = useState<Partial<Record<StepId, Step>>>({})
  const [running, setRunning] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [, setTick] = useState(0)
  const mobile = isMobileDevice()
  const nav = navigator as Nav

  const setStep = (id: StepId, s: Step) => setSteps(prev => ({ ...prev, [id]: s }))
  const testVoice = () => activeKokoroVoice() ? (mobile ? mobileVoiceFor('female') : activeKokoroVoice()!) : null

  async function runEnv(): Promise<Step> {
    let gpu: string = nav.gpu ? 'tem a API' : 'não tem'
    if (nav.gpu) { try { gpu = (await withTimeout(nav.gpu.requestAdapter(), 3000)) ? 'adaptador disponível' : 'sem adaptador' } catch (e) { gpu = `erro: ${errText(e)}` } }
    let storage: Record<string, unknown> = {}
    try {
      const est = await navigator.storage?.estimate?.()
      storage = { usadoMB: est?.usage ? Math.round(est.usage / 1e6) : null, cotaMB: est?.quota ? Math.round(est.quota / 1e6) : null, persistente: await navigator.storage?.persisted?.() }
    } catch { /* ignore */ }
    const st = getKokoroState()
    const data = {
      celular: mobile,
      memoriaGB: nav.deviceMemory ?? null,
      nucleos: navigator.hardwareConcurrency ?? null,
      isolado: typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : null,
      webgpu: gpu,
      audioSession: nav.audioSession ? nav.audioSession.type : 'não tem',
      opfs: typeof navigator.storage?.getDirectory === 'function',
      armazenamento: storage,
      modeloInstalado: st.modelReady,
      vozes: st.voices,
      pacoteCelularPronto: mobilePackReady(),
      vozPermitida: isKokoroSupported(),
      pausadaPorQueda: kokoroCrashedHere(),
      velocidadeMedida: kokoroRtf() || null,
      player: audioOutputState(),
    }
    const ready = mobile ? mobilePackReady() : !!activeKokoroVoice()
    if (kokoroCrashedHere()) return { status: 'fail', detail: 'A voz está pausada: a página caiu 2 vezes gerando a voz. Toque em "Reativar voz".', data }
    if (!ready) return { status: 'fail', detail: 'O pacote de voz não está instalado neste aparelho.', data }
    return { status: 'ok', detail: `Pacote instalado (${st.voices.join(', ')}). WebGPU: ${gpu}. Memória: ${nav.deviceMemory ?? '?'} GB.`, data }
  }

  async function runLoad(): Promise<Step> {
    if (!activeKokoroVoice()) return { status: 'fail', detail: 'Sem pacote de voz: nada para carregar.' }
    const was = kokoroWarm()
    const t0 = performance.now()
    const ok = await waitKokoroWarm()
    const ms = Math.round(performance.now() - t0)
    const data = { jaCarregado: was, ms, backend: kokoroBackend() }
    if (!ok) return { status: 'fail', detail: `O motor não carregou (${(ms / 1000).toFixed(1)} s).`, data }
    return { status: ms > 20_000 ? 'warn' : 'ok', detail: was ? 'Já estava carregado.' : `Carregou em ${(ms / 1000).toFixed(1)} s (${kokoroBackend()?.device ?? '?'} · ${kokoroBackend()?.dtype ?? '?'}).`, data }
  }

  async function runGen(): Promise<Step> {
    const voice = testVoice()
    if (!voice) return { status: 'fail', detail: 'Sem pacote de voz.' }
    const results: Record<string, unknown>[] = []
    for (const text of SENTENCES) {
      const t0 = performance.now()
      try {
        const clip = await kokoroAudioUrl(text, voice, 1, 'high')
        const ms = Math.round(performance.now() - t0)
        const size = (await (await fetch(clip.url)).blob()).size
        const sec = Math.max(0, (size - 44) / 2 / 24_000)
        results.push({ letras: text.length, ms, audioS: Math.round(sec * 10) / 10, rtf: sec ? Math.round((ms / 1000 / sec) * 100) / 100 : null, cache: ms < 40 })
      } catch (e) {
        results.push({ letras: text.length, erro: errText(e), ms: Math.round(performance.now() - t0) })
      }
    }
    const fails = results.filter(r => r.erro).length
    const worst = Math.max(...results.map(r => Number(r.rtf) || 0))
    const detail = results.map(r => r.erro ? `${r.letras} letras: ERRO ${r.erro}` : `${r.letras} letras: ${(Number(r.ms) / 1000).toFixed(1)} s para ${r.audioS} s de fala${r.cache ? ' (cache)' : ''}`).join(' · ')
    return { status: fails ? 'fail' : worst > 2.5 ? 'warn' : 'ok', detail, data: { voz: voice, resultados: results } }
  }

  /** Fala uma frase pelo caminho real do tutor e confere se o player andou. */
  async function speakAndCheck(text: string): Promise<Step> {
    let blocked = false, failed = ''
    const onBlocked = () => { blocked = true }
    const onFailed = (e: Event) => { failed = errText((e as CustomEvent<{ error: string }>).detail?.error) }
    window.addEventListener(AUDIO_BLOCKED_EVENT, onBlocked)
    window.addEventListener(VOICE_FAILED_EVENT, onFailed)
    const t0 = performance.now()
    try {
      const h = await speak(text, { gender: 'female' })
      const startMs = Math.round(performance.now() - t0)
      await sleep(1200)
      const mid = audioOutputState()
      await withTimeout(h.done, 30_000).catch(() => {})
      const data = { fonte: h.source, inicioMs: startMs, durante: mid, bloqueado: blocked, falha: failed || null }
      if (failed) return { status: 'fail', detail: `A voz não foi gerada: ${failed}`, data }
      if (blocked) return { status: 'warn', detail: 'O navegador bloqueou o som até um toque (apareceu "Toque para ouvir").', data }
      if (!mid.tempo && mid.pausado !== false) return { status: 'fail', detail: `O player não andou (tempo ${mid.tempo ?? '?'}, erro ${mid.erro ?? 'nenhum'}).`, data }
      return { status: 'ok', detail: `Começou a tocar em ${(startMs / 1000).toFixed(1)} s e o áudio andou.`, data }
    } finally {
      window.removeEventListener(AUDIO_BLOCKED_EVENT, onBlocked)
      window.removeEventListener(VOICE_FAILED_EVENT, onFailed)
    }
  }

  async function runPlay(): Promise<Step> {
    if (!testVoice()) return { status: 'fail', detail: 'Sem pacote de voz.' }
    return speakAndCheck('Hello! I am ready to read and talk with you.')
  }

  async function runWebAudio(): Promise<Step> {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return { status: 'fail', detail: 'Este navegador não tem Web Audio.' }
    const before = nav.audioSession?.type
    try { if (nav.audioSession) nav.audioSession.type = 'playback' } catch { /* ignore */ }
    const ctx = new Ctx()
    const s0 = ctx.state
    try { await withTimeout(ctx.resume(), 2000) } catch { /* registrado abaixo */ }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = 0.04
    osc.frequency.value = 440
    osc.connect(gain).connect(ctx.destination)
    const t0 = ctx.currentTime
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
    await sleep(600)
    const advanced = ctx.currentTime - t0
    const data = { estadoInicial: s0, estado: ctx.state, avancouS: Math.round(advanced * 100) / 100, audioSessionAntes: before ?? null, audioSessionDepois: nav.audioSession?.type ?? null, latencia: ctx.baseLatency ?? null }
    void ctx.close().catch(() => {})
    try { if (nav.audioSession && before) nav.audioSession.type = before } catch { /* ignore */ }
    if (ctx.state !== 'closed' && data.estado !== 'running' && advanced < 0.1) return { status: 'fail', detail: `O contexto de áudio não rodou (estado ${data.estado}).`, data }
    return { status: advanced > 0.3 ? 'ok' : 'warn', detail: `Bipe curto: o relógio andou ${data.avancouS} s (estado ${data.estado}).`, data }
  }

  async function runMic(): Promise<Step> {
    if (!testVoice()) return { status: 'fail', detail: 'Sem pacote de voz.' }
    let stream: MediaStream | null = null
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } }) } catch (e) {
      return { status: 'warn', detail: `Microfone não liberado (${(e as Error)?.name ?? errText(e)}). Este teste fica de fora.` }
    }
    await sleep(1000)
    stream.getTracks().forEach(t => t.stop())
    await sleep(300)
    const r = await speakAndCheck('Thanks! Now I can hear you and talk back.')
    return { ...r, detail: `Depois do microfone: ${r.detail}` }
  }

  const RUN: Record<StepId, () => Promise<Step>> = { env: runEnv, load: runLoad, gen: runGen, play: runPlay, webaudio: runWebAudio, mic: runMic }

  const runOne = async (id: StepId) => {
    setStep(id, { status: 'running', detail: 'Testando…' })
    voiceLog('diagnostico.etapa', { etapa: id })
    try { setStep(id, await RUN[id]()) } catch (e) { setStep(id, { status: 'fail', detail: `Erro: ${errText(e)}` }) }
  }
  const runAll = async () => {
    unlockAudioOutput() // este toque libera o som, como o primeiro toque no app
    setRunning(true)
    setSent(null)
    for (const s of STEPS) await runOne(s.id)
    setRunning(false)
  }

  const report = () => {
    const summary = STEPS.map(s => `${s.id}:${steps[s.id]?.status ?? 'idle'}`).join(' ')
    return {
      summary,
      json: {
        app: 'upoonly', versao: 2, em: new Date().toISOString(), pagina: location.pathname,
        userAgent: navigator.userAgent, celular: mobile,
        etapas: Object.fromEntries(STEPS.map(s => [s.id, steps[s.id] ?? null])),
        registro: voiceLogEntries().slice(-150),
      },
    }
  }
  const copy = async () => {
    const r = report()
    try { await navigator.clipboard.writeText(JSON.stringify(r.json, null, 2)); setSent('Relatório copiado.') } catch { setSent('Não deu para copiar neste navegador.') }
  }
  const send = async () => {
    if (!supabase) { setSent('Sem conexão com o servidor.'); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSent('Entre na sua conta para enviar o relatório (ou use "Copiar relatório").'); return }
    const r = report()
    const { error } = await supabase.from('voice_reports').insert({ user_agent: navigator.userAgent.slice(0, 512), is_mobile: mobile, summary: r.summary, report: r.json })
    setSent(error ? `Não deu para enviar: ${error.message}` : 'Relatório enviado. Obrigado!')
  }

  const color: Record<Status, string> = { idle: 'var(--theme-text-secondary)', running: 'var(--theme-text-secondary)', ok: 'var(--pastel-green-fg)', warn: '#b7791f', fail: 'var(--color-destructive)' }
  const mark: Record<Status, string> = { idle: '○', running: '…', ok: '✓', warn: '!', fail: '✕' }
  const btn = 'h-11 px-4 rounded-xl border text-[14px] font-medium disabled:opacity-50'
  const log = voiceLogEntries().slice(-40).reverse()

  return (
    <div className="min-h-dvh px-5 py-8 max-w-xl mx-auto space-y-6" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      <div>
        <h1 className="font-display text-[26px]">Diagnóstico de voz</h1>
        <p className="mt-1 text-[14px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
          Testa a voz dos tutores neste aparelho, passo a passo. Deixe o som ligado, toque em "Rodar diagnóstico" e, no fim, em "Enviar relatório".
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={running} onClick={() => void runAll()} className={btn} style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)', borderColor: 'transparent' }}>
          {running ? 'Testando…' : 'Rodar diagnóstico'}
        </button>
        <button type="button" onClick={() => { stopSpeaking(); setTick(t => t + 1) }} className={btn} style={{ borderColor: 'var(--theme-border)' }}>Parar</button>
        {kokoroCrashedHere() && <button type="button" onClick={() => { clearKokoroCrash(); setTick(t => t + 1) }} className={btn} style={{ borderColor: 'var(--theme-border)' }}>Reativar voz</button>}
        {!(mobile ? mobilePackReady() : activeKokoroVoice()) && <Link to="/settings" className={`${btn} inline-flex items-center`} style={{ borderColor: 'var(--theme-border)' }}>Baixar pacote de voz</Link>}
      </div>

      <ol className="space-y-2">
        {STEPS.map((s, i) => {
          const st = steps[s.id]
          const status = st?.status ?? 'idle'
          return (
            <li key={s.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--theme-border)' }}>
              <div className="flex items-center gap-2">
                <span className="w-5 text-center font-semibold" style={{ color: color[status] }} aria-hidden>{mark[status]}</span>
                <span className="flex-1 text-[14.5px] font-medium">{i + 1}. {s.label}</span>
                <button type="button" disabled={running || status === 'running'} onClick={() => { unlockAudioOutput(); void runOne(s.id) }} className="h-8 px-3 rounded-lg border text-[12.5px] disabled:opacity-50" style={{ borderColor: 'var(--theme-border)' }}>Testar</button>
              </div>
              {st?.detail && <p className="mt-1.5 ml-7 text-[13px] leading-relaxed" style={{ color: status === 'fail' ? color.fail : 'var(--theme-text-secondary)' }}>{st.detail}</p>}
            </li>
          )
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={running} onClick={() => void send()} className={btn} style={{ borderColor: 'var(--theme-border)' }}>Enviar relatório</button>
        <button type="button" onClick={() => void copy()} className={btn} style={{ borderColor: 'var(--theme-border)' }}>Copiar relatório</button>
        <button type="button" onClick={() => { clearVoiceLog(); setTick(t => t + 1) }} className={btn} style={{ borderColor: 'var(--theme-border)' }}>Limpar registro</button>
      </div>
      {sent && <p className="text-[13.5px]">{sent}</p>}

      <section>
        <h2 className="text-[15px] font-semibold">Registro de voz deste aparelho</h2>
        <pre className="mt-2 text-[12px] whitespace-pre-wrap rounded-xl p-3 max-h-[50vh] overflow-auto" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
          {log.length ? log.map(e => `${e.t.slice(11, 19)}  ${e.ev}${e.data ? ' ' + JSON.stringify(e.data) : ''}`).join('\n') : 'Nada registrado ainda.'}
        </pre>
      </section>
    </div>
  )
}
