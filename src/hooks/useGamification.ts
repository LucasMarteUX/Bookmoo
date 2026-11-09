// Liga a gamificação ao resto do app num lugar só: conecta o XP à conta, converte o histórico
// (práticas e palavras aprendidas, com a data original) e premia cada nova conquista.
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { recoveredWords, usePracticeStore, type PracticeSession } from '@/store/usePracticeStore'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { XP, useXpStore } from '@/store/useXpStore'

function awardSession(s: PracticeSession) {
  const { award } = useXpStore.getState()
  if (s.kind === 'speak') award(`speak:${s.id}`, XP.speakPage(s.stars), s.createdAt)
  else award(`write:${s.id}`, XP.writePage(s.ok, s.stars), s.createdAt)
  // Bônus em dobro pelas palavras que antes saíram erradas e agora saíram certas.
  const recovered = recoveredWords(s, usePracticeStore.getState().sessions)
  if (recovered.length) award(`recovered:${s.id}`, recovered.length * XP.recoveredWord, s.createdAt)
}

export function useGamification() {
  const { session, hasSupabase } = useAuth()
  const userId = session?.user?.id ?? null

  useEffect(() => {
    let alive = true
    void useXpStore.getState().connect(hasSupabase ? supabase : null, userId).then(() => {
      if (!alive) return
      // Histórico: cada prática e cada palavra aprendida vira pontos uma única vez.
      usePracticeStore.getState().sessions.forEach(awardSession)
      for (const v of useVocabularyStore.getState().vocabularies) {
        if (v.status === 'learned') useXpStore.getState().award(`learned:${v.id}`, XP.learnedWord, v.createdAt)
      }
    })
    return () => { alive = false }
  }, [hasSupabase, userId])

  // Novas conquistas, assim que acontecem.
  useEffect(() => {
    const offPractice = usePracticeStore.subscribe((state, prev) => {
      // A lista pode chegar reordenada do servidor; premiar todas é seguro (cada chave conta uma vez).
      if (state.sessions !== prev.sessions) state.sessions.forEach(awardSession)
    })
    const offVocab = useVocabularyStore.subscribe((state, prev) => {
      const before = new Map(prev.vocabularies.map(v => [v.id, v.status]))
      for (const v of state.vocabularies) {
        // Palavra que acabou de chegar (ex.: carregada do servidor) usa a data dela; marcada agora usa agora.
        if (v.status === 'learned' && before.get(v.id) !== 'learned') useXpStore.getState().award(`learned:${v.id}`, XP.learnedWord, before.has(v.id) ? Date.now() : v.createdAt)
      }
    })
    return () => { offPractice(); offVocab() }
  }, [])
}
