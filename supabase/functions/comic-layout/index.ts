// Localiza os balões vazios numa página de quadrinho (IA de visão) e encaixa os trechos do texto
// neles, na ordem de leitura. Devolve caixas normalizadas (0–1) com charStart/charEnd.
import { corsHeaders, getUser, json, log } from '../_shared/tts.ts'
import { AiError, bytesToB64, llmJson, pickProvider } from '../_shared/ai.ts'
import { inspectComic } from './inspect.ts'
import type { Segment } from '../_shared/comic.ts'

type Box = { x: number; y: number; w: number; h: number; kind: 'speech' | 'caption' }
type Detected = { box_2d?: number[]; label?: string }

function iou(a: Box, b: Box) {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  return inter / (a.w * a.h + b.w * b.h - inter || 1)
}

/** Ordem de leitura: agrupa em linhas pela altura do centro e lê cada linha da esquerda para a direita. */
function readingOrder(boxes: Box[]): Box[] {
  const sorted = [...boxes].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2))
  const rows: Box[][] = []
  for (const bx of sorted) {
    const cy = bx.y + bx.h / 2
    const row = rows.find((r) => Math.abs(r[0].y + r[0].h / 2 - cy) < Math.max(0.06, r[0].h / 2))
    if (row) row.push(bx); else rows.push([bx])
  }
  return rows.flatMap((r) => r.sort((a, b) => a.x - b.x))
}

