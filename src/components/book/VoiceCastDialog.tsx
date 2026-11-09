// Vozes da leitura, no formato enxuto: narrador, voz feminina e voz masculina. Cada personagem usa a
// voz do seu gênero (crianças um pouco mais rápidas); a lista abaixo corrige quando o app errar.
import { useMemo, useState, type ReactNode } from 'react'
import { Play, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Book } from '@/store/useBookStore'
import { KOKORO_VOICES, getKokoroVoice } from '@/lib/kokoro/voices'
import { activeKokoroVoice } from '@/lib/kokoro/engine'
import { speak } from '@/lib/tts'
import { GROUP_LABEL, buildVoiceCast, defaultFemaleVoice, defaultMaleVoice, type VoiceRole, type VoiceSettings } from '@/lib/voiceCast'
import { VoiceAvatar } from '@/components/settings/VoiceAvatar'

type Doc = VoiceSettings & { characterVoices?: boolean; narratorVoice?: string }

export function VoiceCastDialog({ book, open, pt, onOpenChange, onSave }: {
  book: Book; open: boolean; pt: boolean
  onOpenChange: (open: boolean) => void
  onSave: (doc: Book['comicStyleDoc']) => void
}) {
  const doc = (book.comicStyleDoc ?? {}) as Doc
  const enabled = doc.characterVoices !== false
  const readingVoice = activeKokoroVoice()
  const narrator = doc.narratorVoice ?? readingVoice
  const female = doc.femaleVoice ?? defaultFemaleVoice(narrator)
  const male = doc.maleVoice ?? defaultMaleVoice(narrator)
  const characters = useMemo(() => (book.comicCharacters ?? []).filter(c => c.id && !/^group of /i.test(c.name)), [book.comicCharacters])
  const cast = useMemo(() => buildVoiceCast(characters, narrator, doc), [characters, narrator, doc])
  const [previewing, setPreviewing] = useState<string | null>(null)
  const save = (patch: Doc) => onSave({ ...(book.comicStyleDoc ?? {}), ...patch } as Book['comicStyleDoc'])

  const preview = async (key: string, voice: string | null | undefined, line: string) => {
    if (!voice) return
    setPreviewing(key)
    try { await (await speak(line, { language: 'en', kokoroVoice: voice, context: 'phrase' })).done } finally { setPreviewing(null) }
  }

  const voiceSelect = (value: string, onChange: (v: string) => void, gender: 'female' | 'male' | 'any', label: string, extra?: ReactNode) => (
    <select value={value} aria-label={label} onChange={e => onChange(e.target.value)}
      className="h-9 w-[150px] shrink-0 rounded-full border px-3 text-sm"
      style={{ backgroundColor: 'var(--theme-bg)', borderColor: 'var(--theme-border-subtle)', color: 'var(--theme-text)' }}>
      {extra}
      {KOKORO_VOICES.filter(v => gender === 'any' || v.gender === gender).map(v => <option key={v.id} value={v.id}>{v.name} · {v.accent}</option>)}
    </select>
  )

  const rows: { key: string; title: string; hint: string; voice: string | null; select: ReactNode; sample: string }[] = [
    { key: 'narrator', title: pt ? 'Narrador' : 'Narrator', hint: pt ? 'Tudo o que não é fala' : 'Everything that is not dialogue', voice: narrator,
      sample: 'Once upon a time, in a quiet town, a story began.',
      select: voiceSelect(doc.narratorVoice ?? '', v => save({ narratorVoice: v || undefined }), 'any', pt ? 'Voz do narrador' : 'Narrator voice',
        <option value="">{pt ? `Voz da leitura (${getKokoroVoice(readingVoice)?.name ?? '—'})` : `Reading voice (${getKokoroVoice(readingVoice)?.name ?? '—'})`}</option>) },
    { key: 'female', title: pt ? 'Voz feminina' : 'Female voice', hint: pt ? 'Mulheres e meninas' : 'Women and girls', voice: female,
      sample: 'Hello! It is lovely to meet you.', select: voiceSelect(female, v => save({ femaleVoice: v }), 'female', pt ? 'Voz feminina' : 'Female voice') },
    { key: 'male', title: pt ? 'Voz masculina' : 'Male voice', hint: pt ? 'Homens e meninos' : 'Men and boys', voice: male,
      sample: 'Good evening. I have been expecting you.', select: voiceSelect(male, v => save({ maleVoice: v }), 'male', pt ? 'Voz masculina' : 'Male voice') },
  ]
  const roleLabel: Record<VoiceRole, string> = pt ? { female: 'Feminina', male: 'Masculina', narrator: 'Narrador' } : { female: 'Female', male: 'Male', narrator: 'Narrator' }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-1 [&>*]:min-w-0 w-[min(94vw,520px)] max-w-none sm:max-w-none max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5" style={{ color: 'var(--theme-accent)' }} />
            {pt ? 'Vozes da leitura' : 'Reading voices'}</DialogTitle>
          <DialogDescription>
            {pt ? 'Três vozes: o narrador e uma voz feminina e uma masculina para as falas dos personagens.'
              : 'Three voices: the narrator, plus a female and a male voice for the characters’ lines.'}
          </DialogDescription>
        </DialogHeader>

        <label className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border p-3 cursor-pointer" style={{ borderColor: 'var(--theme-border-subtle)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{pt ? 'Falas com voz de homem e de mulher' : 'Male and female voices for dialogue'}</span>
          <input type="checkbox" className="shrink-0 w-5 h-5 accent-[var(--theme-accent,#7756c6)]" checked={enabled} onChange={e => save({ characterVoices: e.target.checked })} />
        </label>

        <div className="min-w-0 space-y-2">
          {rows.map(row => (
            <div key={row.key} className={`flex min-w-0 items-center gap-3 rounded-2xl border p-2.5 ${row.key !== 'narrator' && !enabled ? 'opacity-50 pointer-events-none' : ''}`}
              style={{ borderColor: 'var(--theme-border-subtle)' }}>
              {getKokoroVoice(row.voice) && <VoiceAvatar voice={getKokoroVoice(row.voice)!} size={36} />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{row.title}</p>
                <p className="text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>{row.hint}</p>
              </div>
              <button type="button" onClick={() => preview(row.key, row.voice, row.sample)} disabled={!readingVoice}
                className="w-8 h-8 shrink-0 rounded-full grid place-items-center hover:bg-[var(--theme-nav-hover)] disabled:opacity-40"
                title={pt ? 'Ouvir' : 'Listen'} aria-label={pt ? 'Ouvir' : 'Listen'} style={{ color: 'var(--theme-text)' }}>
                <Play className={`w-4 h-4 ${previewing === row.key ? 'animate-pulse' : ''}`} fill="currentColor" />
              </button>
              {row.select}
            </div>
          ))}
        </div>

        {characters.length > 0 && enabled && (
          <details className="min-w-0 rounded-2xl border p-3" style={{ borderColor: 'var(--theme-border-subtle)' }}>
            <summary className="cursor-pointer text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
              {pt ? `Personagens (${characters.length}) — corrigir voz de alguém` : `Characters (${characters.length}) — fix someone’s voice`}
            </summary>
            <div className="mt-2 divide-y" style={{ borderColor: 'var(--theme-border-subtle)' }}>
              {characters.map(c => {
                const entry = cast[c.id!]
                return (
                  <div key={c.id} className="flex min-w-0 items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--theme-text)' }} title={c.name}>{c.name}</span>
                    <span className="hidden sm:inline text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>{GROUP_LABEL[entry.group][pt ? 'pt' : 'en']}</span>
                    <select value={entry.role} aria-label={pt ? `Voz de ${c.name}` : `Voice for ${c.name}`}
                      onChange={e => save({ voiceRoles: { ...(doc.voiceRoles ?? {}), [c.id!]: e.target.value as VoiceRole } })}
                      className="h-8 w-[118px] shrink-0 rounded-full border px-2 text-xs"
                      style={{ backgroundColor: 'var(--theme-bg)', borderColor: 'var(--theme-border-subtle)', color: 'var(--theme-text)' }}>
                      {(['female', 'male', 'narrator'] as const).map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}
                    </select>
                  </div>
                )
              })}
            </div>
          </details>
        )}
        <p className="text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Crianças usam a voz do seu gênero um pouco mais rápida. Animais e objetos seguem o gênero quando a história deixa claro; senão, ficam com o narrador.'
            : 'Children use their gender’s voice slightly faster. Animals and objects follow the gender when the story makes it clear; otherwise they use the narrator.'}
        </p>
      </DialogContent>
    </Dialog>
  )
}
