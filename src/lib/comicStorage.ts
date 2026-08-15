import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'comic-pages'

/** Converte base64 (raw) em Uint8Array para upload. */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Faz upload da imagem do quadrinho no Storage e retorna a URL pública.
 * Caminho: {userId}/{bookId}/{pageIndex}.jpg
 */
export async function uploadComicPage(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
  pageIndex: number,
  base64Data: string
): Promise<string> {
  const path = `${userId}/${bookId}/${pageIndex}.jpg`
  const body = base64ToUint8Array(base64Data)
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: 'image/jpeg',
    upsert: true
  })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** Retorna true se o valor é URL (Storage); false se for base64. */
export function isComicPageUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

/** Converte URL de imagem em base64 (para uso como referência na IA). */
export async function fetchImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
      resolve(base64 ?? '')
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Retorna a imagem da página em base64 (para referência na geração).
 * Se já for base64, devolve como está; se for URL, faz fetch e converte.
 */
export async function getComicPageBase64(value: string): Promise<string> {
  if (isComicPageUrl(value)) return fetchImageAsBase64(value)
  return value
}

/** Reduz referências antes de enviá-las à função serverless. */
export async function compressComicReference(base64: string, maxDimension = 768): Promise<string> {
  const image = new Image()
  image.src = `data:image/jpeg;base64,${base64}`
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Failed to decode comic reference'))
  })

  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Failed to prepare comic reference')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.65)
  return dataUrl.split(',')[1] ?? ''
}