/** Ajusta a quantidade de trechos à de balões, mantendo a ordem do texto. */
function fitSegments(segs: Segment[], n: number, text: string): Segment[] {
  const out = [...segs]
  const len = (s: Segment) => s.charEnd - s.charStart
  while (out.length > n && out.length > 1) {
    let best = 0, bestLen = Infinity
    for (let i = 0; i < out.length - 1; i++) { const l = len(out[i]) + len(out[i + 1]); if (l < bestLen) { bestLen = l; best = i } }
    out.splice(best, 2, { charStart: out[best].charStart, charEnd: out[best + 1].charEnd, kind: out[best].kind })
  }
  while (out.length < n) {
    // Divide o trecho mais longo num limite de frase (ou espaço) perto do meio.
    let idx = 0
    for (let i = 1; i < out.length; i++) if (len(out[i]) > len(out[idx])) idx = i
    const s = out[idx]
    const mid = s.charStart + Math.floor(len(s) / 2)
    const slice = text.slice(s.charStart, s.charEnd)
    const rel = mid - s.charStart
    let cut = -1
    for (let d = 0; d < slice.length / 2 && cut < 0; d++) {
      for (const p of [rel + d, rel - d]) if (p > 0 && p < slice.length && /[.!?;,]\s/.test(slice.slice(p - 1, p + 1))) { cut = p; break }
    }
    if (cut < 0) cut = slice.lastIndexOf(' ', rel) > 0 ? slice.lastIndexOf(' ', rel) : rel
    if (cut <= 0 || cut >= slice.length) break
    let a = s.charStart + cut
    while (a < s.charEnd && /\s/.test(text[a])) a++
    out.splice(idx, 1, { charStart: s.charStart, charEnd: s.charStart + cut, kind: s.kind }, { charStart: a, charEnd: s.charEnd, kind: s.kind })
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized' }, 401)
  const b = await req.json().catch(() => null) as { action?: string; imageUrl?: string; segments?: Segment[]; pageText?: string } | null
  if (!b) return json({ error: 'invalid_json' }, 400)
  if (b.action === 'editorial-version') return json({ editorialVersion: 3 })

  if (b.action === 'inspect') {
    try {
      return json(await inspectComic(user.id, b))
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError(String((e as Error).message))
      log('comic-layout', 'inspection_failed', { code: err.code })
      return json({ error: err.code, detail: err.message }, err.status)
    }
  }

  // Só imagens do próprio usuário no bucket do app (evita usar a função para buscar URLs arbitrárias).
  const prefix = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/comic-pages/${user.id}/`
  const imageUrl = String(b.imageUrl ?? '')
  if (!imageUrl.startsWith(prefix)) return json({ error: 'invalid_image_url' }, 400)
  const pageText = String(b.pageText ?? '')
  const segs = (b.segments ?? []).filter((s) => Number.isInteger(s.charStart) && Number.isInteger(s.charEnd) && s.charEnd > s.charStart && s.charEnd <= pageText.length)
  if (!segs.length) return json({ error: 'invalid_segments' }, 400)

  try {
    const r = await fetch(imageUrl, { signal: AbortSignal.timeout(20_000) })
    if (!r.ok) throw new AiError('image_fetch_failed', 502, 'image_fetch_failed')
    const bytes = new Uint8Array(await r.arrayBuffer())
    const mime = r.headers.get('content-type') ?? 'image/jpeg'

    const { provider, key } = await pickProvider(user.id, ['gemini', 'openai'])
    const res = await llmJson<Detected[] | { boxes?: Detected[] }>(provider, key, {
      images: [{ mime, data: bytesToB64(bytes) }],
      prompt: `This is a comic page whose speech bubbles and caption boxes are EMPTY (blank, meant to receive text).
Detect EVERY empty speech bubble and empty caption box. Do not include panels, faces or other objects.
Return JSON only: {"boxes": [{"box_2d": [ymin, xmin, ymax, xmax], "label": "speech" | "caption"}]}
Coordinates are integers normalized to 0–1000 relative to the full image (0,0 is the top-left corner). The box must tightly enclose the white interior of the bubble/box.`,
    })
    const detected = Array.isArray(res) ? res : (res.boxes ?? [])
    let boxes: Box[] = detected
      .filter((d) => Array.isArray(d.box_2d) && d.box_2d.length === 4)
      .map((d) => {
        const [y0, x0, y1, x1] = d.box_2d!.map((v) => Math.min(1000, Math.max(0, Number(v)))) as number[]
        return { x: Math.min(x0, x1) / 1000, y: Math.min(y0, y1) / 1000, w: Math.abs(x1 - x0) / 1000, h: Math.abs(y1 - y0) / 1000, kind: d.label === 'speech' ? 'speech' as const : 'caption' as const }
      })
      .filter((bx) => bx.w * bx.h > 0.003 && bx.w * bx.h < 0.45)
    // Remove duplicadas (caixas muito sobrepostas).
    boxes = boxes.filter((bx, i) => !boxes.some((o, j) => j < i && iou(o, bx) > 0.5))
    boxes = readingOrder(boxes)

    // Mais balões do que trechos: descarta os menores.
    while (boxes.length > segs.length) {
      let small = 0
      boxes.forEach((bx, i) => { if (bx.w * bx.h < boxes[small].w * boxes[small].h) small = i })
      boxes.splice(small, 1)
    }
    const fitted = boxes.length ? fitSegments(segs, boxes.length, pageText) : []
    const balloons = boxes.slice(0, fitted.length).map((bx, i) => {
      // Área útil dentro do balão: elipses perdem os cantos, então recuamos mais nelas.
      const inset = bx.kind === 'speech' ? 0.14 : 0.05
      return {
        x: +(bx.x + bx.w * inset).toFixed(4), y: +(bx.y + bx.h * inset).toFixed(4),
        w: +(bx.w * (1 - 2 * inset)).toFixed(4), h: +(bx.h * (1 - 2 * inset)).toFixed(4),
        kind: bx.kind, charStart: fitted[i].charStart, charEnd: fitted[i].charEnd,
      }
    })
    log('comic-layout', 'done', { user: user.id, provider, detected: detected.length, used: balloons.length, segments: segs.length })
    return json({ v: 1, balloons })
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError(String((e as Error)?.message ?? e))
    log('comic-layout', 'error', { code: err.code, msg: err.message.slice(0, 200) })
    return json({ error: err.code, detail: err.message }, err.status)
  }
})
