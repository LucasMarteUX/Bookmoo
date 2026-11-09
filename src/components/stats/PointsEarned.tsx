// Linha de recompensa no fim de uma prática: pontos da página + bônus em dobro pelas palavras
// que o aluno tinha errado antes e agora acertou.
import { motion } from 'motion/react'
import { recoveredWords, usePracticeStore, type PracticeKind } from '@/store/usePracticeStore'
import { XP } from '@/store/useXpStore'
import { sayWord } from '@/lib/sayWord'

export function PointsEarned({ kind, bookId, page, pt }: { kind: PracticeKind; bookId: string; page: number; pt: boolean }) {
  const sessions = usePracticeStore(s => s.sessions)
  const last = [...sessions].reverse().find(s => s.kind === kind && s.bookId === bookId && s.page === page)
  if (!last) return null
  const base = kind === 'speak' ? XP.speakPage(last.stars) : XP.writePage(last.ok, last.stars)
  const recovered = recoveredWords(last, sessions)
  const bonus = recovered.length * XP.recoveredWord
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
      className="mt-3 rounded-2xl px-3 py-2 text-sm flex flex-wrap items-center gap-x-3 gap-y-1"
      style={{ backgroundColor: 'color-mix(in srgb, #FFC83D 14%, transparent)', color: 'var(--theme-text)' }}>
      <span className="font-semibold">⭐ +{base + bonus} {pt ? 'pontos' : 'points'}</span>
      {recovered.length > 0 && (
        <span className="inline-flex flex-wrap items-center gap-1" style={{ color: 'var(--theme-text-secondary)' }}>
          🔁 {pt ? `${recovered.length} palavra(s) que você tinha errado — em dobro (+${bonus}):` : `${recovered.length} word(s) you had missed — double points (+${bonus}):`}
          {recovered.slice(0, 8).map(w => (
            <button key={w} type="button" onClick={() => sayWord(w)} className="speak-word speak-ok px-1 rounded">{w}</button>
          ))}
        </span>
      )}
    </motion.div>
  )
}
