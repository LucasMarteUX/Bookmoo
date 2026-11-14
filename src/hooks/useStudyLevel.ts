import { useMemo } from 'react'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useXpStore, xpSummary } from '@/store/useXpStore'
import { studyLevel } from '@/lib/cefr'

/** Nível oficial do app (palavras salvas + pontos) — o mesmo do sidebar. Enviado à IA para não "inventar" outro. */
export function useStudyLevel() {
  const vocab = useVocabularyStore(s => s.vocabularies)
  const events = useXpStore(s => s.events)
  return useMemo(() => {
    const words = new Set(vocab.map(v => v.text.trim().toLowerCase()).filter(Boolean)).size
    return studyLevel(words, xpSummary(events).total)
  }, [vocab, events])
}
