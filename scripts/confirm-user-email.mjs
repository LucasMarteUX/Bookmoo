#!/usr/bin/env node
/**
 * Marca o e-mail de um usuário como confirmado no Supabase (para poder logar sem clicar no link).
 * Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CONFIRM_USER_EMAIL (e-mail do usuário)
 *
 * Uso: CONFIRM_USER_EMAIL=lucasmarteux@gmail.com node scripts/confirm-user-email.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = join(__dirname, '..')
if (existsSync(join(root, '.env.local'))) dotenv.config({ path: join(root, '.env.local') })

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.CONFIRM_USER_EMAIL

if (!url || !serviceKey || !email) {
  console.error('Use: CONFIRM_USER_EMAIL=user@email.com node scripts/confirm-user-email.mjs')
  console.error('(SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local)')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
})

async function main() {
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listError) {
    console.error('List users error:', listError.message)
    process.exit(1)
  }
  const user = users?.find((u) => (u.email || '').toLowerCase() === email.trim().toLowerCase())
  if (!user) {
    console.error('User not found with email:', email)
    process.exit(1)
  }
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { email_confirm: true })
  if (updateError) {
    console.error('Update error:', updateError.message)
    process.exit(1)
  }
  console.log('Email confirmed for:', user.email)
  console.log('User can now sign in.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
