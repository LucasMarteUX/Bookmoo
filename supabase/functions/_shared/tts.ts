import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.98.0'

export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('TTS_ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export const BUCKET = 'tts-audio'
export const SIGNED_URL_TTL = 60 * 60 // 1h
export const MAX_TEXT_CHARS = 1000
export const MAX_JOBS_PER_HOUR = Number(Deno.env.get('TTS_MAX_JOBS_PER_HOUR') ?? '300')

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
}

/** Valida o JWT do aluno. Retorna o usuário ou null. */
export async function getUser(req: Request): Promise<User | null> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await adminClient().auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

/** Admin = app_metadata.role === 'admin' (só o service role consegue definir app_metadata). */
export function isAdmin(user: User): boolean {
  return (user.app_metadata as Record<string, unknown> | undefined)?.role === 'admin'
}

export function normalizeText(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim()
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Chave determinística. Inclui tudo que altera o áudio: texto, idioma, provedor, voz,
 * modelo, versão do modelo, velocidade de síntese e formato — e o escopo (privado vs compartilhado).
 */
export async function contentHash(p: {
  text: string; language: string; provider: string; providerVoiceId: string
  modelId: string; modelVersion: string; synthSpeed: number; format: string; scopeUserId: string | null
}): Promise<string> {
  return sha256Hex(JSON.stringify([
    'v1', p.text, p.language, p.provider, p.providerVoiceId, p.modelId, p.modelVersion,
    p.synthSpeed.toFixed(2), p.format, p.scopeUserId ?? 'shared',
  ]))
}

export async function signedUrl(sb: SupabaseClient, path: string): Promise<string | null> {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL)
  if (error) return null
  return data.signedUrl
}

export function log(fn: string, event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn, event, ts: new Date().toISOString(), ...extra }))
}
