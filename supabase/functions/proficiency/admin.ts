// Admin da English Proficiency Test: versões, geração e aprovação de questões, áudios, sessões e custos.
// Só chega aqui quem tem is_admin (conferido em index.ts). Usa o service role: nada disso passa pelo RLS do cliente.
import { llmJson, pickProvider } from '../_shared/ai.ts'
import { measured } from '../_shared/billing.ts'
import { RECORDING_RETENTION_DAYS, SECTIONS, TASKS, type Stage, type TaskType } from '../_shared/proficiency/blueprint.ts'
import { applyReview, generationPrompt, normalizeItem, reviewPrompt, type Review } from '../_shared/proficiency/generate.ts'
import type { adminClient } from '../_shared/tts.ts'

type Db = ReturnType<typeof adminClient>
type Deps = {
  approvedPool: (db: Db, versionId: string) => Promise<unknown[]>
  bankShortfalls: (pool: never[]) => string[]
  scoreSession: (id: string, plan?: string) => Promise<void>
  ProfError: new (code: string, status?: number, extra?: Record<string, unknown>) => Error
  plan?: string
}
type Body = Record<string, unknown>

const AUDIO_BUCKET = 'proficiency-audio'
const REC_BUCKET = 'proficiency-recordings'
const STAGES: Stage[] = ['router', 'easy', 'hard', 'any']
const TASK_IDS = Object.keys(TASKS) as TaskType[]
const s = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max)

/** Hash do roteiro (para saber se o áudio ficou desatualizado depois de uma edição). */
async function scriptHash(script: unknown) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(JSON.stringify(script ?? null)))
  return Array.from(new Uint8Array(buf)).slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Segmentos de áudio que uma questão precisa: estímulo principal ou uma pergunta da entrevista por chave. */
function audioNeeds(task: TaskType, script: Record<string, unknown> | null): { key: string; lines: { voice: string; text: string; speaker?: string }[] }[] {
  if (!TASKS[task].audio || !script) return []
  if (task === 'interview') return ((script.questions ?? []) as { id: string; voice: string; text: string }[]).map(q => ({ key: q.id, lines: [{ voice: q.voice, text: q.text }] }))
  return [{ key: 'main', lines: ((script.lines ?? []) as { voice: string; text: string; speaker?: string }[]) }]
}

async function draftVersion(db: Db, id: unknown, d: Deps) {
  const { data } = await db.from('prof_versions').select('id, status').eq('id', s(id, 40)).maybeSingle()
  if (!data) throw new d.ProfError('version_not_found', 404)
  if (data.status !== 'draft') throw new d.ProfError('version_locked', 409)
  return data
}

