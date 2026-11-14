// Diagnóstico da API de imagens: mostra status, corpo do erro e limites (nunca imprime a chave).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './lib.mts'
const key = (readFileSync(join(ROOT, '.env.local'), 'utf8').match(/^OPENAI_API_KEY=(.+)$/m)?.[1] ?? '').trim().replace(/^["']|["']$/g, '')
console.log('chave: prefixo', key.slice(0, 7), '· tamanho', key.length, '· termina com oDwA:', key.endsWith('oDwA') ? 'SIM' : 'NÃO')
for (const model of ['gpt-image-2', 'gpt-image-1']) {
  const r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, prompt: 'a plain red circle on a white background, no text', size: '1024x1024', quality: 'low', n: 1 }) })
  const text = await r.text()
  const h = ['x-ratelimit-limit-requests', 'x-ratelimit-remaining-requests', 'retry-after', 'x-request-id'].map(k => `${k}=${r.headers.get(k)}`).join(' ')
  console.log(model, r.status, r.ok ? 'OK (imagem gerada)' : text.slice(0, 500), '\n  ', h)
}
