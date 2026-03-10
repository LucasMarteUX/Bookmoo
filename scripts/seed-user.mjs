#!/usr/bin/env node
/**
 * Cria um usuário no Supabase Auth (para já poder logar sem passar pelo cadastro).
 * Usa variáveis de ambiente (podem estar em .env.local):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SEED_USER_EMAIL, SEED_USER_PASSWORD
 *
 * Exemplo (uma vez só):
 *   SEED_USER_EMAIL=seu@email.com SEED_USER_PASSWORD=SuaSenha node scripts/seed-user.mjs
 * Ou adicione SEED_USER_EMAIL e SEED_USER_PASSWORD no .env.local e rode:
 *   node scripts/seed-user.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = join(__dirname, '..')
const envLocal = join(root, '.env.local')
if (existsSync(envLocal)) {
  dotenv.config({ path: envLocal })
}

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.SEED_USER_EMAIL
const password = process.env.SEED_USER_PASSWORD

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Use .env.local or env vars.')
  process.exit(1)
}
if (!email || !password) {
  console.error('Missing SEED_USER_EMAIL or SEED_USER_PASSWORD.')
  console.error('Example: SEED_USER_EMAIL=you@email.com SEED_USER_PASSWORD=YourPass node scripts/seed-user.mjs')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
})

async function main() {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })
  if (error) {
    if (error.message && error.message.includes('already been registered')) {
      console.log('User already exists. You can log in with this email and password.')
      return
    }
    console.error('Error creating user:', error.message)
    process.exit(1)
  }
  console.log('User created:', data.user?.email)
  console.log('You can now log in with this email and password.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
