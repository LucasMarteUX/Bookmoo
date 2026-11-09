// Estatísticas das práticas (Falar e Escrever/ditado): filtros por atividade e livro, notas por
// página, evolução e as palavras que o aluno mais erra (com envio para a revisão do vocabulário).
import { useEffect, useMemo, useState } from 'react'
import { Check, Keyboard, Mic, Plus, Star, Volume2 } from 'lucide-react'
import { usePracticeStore, type PracticeKind } from '@/store/usePracticeStore'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { upsertVocabulary } from '@/lib/supabaseSync'
import { sayWord } from '@/lib/sayWord'
import { ToolButton, ToolGroup } from '@/components/ui/toolbar'

const card = { backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }
const scoreColor = (a: number) => a >= 80 ? '#34C46F' : a >= 60 ? '#E59A12' : '#F0524F'

export function PracticeStats({ pt, fixedKind }: { pt: boolean; fixedKind?: PracticeKind }) {
  const sessions = usePracticeStore(s => s.sessions)
  const { session, hasSupabase } = useAuth()
  const userId = session?.user?.id
  useEffect(() => {
    if (hasSupabase && supabase && userId) void usePracticeStore.getState().syncWithServer(supabase, userId)
  }, [hasSupabase, userId])

  const [kind, setKind] = useState<PracticeKind | 'all'>(fixedKind ?? 'all')
  useEffect(() => { if (fixedKind) setKind(fixedKind) }, [fixedKind])
  const [bank, setBank] = useState<'ok' | 'close' | 'bad' | 'skipped'>('bad')
  const [bookId, setBookId] = useState<string>('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [added, setAdded] = useState(0)

  const books = useMemo(() => {
    const map = new Map<string, string>()
    sessions.forEach(s => map.set(s.bookId, s.bookTitle))
    return [...map.entries()]
  }, [sessions])
  const filtered = useMemo(() => sessions.filter(s => (kind === 'all' || s.kind === kind) && (bookId === 'all' || s.bookId === bookId)), [sessions, kind, bookId])

  const avg = filtered.length ? Math.round(filtered.reduce((a, s) => a + s.accuracy, 0) / filtered.length) : 0
  const best = filtered.reduce((a, s) => Math.max(a, s.accuracy), 0)
  const stars = filtered.reduce((a, s) => a + s.stars, 0)
  const recent = filtered.slice(-20)

  // Resumo por página: última nota, melhor nota e tentativas.
  const pages = useMemo(() => {
    const map = new Map<string, { bookTitle: string; page: number; kind: PracticeKind; last: number; best: number; tries: number; stars: number; at: number }>()
    for (const s of filtered) {
      const key = `${s.bookId}|${s.page}|${s.kind}`
      const row = map.get(key) ?? { bookTitle: s.bookTitle, page: s.page, kind: s.kind, last: 0, best: 0, tries: 0, stars: 0, at: 0 }
      row.last = s.accuracy; row.best = Math.max(row.best, s.accuracy); row.tries++; row.stars = Math.max(row.stars, s.stars); row.at = s.createdAt
      map.set(key, row)
    }
    return [...map.values()].sort((a, b) => b.at - a.at).slice(0, 30)
  }, [filtered])

  // Palavras mais erradas: quantas vezes erradas e em quantas tentativas recentes ainda aparecem.
  const missed = useMemo(() => {
    const count = new Map<string, number>()
    for (const s of filtered) for (const w of new Set(s.missed)) count.set(w, (count.get(w) ?? 0) + 1)
    return [...count.entries()].filter(([w]) => w.length > 1).sort((a, b) => b[1] - a[1]).slice(0, 40)
  }, [filtered])

  // Banco de palavras: quantas vezes cada palavra saiu certa, quase, errada ou pulada.
  const banks = useMemo(() => {
    const out = { ok: new Map<string, number>(), close: new Map<string, number>(), bad: new Map<string, number>(), skipped: new Map<string, number>() }
    for (const s of filtered) {
      if (!s.words) continue
      for (const key of ['ok', 'close', 'bad', 'skipped'] as const) for (const w of s.words[key]) out[key].set(w, (out[key].get(w) ?? 0) + 1)
    }
    return Object.fromEntries(Object.entries(out).map(([k, m]) => [k, [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))])) as Record<'ok' | 'close' | 'bad' | 'skipped', [string, number][]>
  }, [filtered])

  const togglePick = (w: string) => setPicked(prev => { const next = new Set(prev); if (next.has(w)) next.delete(w); else next.add(w); return next })
  const addToReview = () => {
    const store = useVocabularyStore.getState()
    const target = bookId !== 'all' ? bookId : filtered.at(-1)?.bookId
    if (!target) return
    let n = 0
    for (const w of picked) {
      const existing = store.vocabularies.find(v => v.bookId === target && v.text.toLowerCase() === w)
      const saved = existing
        ? (store.updateVocabulary(existing.id, { status: 'review' }), { ...existing, status: 'review' as const })
        : store.addVocabulary({ bookId: target, text: w, type: 'word', status: 'review', explanation: '', examples: [] })
      if (hasSupabase && supabase && userId) void upsertVocabulary(supabase, userId, saved).catch(() => {})
      n++
    }
    setAdded(n)
    setPicked(new Set())
    setTimeout(() => setAdded(0), 2500)
  }

  const label = (k: PracticeKind) => k === 'speak' ? (pt ? 'Falar' : 'Speak') : (pt ? 'Ditado' : 'Dictation')

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!fixedKind && <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text)' }}>{pt ? 'Prática de fala e escrita' : 'Speaking and writing practice'}</h2>}
          {!fixedKind && <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Notas das leituras em voz alta (Falar) e dos ditados (Escrever).' : 'Scores from reading aloud (Speak) and dictations (Write).'}
          </p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!fixedKind && <ToolGroup label={pt ? 'Atividade' : 'Activity'}>
            <ToolButton label={pt ? 'Tudo' : 'All'} active={kind === 'all'} onClick={() => setKind('all')} />
            <ToolButton icon={<Mic className="w-4 h-4" />} label={label('speak')} active={kind === 'speak'} onClick={() => setKind('speak')} />
            <ToolButton icon={<Keyboard className="w-4 h-4" />} label={label('write')} active={kind === 'write'} onClick={() => setKind('write')} />
          </ToolGroup>}
          <select value={bookId} onChange={e => setBookId(e.target.value)} aria-label={pt ? 'Livro' : 'Book'}
            className="h-11 rounded-full border px-4 text-sm max-w-[220px]" style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)', color: 'var(--theme-text)' }}>
            <option value="all">{pt ? 'Todos os livros' : 'All books'}</option>
            {books.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        </div>
      </div>

      {!filtered.length ? (
        <div className="rounded-2xl border p-6 text-sm text-center" style={{ ...card, color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Ainda não há práticas aqui. Abra um livro e use as abas Falar ou Escrever → Treino de ditado.' : 'No practice yet. Open a book and use the Speak tab or Write → Dictation practice.'}
        </div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              [pt ? 'Tentativas' : 'Attempts', String(filtered.length), 'var(--theme-text)'],
              [pt ? 'Média' : 'Average', `${avg}%`, scoreColor(avg)],
              [pt ? 'Melhor nota' : 'Best score', `${best}%`, scoreColor(best)],
              [pt ? 'Estrelas' : 'Stars', `★ ${stars}`, '#E0A800'],
            ].map(([k, v, c]) => (
              <div key={k} className="rounded-2xl border p-4" style={card}>
                <div className="text-sm" style={{ color: 'var(--theme-nav-text-muted)' }}>{k}</div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: c }}>{v}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border p-4" style={card}>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--theme-text)' }}>{pt ? 'Evolução (últimas tentativas)' : 'Progress (latest attempts)'}</p>
            <div className="relative h-36 pl-8">
              {/* Linhas de referência */}
              {[100, 50, 0].map(v => (
                <div key={v} className="absolute left-0 right-0 flex items-center gap-2" style={{ bottom: `calc(${v}% * 0.78 + 22px)` }}>
                  <span className="w-6 text-right text-[10px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{v}</span>
                  <span className="flex-1 border-t border-dashed" style={{ borderColor: 'var(--theme-border-subtle)' }} />
                </div>
              ))}
              <div className="absolute inset-0 left-8 flex items-end gap-2 overflow-x-auto">
                {recent.map(s => (
                  <div key={s.id} className="flex flex-col items-center justify-end h-full shrink-0 w-7"
                    title={`${s.bookTitle} · ${pt ? 'pág.' : 'p.'} ${s.page + 1} · ${s.accuracy}%`}>
                    <span className="text-[10px] font-semibold tabular-nums mb-0.5" style={{ color: scoreColor(s.accuracy) }}>{s.accuracy}</span>
                    <div className="w-full rounded-t-md" style={{ height: `calc(${Math.max(3, s.accuracy)}% * 0.78)`, backgroundColor: scoreColor(s.accuracy), opacity: s.kind === 'speak' ? 1 : 0.75 }} />
                    <span className="h-[22px] pt-1 text-[10px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'p.' : 'p.'}{s.page + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>


          <div className="rounded-2xl border p-4" style={card}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
                {kind === 'write' ? (pt ? 'Palavras do ditado' : 'Dictation words') : kind === 'speak' ? (pt ? 'Palavras da leitura' : 'Reading words') : (pt ? 'Palavras' : 'Words')}
              </p>
              <ToolGroup label={pt ? 'Resultado' : 'Result'}>
                {([
                  ['ok', kind === 'write' ? (pt ? 'Digitou certo' : 'Typed right') : (pt ? 'Falou certo' : 'Said right'), '#34C46F'],
                  ['close', pt ? 'Quase' : 'Close', '#E59A12'],
                  ['bad', kind === 'write' ? (pt ? 'Digitou errado' : 'Typed wrong') : (pt ? 'Falou errado' : 'Said wrong'), '#F0524F'],
                  ['skipped', kind === 'write' ? (pt ? 'Pulou' : 'Skipped') : (pt ? 'Não falou' : 'Not said'), 'var(--theme-text-secondary)'],
                ] as const).map(([key, text, color]) => (
                  <ToolButton key={key} active={bank === key} onClick={() => setBank(key)}
                    label={<><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: color }} />{text} <span className="opacity-60 tabular-nums">{banks[key].length}</span></>} />
                ))}
              </ToolGroup>
            </div>
            {banks[bank].length ? (
              <div className="flex flex-wrap gap-1.5 max-h-72 overflow-y-auto">
                {banks[bank].map(([w, n]) => (
                  <button key={w} type="button" onClick={() => sayWord(w)}
                    className={`speak-word speak-chip ${bank === 'ok' ? 'speak-ok' : bank === 'close' ? 'speak-close' : bank === 'bad' ? 'speak-bad' : ''} text-sm inline-flex items-center gap-1`}
                    style={bank === 'skipped' ? { backgroundColor: 'var(--theme-bg-secondary)' } : undefined}
                    title={pt ? 'Ouvir' : 'Listen'}>
                    {w}{n > 1 && <span className="text-[11px] opacity-60 tabular-nums">{n}×</span>}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                {pt ? 'Nada aqui ainda. (Tentativas anteriores a esta versão não guardaram a lista de palavras.)' : 'Nothing here yet. (Attempts before this version did not store word lists.)'}
              </p>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border p-4" style={card}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>{pt ? 'Palavras que você mais erra' : 'Words you miss most'}</p>
                {picked.size > 0 && (
                  <button type="button" onClick={addToReview} className="btn-3d btn-3d--review text-xs">
                    <Plus className="w-3.5 h-3.5" strokeWidth={3} /> {pt ? `Revisar ${picked.size}` : `Review ${picked.size}`}
                  </button>
                )}
                {added > 0 && <span className="text-xs inline-flex items-center gap-1" style={{ color: '#34C46F' }}><Check className="w-3.5 h-3.5" /> {pt ? `${added} na revisão` : `${added} added`}</span>}
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--theme-text-secondary)' }}>
                {pt ? 'Toque no alto-falante para ouvir; marque as palavras para mandá-las à revisão do vocabulário.' : 'Tap the speaker to listen; select words to send them to vocabulary review.'}
              </p>
              {missed.length ? (
                <div className="flex flex-wrap gap-2">
                  {missed.map(([w, n]) => (
                    <span key={w} className={`inline-flex items-center rounded-full border text-sm overflow-hidden ${picked.has(w) ? 'ring-2 ring-[var(--theme-accent,#7756c6)]' : ''}`}
                      style={{ borderColor: 'var(--theme-border-subtle)', backgroundColor: 'var(--theme-bg-secondary)' }}>
                      <button type="button" onClick={() => sayWord(w)} className="pl-2.5 pr-1 py-1 hover:opacity-70" aria-label={pt ? `Ouvir ${w}` : `Hear ${w}`}>
                        <Volume2 className="w-3.5 h-3.5" style={{ color: 'var(--theme-text-secondary)' }} />
                      </button>
                      <button type="button" onClick={() => togglePick(w)} className="pr-2.5 py-1 inline-flex items-center gap-1.5" style={{ color: 'var(--theme-text)' }}>
                        {w} <span className="text-[11px] tabular-nums rounded-full px-1.5" style={{ backgroundColor: 'color-mix(in srgb, #F0524F 18%, transparent)', color: '#C2312E' }}>{n}×</span>
                      </button>
                    </span>
                  ))}
                </div>
              ) : <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Nenhum erro registrado. 🎉' : 'No mistakes recorded. 🎉'}</p>}
            </div>

            <div className="rounded-2xl border p-4" style={card}>
              <p className="text-sm font-semibold mb-3" style={{ color: 'var(--theme-text)' }}>{pt ? 'Resumo por página' : 'By page'}</p>
              <div className="divide-y" style={{ borderColor: 'var(--theme-border-subtle)' }}>
                {pages.map(p => (
                  <div key={`${p.bookTitle}${p.page}${p.kind}`} className="flex items-center gap-3 py-2 text-sm">
                    {p.kind === 'speak' ? <Mic className="w-4 h-4 shrink-0 opacity-60" /> : <Keyboard className="w-4 h-4 shrink-0 opacity-60" />}
                    <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--theme-text)' }}>
                      {p.bookTitle} <span style={{ color: 'var(--theme-text-secondary)' }}>· {pt ? 'pág.' : 'p.'} {p.page + 1}</span>
                    </span>
                    <span className="hidden sm:inline text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{p.tries}×</span>
                    <span className="inline-flex">{[0, 1, 2].map(i => <Star key={i} className="w-3.5 h-3.5" fill={i < p.stars ? '#FFC83D' : 'none'} stroke={i < p.stars ? '#E0A800' : 'var(--theme-text-secondary)'} />)}</span>
                    <span className="w-24 text-right tabular-nums font-semibold" style={{ color: scoreColor(p.last) }}>
                      {p.last}% <span className="text-xs font-normal" style={{ color: 'var(--theme-text-secondary)' }}>({pt ? 'máx' : 'best'} {p.best})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
