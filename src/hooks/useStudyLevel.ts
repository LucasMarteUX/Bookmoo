import { useMemo } from 'react'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useXpStore, xpSummary } from '@/store/useXpStore'
import { CEFR, studyLevel } from '@/lib/cefr'
import { currentLevel, useLevelStore } from '@/store/useLevelStore'

/** Nível oficial do app — o mesmo do sidebar, enviado à IA. É o do teste de nível ou, sem teste, o que a pessoa declarou no
 *  primeiro acesso (docs/TESTE-DE-NIVEL.md). Quem nunca informou (contas antigas) continua com o nível por palavras e pontos. */
export function useStudyLevel() {
  const vocab = useVocabularyStore(s => s.vocabularies)
  const events = useXpStore(s => s.events)
  const chosen = useLevelStore(s => currentLevel(s))
  return useMemo(() => {
    if (chosen) return CEFR.find(b => b.id === chosen) ?? CEFR[0]
    const words = new Set(vocab.map(v => v.text.trim().toLowerCase()).filter(Boolean)).size
    return studyLevel(words, xpSummary(events).total)
  }, [vocab, events, chosen])
}
