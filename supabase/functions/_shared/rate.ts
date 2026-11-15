// Limite de requisições por usuário (ou por IP, no webhook), guardado no Postgres: vale entre instâncias da função.
// Janela fixa. Se o banco não responder, deixa passar (não derruba o app por causa do limitador) e registra no log.
import { adminClient, corsHeaders, log } from './tts.ts'

export function clientIp(req: Request): string {
  return (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? (req.headers.get('x-forwarded-for') ?? '').split(',')[0] ?? '').trim() || 'unknown'
}

/** Devolve uma resposta 429 quando o limite estourou; null quando pode seguir. */
export async function rateLimit(req: Request, subject: string, bucket: string, max: number, windowSec = 60): Promise<Response | null> {
  try {
    const { data, error } = await adminClient().rpc('rate_limit_hit', { p_key: `${bucket}:${subject}`, p_limit: max, p_window_seconds: windowSec })
    if (error || !data) { log('rate', 'limiter_error', { bucket, msg: error?.message?.slice(0, 120) }); return null }
    const r = data as { ok: boolean; retry_after: number }
    if (r.ok) return null
    log('rate', 'blocked', { bucket })
    return new Response(JSON.stringify({ error: 'rate_limited', retry_after: r.retry_after }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(r.retry_after) },
    })
  } catch (e) {
    log('rate', 'limiter_exception', { bucket, msg: String((e as Error)?.message ?? e).slice(0, 120) })
    return null
  }
}
