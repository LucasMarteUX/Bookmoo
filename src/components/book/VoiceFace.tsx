// Rosto da voz: foto do tutor (Bia, Luck, Yuno, Yuri) ou o avatar com a inicial para as outras vozes.
import { useEffect, useState } from 'react'
import { VoiceAvatar } from '@/components/settings/VoiceAvatar'
import { getKokoroVoice } from '@/lib/kokoro/voices'
import { tutorAvatar, tutorOf } from '@/lib/tutorReadingVoices'
import { bookCategories, listCatalogLite, type BookCategory } from '@/lib/catalog'

export function VoiceFace({ voice, size = 36, square }: { voice: string | null | undefined; size?: number; square?: boolean }) {
  const t = tutorOf(voice)
  if (t) return <img src={tutorAvatar(t)} alt={t.name} width={size} height={size} draggable={false}
    className={`shrink-0 object-cover select-none ${square ? 'rounded-[8px]' : 'rounded-full'}`} style={{ width: size, height: size, backgroundColor: 'var(--theme-bg-secondary)' }} />
  const k = getKokoroVoice(voice ?? '')
  return k ? <VoiceAvatar voice={k} size={size} square={square} /> : null
}

/** Categorias do livro (pela galeria), para escolher o narrador padrão. */
export function useBookCategories(catalogId: string | undefined): BookCategory[] | undefined {
  const [cats, setCats] = useState<BookCategory[] | undefined>()
  useEffect(() => {
    if (!catalogId) { setCats([]); return }
    let alive = true
    listCatalogLite().then(list => { if (alive) { const b = list.find(c => c.id === catalogId); setCats(b ? bookCategories(b) : []) } }).catch(() => { if (alive) setCats([]) })
    return () => { alive = false }
  }, [catalogId])
  return cats
}
