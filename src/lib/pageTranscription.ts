export async function transcribePageImage(imageDataUrl: string, languageCode?: string): Promise<string> {
  const response = await fetch('/api/transcribe-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, languageCode: languageCode || 'en' })
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || `Transcription failed (${response.status})`)
  }
  return String(payload.text || '').trim()
}

export async function preparePageImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione uma imagem válida.')

  const source = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const maxDimension = 2200
  const scale = Math.min(1, maxDimension / Math.max(source.width, source.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    source.close()
    throw new Error('Não foi possível preparar a imagem.')
  }
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  source.close()
  return canvas.toDataURL('image/jpeg', 0.88)
}
