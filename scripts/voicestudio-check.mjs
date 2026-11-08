#!/usr/bin/env node
// Verifica o VoiceStudio local e faz uma geração real.
// Uso: node scripts/voicestudio-check.mjs [model] [voice]
// Env: VOICESTUDIO_URL (default http://127.0.0.1:3900), VOICESTUDIO_API_KEY
import { writeFile } from 'node:fs/promises'

const base = process.env.VOICESTUDIO_URL ?? 'http://127.0.0.1:3900'
const headers = process.env.VOICESTUDIO_API_KEY ? { Authorization: `Bearer ${process.env.VOICESTUDIO_API_KEY}` } : {}
const get = async (p) => {
  const r = await fetch(new URL(p, base), { headers, signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error(`${p} -> HTTP ${r.status}`)
  return r.json()
}

try {
  console.log('health:', JSON.stringify(await get('/health')))
  const models = await get('/v1/models')
  console.log('models:', JSON.stringify(models).slice(0, 1500))
  const voices = await get('/v1/audio/voices')
  console.log('voices:', JSON.stringify(voices).slice(0, 3000))

  const [model, voice] = process.argv.slice(2)
  if (!model || !voice) {
    console.log('\nPara gerar áudio: node scripts/voicestudio-check.mjs <model> <voice>')
    process.exit(0)
  }
  const t0 = Date.now()
  const r = await fetch(new URL('/v1/audio/speech', base), {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, voice, input: 'Hello! Welcome to Bookmoo. Let us read a story together.', response_format: 'mp3', speed: 1.0 }),
  })
  if (!r.ok) throw new Error(`speech -> HTTP ${r.status}: ${await r.text()}`)
  const buf = Buffer.from(await r.arrayBuffer())
  await writeFile('voicestudio-sample.mp3', buf)
  console.log(`speech OK: ${buf.length} bytes em ${Date.now() - t0} ms -> voicestudio-sample.mp3`)
} catch (e) {
  console.error('VoiceStudio indisponível:', e.message)
  process.exit(1)
}
