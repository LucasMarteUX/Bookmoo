#!/usr/bin/env node
/**
 * Deploy ReadLingo build (dist/) to Supabase Storage bucket "web".
 * Requires in .env.local:
 *   SUPABASE_URL=https://ywnmeacpvmcuhzhshpwz.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 *
 * Run: node scripts/deploy-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = join(__dirname, '..')
dotenv.config({ path: join(root, '.env.local') })

const distDir = join(root, 'dist')

const BUCKET = 'web'

const contentTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
}

function getContentType(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.'))
  return contentTypes[ext] || 'application/octet-stream'
}

function* walkDir(dir, base = dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      yield* walkDir(full, base)
    } else {
      yield relative(base, full).replace(/\\/g, '/')
    }
  }
}

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    console.error('Get them from: Supabase Dashboard → Project Settings → API')
    process.exit(1)
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const { data: buckets } = await supabase.storage.listBuckets()
  const hasWeb = buckets?.some((b) => b.name === BUCKET)
  if (!hasWeb) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
    if (error) {
      console.error('Failed to create bucket:', error.message)
      process.exit(1)
    }
    console.log('Bucket "web" created (public).')
  } else {
    console.log('Bucket "web" already exists.')
  }

  const files = [...walkDir(distDir)]
  console.log(`Uploading ${files.length} files...`)

  for (const rel of files) {
    const fullPath = join(distDir, rel)
    const body = readFileSync(fullPath)
    const contentType = getContentType(rel)
    const { error } = await supabase.storage.from(BUCKET).upload(rel, body, {
      contentType,
      upsert: true,
    })
    if (error) {
      console.error(`Upload failed ${rel}:`, error.message)
      process.exit(1)
    }
    console.log('  ', rel)
  }

  const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/index.html`
  console.log('')
  console.log('Deploy done. Open:')
  console.log(publicUrl)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