export async function adminActions(db: Db, userId: string, b: Body, d: Deps) {
  switch (b.action) {
    case 'admin_overview': {
      const { data: versions } = await db.from('prof_versions').select('*').order('created_at', { ascending: false })
      const { data: items } = await db.from('prof_items').select('version_id, task_type, stage, status').limit(20000)
      const counts: Record<string, Record<string, Record<string, number>>> = {}
      for (const it of items ?? []) {
        const v = (counts[it.version_id] ??= {})
        const k = `${it.task_type}|${it.stage}`
        ;(v[k] ??= {})[it.status] = ((v[k] ??= {})[it.status] ?? 0) + 1
      }
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
      const { data: usage } = await db.from('ai_usage').select('operation, cost_usd, status, created_at').like('operation', 'proficiency-%').gte('created_at', since).limit(20000)
      const costs: Record<string, { calls: number; usd: number; failed: number }> = {}
      for (const u of usage ?? []) {
        const c = (costs[u.operation] ??= { calls: 0, usd: 0, failed: 0 })
        c.calls++; c.usd += Number(u.cost_usd) || 0; if (u.status === 'failed') c.failed++
      }
      const { data: sess } = await db.from('prof_sessions').select('status').gte('started_at', since).limit(20000)
      const sessions: Record<string, number> = {}
      for (const x of sess ?? []) sessions[x.status] = (sessions[x.status] ?? 0) + 1
      const shortfalls: Record<string, string[]> = {}
      for (const v of versions ?? []) if (v.status !== 'archived') shortfalls[v.id] = d.bankShortfalls(await d.approvedPool(db, v.id) as never[])
      return { versions: versions ?? [], counts, costs, sessions, shortfalls, tasks: TASKS }
    }

    case 'admin_version_create': {
      const code = s(b.code, 40) || `v${new Date().toISOString().slice(0, 10)}`
      const { data: v, error } = await db.from('prof_versions').insert({ code, notes: s(b.notes, 500) || null, created_by: userId }).select('*').single()
      if (error || !v) throw new d.ProfError(/duplicate/.test(error?.message ?? '') ? 'code_taken' : 'create_failed', 409)
      if (b.cloneFrom) {
        // Copia as questões aprovadas (e os áudios, que continuam no mesmo arquivo) de outra versão.
        const { data: src } = await db.from('prof_items').select('*').eq('version_id', s(b.cloneFrom, 40)).eq('status', 'approved')
        for (const it of src ?? []) {
          const { id: oldId, created_at: _c, updated_at: _u, ...rest } = it
          const { data: nu } = await db.from('prof_items').insert({ ...rest, version_id: v.id }).select('id').single()
          if (!nu) continue
          const { data: assets } = await db.from('prof_assets').select('key, storage_path, mime, voice, duration_ms, script_hash').eq('item_id', oldId)
          if (assets?.length) await db.from('prof_assets').insert(assets.map(a => ({ ...a, item_id: nu.id, created_by: userId })))
        }
      }
      return { version: v }
    }

    case 'admin_version_publish': {
      const id = s(b.id, 40)
      const pool = await d.approvedPool(db, id)
      const short = d.bankShortfalls(pool as never[])
      if (short.length) throw new d.ProfError('bank_incomplete', 409, { missing: short })
      await db.from('prof_versions').update({ status: 'archived' }).eq('status', 'published')
      await db.from('prof_versions').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', id)
      return { ok: true }
    }

    case 'admin_version_archive': {
      await db.from('prof_versions').update({ status: 'archived' }).eq('id', s(b.id, 40))
      return { ok: true }
    }

    case 'admin_items': {
      let q = db.from('prof_items').select('id, section, task_type, stage, difficulty, cefr, points, content, answer, script, rubric, status, source, validation, review_note, reviewed_at, created_at').eq('version_id', s(b.versionId, 40)).order('created_at', { ascending: false }).limit(Math.min(500, Number(b.limit) || 200))
      if (b.task) q = q.eq('task_type', s(b.task, 40))
      if (b.stage) q = q.eq('stage', s(b.stage, 10))
      if (b.status) q = q.eq('status', s(b.status, 12))
      const { data: items } = await q
      const ids = (items ?? []).map(i => i.id)
      const { data: assets } = ids.length ? await db.from('prof_assets').select('item_id, key, duration_ms, voice, script_hash').in('item_id', ids) : { data: [] }
      const out = await Promise.all((items ?? []).map(async it => {
        const needs = audioNeeds(it.task_type, it.script)
        const hash = await scriptHash(it.script)
        const have = (assets ?? []).filter(a => a.item_id === it.id)
        return { ...it, audio: needs.map(n => ({ key: n.key, ready: have.some(a => a.key === n.key), stale: have.some(a => a.key === n.key && a.script_hash && a.script_hash !== hash) })) }
      }))
      return { items: out }
    }

    case 'admin_item_review': {
      const status = s(b.status, 12)
      if (!['approved', 'rejected', 'review', 'retired'].includes(status)) throw new d.ProfError('invalid_status')
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(x => s(x, 40)).slice(0, 200)
      const { data: rows } = await db.from('prof_items').select('id, prof_versions(status)').in('id', ids)
      // Versão publicada é congelada: lá só dá para aposentar uma questão problemática.
      const allowed = (rows ?? []).filter(r => (r as unknown as { prof_versions: { status: string } }).prof_versions.status === 'draft' || status === 'retired').map(r => r.id)
      if (allowed.length) await db.from('prof_items').update({ status, review_note: s(b.note, 500) || null, reviewed_by: userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in('id', allowed)
      return { updated: allowed.length, skipped: ids.length - allowed.length }
    }

    case 'admin_item_update': {
      const { data: it } = await db.from('prof_items').select('id, version_id, prof_versions(status)').eq('id', s(b.id, 40)).maybeSingle()
      if (!it) throw new d.ProfError('item_not_found', 404)
      if ((it as unknown as { prof_versions: { status: string } }).prof_versions.status !== 'draft') throw new d.ProfError('version_locked', 409)
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), source: 'manual' }
      for (const k of ['content', 'answer', 'script'] as const) if (b[k] && typeof b[k] === 'object') patch[k] = b[k]
      if (b.difficulty != null) patch.difficulty = Math.max(1, Math.min(6, Number(b.difficulty) || 3))
      if (b.stage && STAGES.includes(b.stage as Stage)) patch.stage = b.stage
      if (b.cefr) patch.cefr = s(b.cefr, 2)
      await db.from('prof_items').update(patch).eq('id', it.id)
      return { ok: true }
    }

    case 'admin_generate': {
      // Geração → validação estrutural → revisão por outro prompt (que resolve as questões sem o gabarito).
      // Nada é aprovado aqui: a questão vai para "review" (aguardando aprovação humana) ou "rejected" com os motivos.
      const v = await draftVersion(db, b.versionId, d)
      const task = s(b.task, 40) as TaskType
      if (!TASK_IDS.includes(task)) throw new d.ProfError('invalid_task')
      const adaptive = TASKS[task].section === 'reading' || TASKS[task].section === 'listening'
      const stage = (adaptive ? (['router', 'easy', 'hard'].includes(String(b.stage)) ? b.stage : 'router') : 'any') as Stage
      const count = Math.max(1, Math.min(task === 'choose_response' || task === 'build_sentence' || task === 'listen_repeat' ? 8 : 4, Number(b.count) || 3))
      const { data: existing } = await db.from('prof_items').select('validation').eq('version_id', v.id).eq('task_type', task).limit(400)
      const avoid = [...new Set((existing ?? []).map(e => String((e.validation as { topic?: string } | null)?.topic ?? '')).filter(Boolean))]
      const { data: gen } = await db.from('prof_generations').insert({ version_id: v.id, task_type: task, stage, requested: count, requested_by: userId }).select('id').single()
      try {
        const result = await measured(userId, 'proficiency-generate', async () => {
          const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
          const raw = await llmJson<{ items?: Record<string, unknown>[] }>(provider, key, { prompt: generationPrompt(task, stage, count, avoid) })
          const normalized = (raw.items ?? []).slice(0, count).map(r => ({ raw: r, ...normalizeItem(task, stage, r) }))
          const good = normalized.filter(n => n.item)
          let reviews: Review[] = []
          if (good.length) {
            const rv = await llmJson<{ reviews?: Review[] }>(provider, key, { system: 'You are a meticulous test reviewer. Be strict.', prompt: reviewPrompt(task, good.map(g => g.item!)) })
            reviews = rv.reviews ?? []
          }
          let created = 0, rejected = 0
          for (const n of normalized) {
            if (!n.item) {
              rejected++
              await db.from('prof_items').insert({ version_id: v.id, section: TASKS[task].section, task_type: task, stage, difficulty: 3, points: TASKS[task].points, content: { raw: n.raw }, answer: {}, status: 'rejected', source: 'ai', generation_id: gen?.id, validation: { structural: 'failed', issues: n.issues } })
              continue
            }
            const review = reviews.find(r => r.n === good.indexOf(n))
            const { status, validation } = applyReview(n.item, review)
            if (status === 'rejected') rejected++; else created++
            await db.from('prof_items').insert({
              version_id: v.id, section: TASKS[task].section, task_type: task, stage, difficulty: n.item.difficulty, cefr: n.item.cefr,
              points: TASKS[task].points, content: n.item.content, answer: n.item.answer, script: n.item.script, rubric: n.item.rubric,
              status, source: 'ai', generation_id: gen?.id, validation,
            })
          }
          return { created, rejected }
        }, d.plan)
        const { data: cost } = await db.from('ai_usage').select('cost_usd').eq('user_id', userId).eq('operation', 'proficiency-generate').order('created_at', { ascending: false }).limit(1).maybeSingle()
        await db.from('prof_generations').update({ status: 'done', created: result.created, rejected: result.rejected, cost_usd: Number(cost?.cost_usd) || 0 }).eq('id', gen?.id)
        return result
      } catch (e) {
        await db.from('prof_generations').update({ status: 'failed', error: String((e as Error)?.message ?? e).slice(0, 300) }).eq('id', gen?.id)
        throw e
      }
    }

    case 'admin_generations': {
      const { data } = await db.from('prof_generations').select('*').eq('version_id', s(b.versionId, 40)).order('created_at', { ascending: false }).limit(100)
      return { generations: data ?? [] }
    }

    case 'admin_audio_todo': {
      // Roteiros que ainda precisam de áudio (o admin gera no navegador com as vozes do leitor e envia).
      const { data: items } = await db.from('prof_items').select('id, task_type, script, status').eq('version_id', s(b.versionId, 40)).in('status', ['approved', 'review']).limit(5000)
      const audioItems = (items ?? []).filter(i => TASKS[i.task_type as TaskType].audio)
      const ids = audioItems.map(i => i.id)
      const assets: { item_id: string; key: string; script_hash: string | null }[] = []
      for (let i = 0; i < ids.length; i += 300) {
        const { data } = await db.from('prof_assets').select('item_id, key, script_hash').in('item_id', ids.slice(i, i + 300))
        assets.push(...(data ?? []))
      }
      const todo = []
      for (const it of audioItems) {
        const hash = await scriptHash(it.script)
        for (const n of audioNeeds(it.task_type, it.script)) {
          const a = assets.find(x => x.item_id === it.id && x.key === n.key)
          if (!a || (a.script_hash && a.script_hash !== hash) || b.all) todo.push({ itemId: it.id, task: it.task_type, status: it.status, key: n.key, lines: n.lines, hash })
        }
      }
      return { todo, total: audioItems.length }
    }

    case 'admin_audio_upload': {
      const itemId = s(b.itemId, 40), key = s(b.key, 12)
      const { data: it } = await db.from('prof_items').select('id, version_id').eq('id', itemId).maybeSingle()
      if (!it) throw new d.ProfError('item_not_found', 404)
      const path = `items/${it.version_id}/${it.id}/${key}-${Date.now()}.wav`
      const { data, error } = await db.storage.from(AUDIO_BUCKET).createSignedUploadUrl(path, { upsert: true })
      if (error || !data) throw new d.ProfError('upload_failed', 500)
      return { path, token: data.token, signedUrl: data.signedUrl }
    }

    case 'admin_audio_register': {
      const itemId = s(b.itemId, 40), key = s(b.key, 12), path = s(b.path, 300)
      if (!path.startsWith('items/')) throw new d.ProfError('invalid_path')
      const { data: old } = await db.from('prof_assets').select('storage_path').eq('item_id', itemId).eq('key', key).maybeSingle()
      await db.from('prof_assets').upsert({ item_id: itemId, key, storage_path: path, mime: 'audio/wav', voice: s(b.voice, 60), duration_ms: Math.round(Number(b.durationMs) || 0), script_hash: s(b.hash, 40), created_by: userId }, { onConflict: 'item_id,key' })
      if (old?.storage_path && old.storage_path !== path) {
        // Só apaga o arquivo antigo se nenhuma outra versão (cópia) ainda usa.
        const { count } = await db.from('prof_assets').select('id', { count: 'exact', head: true }).eq('storage_path', old.storage_path)
        if (!count) await db.storage.from(AUDIO_BUCKET).remove([old.storage_path])
      }
      return { ok: true }
    }

    case 'admin_audio_url': {
      const { data: a } = await db.from('prof_assets').select('storage_path').eq('item_id', s(b.itemId, 40)).eq('key', s(b.key, 12)).maybeSingle()
      if (!a) throw new d.ProfError('audio_missing', 404)
      const { data } = await db.storage.from(AUDIO_BUCKET).createSignedUrl(a.storage_path, 600)
      return { url: data?.signedUrl ?? null }
    }

    case 'admin_sessions': {
      const { data: sessions } = await db.from('prof_sessions').select('id, user_id, version_id, status, section, module, started_at, submitted_at, scored_at, scoring_attempts, error, path').order('started_at', { ascending: false }).limit(Math.min(200, Number(b.limit) || 60))
      const users = [...new Set((sessions ?? []).map(x => x.user_id))]
      const { data: profiles } = users.length ? await db.from('profiles').select('user_id, display_name, handle').in('user_id', users) : { data: [] }
      const { data: results } = (sessions ?? []).length ? await db.from('prof_results').select('session_id, overall, cefr, status').in('session_id', (sessions ?? []).map(x => x.id)) : { data: [] }
      return {
        sessions: (sessions ?? []).map(x => ({
          ...x, person: (profiles ?? []).find(p => p.user_id === x.user_id) ?? null, result: (results ?? []).find(r => r.session_id === x.id) ?? null,
          route: Object.fromEntries(['reading', 'listening'].map(k => [k, (x.path?.[k]?.router as { module?: string; pct?: number } | undefined) ?? null])),
        })),
      }
    }

    case 'admin_session': {
      const id = s(b.id, 40)
      const { data: session } = await db.from('prof_sessions').select('*').eq('id', id).single()
      const { data: items } = await db.from('prof_session_items').select('id, section, module, position, opened_at, deadline_at, plays, prof_items(id, task_type, stage, content, answer, script)').eq('session_id', id).order('section').order('module').order('position')
      const { data: responses } = await db.from('prof_responses').select('session_item_id, part, response, transcript, auto_score, saved_at').eq('session_id', id)
      const { data: evaluations } = await db.from('prof_evaluations').select('*').eq('session_id', id)
      const { data: result } = await db.from('prof_results').select('*').eq('session_id', id).maybeSingle()
      return { session, items, responses, evaluations, result }
    }

    case 'admin_rescore': {
      const id = s(b.id, 40)
      const { data: x } = await db.from('prof_sessions').select('status').eq('id', id).single()
      if (!x || x.status === 'active' || x.status === 'abandoned') throw new d.ProfError('not_submitted', 409)
      await db.from('prof_sessions').update({ status: 'scoring', scoring_attempts: 0, error: null }).eq('id', id)
      await d.scoreSession(id, d.plan)
      return { ok: true }
    }

    case 'admin_purge_recordings': {
      // LGPD: apaga as gravações de fala depois do prazo de retenção (as transcrições e as notas ficam).
      const days = Math.max(1, Number(b.days) || RECORDING_RETENTION_DAYS)
      const before = new Date(Date.now() - days * 86_400_000).toISOString()
      const { data: rows } = await db.from('prof_responses').select('id, audio_path').not('audio_path', 'is', null).lt('saved_at', before).limit(1000)
      const paths = (rows ?? []).map(r => r.audio_path as string)
      for (let i = 0; i < paths.length; i += 100) await db.storage.from(REC_BUCKET).remove(paths.slice(i, i + 100))
      if (rows?.length) await db.from('prof_responses').update({ audio_path: null }).in('id', rows.map(r => r.id))
      return { removed: paths.length, days }
    }

    case 'admin_settings': {
      if (b.minPlanRank != null) {
        const n = Math.max(0, Math.min(3, Number(b.minPlanRank) || 0))
        await db.from('app_settings').upsert({ key: 'proficiency_min_plan_rank', value: n, updated_at: new Date().toISOString() })
      }
      const { data } = await db.from('app_settings').select('value').eq('key', 'proficiency_min_plan_rank').maybeSingle()
      return { minPlanRank: Number(data?.value ?? 3), sections: SECTIONS }
    }

    default:
      throw new d.ProfError('unknown_action')
  }
}
