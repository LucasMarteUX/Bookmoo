// Ações de admin que precisam da API de Auth (chave de serviço): criar usuário, link de nova senha,
// confirmar e-mail e encerrar sessões. Só quem está em admin_users pode chamar.
import { adminClient, corsHeaders, getUser, json, log } from '../_shared/tts.ts'

type Body = { action?: string; email?: string; password?: string; name?: string; userId?: string; plan?: string; days?: number; confirm?: boolean }

class AdminError extends Error { constructor(public code: string, public status = 400) { super(code) } }

async function handle(callerId: string, b: Body) {
  const db = adminClient()
  const { data: isAdmin } = await db.from('admin_users').select('user_id').eq('user_id', callerId).maybeSingle()
  if (!isAdmin) throw new AdminError('forbidden', 403)
  const email = String(b.email ?? '').trim().toLowerCase()

  switch (b.action) {
    case 'create': {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AdminError('invalid_email')
      const password = b.password && b.password.length >= 8 ? b.password : crypto.randomUUID().replace(/-/g, '').slice(0, 16) + 'aA1!'
      const { data, error } = await db.auth.admin.createUser({
        email, password, email_confirm: b.confirm !== false, user_metadata: { full_name: String(b.name ?? '').slice(0, 80) },
      })
      if (error || !data.user) throw new AdminError(/already|registered/i.test(error?.message ?? '') ? 'email_taken' : 'create_failed')
      // Conta criada pelo admin já cumpriu cadastro e questionário: cai na tela de planos.
      await db.from('user_accounts').upsert({ user_id: data.user.id, onboarding_step: 'plans', terms_accepted_at: new Date().toISOString() })
      if (b.plan && ['essencial', 'plus', 'pro'].includes(b.plan)) {
        const days = Math.max(1, Math.min(Number(b.days ?? 30), 366))
        const { data: plan } = await db.from('plans').select('id').eq('id', b.plan).maybeSingle()
        if (plan) {
          await db.from('subscriptions').insert({
            user_id: data.user.id, plan_id: b.plan, status: 'active', price_cents: 0, provider: 'admin',
            current_period_start: new Date().toISOString(), current_period_end: new Date(Date.now() + days * 86400_000).toISOString(),
          })
        }
      }
      const { data: link } = await db.auth.admin.generateLink({ type: 'recovery', email })
      return { id: data.user.id, email, recovery_link: link?.properties?.action_link ?? null, password_set: !!b.password }
    }

    case 'reset-link': {
      if (!email) throw new AdminError('invalid_email')
      const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email })
      if (error) throw new AdminError('link_failed')
      return { link: data.properties?.action_link ?? null }
    }

    case 'confirm-email': {
      if (!b.userId) throw new AdminError('invalid_user')
      const { error } = await db.auth.admin.updateUserById(b.userId, { email_confirm: true })
      if (error) throw new AdminError('update_failed')
      return { ok: true }
    }

    case 'sign-out': {
      if (!b.userId) throw new AdminError('invalid_user')
      const { error } = await db.rpc('admin_end_sessions', { p_user: b.userId })
      if (error) throw new AdminError('sign_out_failed')
      return { ok: true }
    }

    default:
      throw new AdminError('unknown_action')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized' }, 401)
  const body = await req.json().catch(() => null) as Body | null
  if (!body) return json({ error: 'invalid_json' }, 400)
  try {
    return json(await handle(user.id, body))
  } catch (e) {
    if (e instanceof AdminError) return json({ error: e.code }, e.status)
    log('admin-users', 'error', { action: body.action, msg: String((e as Error)?.message ?? e).slice(0, 200) })
    return json({ error: 'admin_failed' }, 500)
  }
})
