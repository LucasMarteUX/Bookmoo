#!/usr/bin/env node
/**
 * Cria o bucket "comic-pages" no Supabase Storage (leitura pública) para persistir
 * as imagens dos quadrinhos e evitar limite de tamanho no JSONB da tabela books.
 *
 * Requer em .env.local: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Run: node scripts/create-comic-bucket.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { join } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = join(__dirname, '..')
dotenv.config({ path: join(root, '.env.local') })

const BUCKET = 'comic-pages'

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }
  const supabase = createClient(url, key)
  const { data: buckets } = await supabase.storage.listBuckets()
  if (buckets?.some((b) => b.name === BUCKET)) {
    console.log(`Bucket "${BUCKET}" already exists.`)
    return
  }
  const { data, error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024
  })
  if (error) {
    console.error('Failed to create bucket:', error.message)
    process.exit(1)
  }
  console.log(`Bucket "${BUCKET}" created (public). Path: {userId}/{bookId}/{page}.jpg`)
  console.log('Run scripts/supabase-storage-comic-policies.sql in Dashboard → SQL Editor to allow uploads.')
}

main()
