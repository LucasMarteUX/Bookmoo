import type { adminClient } from '../_shared/tts.ts'
import { AiError, type ImageReference } from '../_shared/ai.ts'
import {
  REFERENCE_BUCKET, REFERENCE_BYTES, REFERENCE_LIMIT, REFERENCE_MIME, REFERENCE_TYPES, cleanText,
  type ComicReference, type StyleDocument,
} from '../_shared/comicEditorial.ts'

export async function loadReferences(sb: Pick<ReturnType<typeof adminClient>, 'storage'>, userId: string, bookId: string, style: StyleDocument) {
  const references = Array.isArray(style.references) ? style.references : []
  if (references.length > REFERENCE_LIMIT) throw new AiError('Too many references', 422, 'comic_reference_failed')
  const images: ImageReference[] = await Promise.all(references.map(async (ref: ComicReference) => {
    if (!ref || !/^[\da-f-]{36}\.(png|jpg|webp)$/.test(ref.file) || !REFERENCE_TYPES.includes(ref.type)) {
      throw new AiError('Invalid visual reference', 422, 'comic_reference_failed')
    }
    const { data, error } = await sb.storage.from(REFERENCE_BUCKET).download(`${userId}/${bookId}/${ref.file}`)
    if (error || !data || !Object.hasOwn(REFERENCE_MIME, data.type) || data.size < 1 || data.size > REFERENCE_BYTES) {
      throw new AiError(`Could not access reference: ${cleanText(ref.name, 100)}`, 422, 'comic_reference_failed')
    }
    return { mime: data.type, blob: data }
  }))
  return { references, images }
}

