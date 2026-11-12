// Ajudas de escrita da comunidade: emoji e marcar pessoas com @. Sem biblioteca externa.
import { Fragment, forwardRef, useEffect, useImperativeHandle, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { Smile } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Avatar } from '@/components/ui/avatar'
import { listPeople, type PersonCard } from '@/lib/communityProfile'

// Livros e leitura primeiro (é o que mais se usa aqui), depois natureza, carinhas e símbolos.
const EMOJI_GROUPS: { id: string; icon: string; pt: string; en: string; items: string[] }[] = [
  { id: 'books', icon: '📚', pt: 'Leitura', en: 'Reading', items: [
    '📚', '📖', '📕', '📗', '📘', '📙', '📓', '📔', '📒', '📃', '📜', '🔖', '📝', '✍️', '🖋️', '✒️',
    '🖊️', '✏️', '📑', '🗂️', '🔍', '🧠', '💡', '🎓', '🗣️', '💬', '🎧', '🔤', '🔠', '🌐', '🏫', '🪶'] },
  { id: 'nature', icon: '🌙', pt: 'Natureza', en: 'Nature', items: [
    '☀️', '🌙', '🌛', '🌝', '⭐', '🌟', '✨', '💫', '☁️', '⛅', '🌧️', '⛈️', '❄️', '🌈', '🔥', '🌊',
    '🌱', '🌿', '🍃', '🍂', '🍁', '🌸', '🌻', '🌹', '🌳', '🌲', '🌵', '🍀', '🌍', '🏔️', '🌅', '🌄'] },
  { id: 'faces', icon: '😊', pt: 'Carinhas', en: 'Faces', items: [
    '😀', '😄', '😂', '🥹', '😊', '🙂', '😉', '😍', '🥰', '😘', '😎', '🤓', '🤔', '🧐', '😮', '😲',
    '😢', '😭', '😅', '🙃', '😌', '😴', '🤯', '🥳', '😇', '🤗', '🤭', '😬', '😤', '😱', '🫶', '🤩'] },
  { id: 'symbols', icon: '❤️', pt: 'Símbolos', en: 'Symbols', items: [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🖤', '👍', '👏', '🙌', '🙏', '💪', '👋', '🤝', '✌️',
    '🎉', '🎯', '✅', '🏆', '🥇', '🚀', '⏰', '📅', '☕', '🍵', '🍎', '🎵', '🎬', '✈️', '🏠', '💯'] },
]

/** Insere texto na posição do cursor e devolve o novo valor e a nova posição. */
function insertAt(el: HTMLTextAreaElement | null, value: string, text: string) {
  const start = el?.selectionStart ?? value.length
  const end = el?.selectionEnd ?? value.length
  return { value: value.slice(0, start) + text + value.slice(end), caret: start + text.length }
}

export function EmojiButton({ onPick, pt }: { onPick: (emoji: string) => void; pt: boolean }) {
  const [open, setOpen] = useState(false)
  const [group, setGroup] = useState(EMOJI_GROUPS[0].id)
  const items = EMOJI_GROUPS.find(g => g.id === group)?.items ?? []
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={pt ? 'Inserir emoji' : 'Insert emoji'} title="Emoji"
          className="h-9 w-9 grid place-items-center rounded-full transition-colors hover:bg-[var(--theme-nav-hover)]" style={{ color: 'var(--theme-text-secondary)' }}>
          <Smile className="w-[18px] h-[18px]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[316px] p-0 rounded-2xl border shadow-xl overflow-hidden" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
        <div role="tablist" className="flex border-b px-1.5 pt-1.5" style={{ borderColor: 'var(--theme-border)' }}>
          {EMOJI_GROUPS.map(g => (
            <button key={g.id} type="button" role="tab" aria-selected={group === g.id} onClick={() => setGroup(g.id)} title={pt ? g.pt : g.en}
              className="relative flex-1 h-10 grid place-items-center text-[19px] rounded-t-lg transition-colors hover:bg-[var(--theme-nav-hover)]">
              {g.icon}
              {group === g.id && <span aria-hidden className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full" style={{ backgroundColor: 'var(--theme-text)' }} />}
            </button>
          ))}
        </div>
        <p className="px-3 pt-2 text-[11.5px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? EMOJI_GROUPS.find(g => g.id === group)?.pt : EMOJI_GROUPS.find(g => g.id === group)?.en}</p>
        <div className="grid grid-cols-8 gap-0.5 p-2 pt-1">
          {items.map(emoji => (
            <button key={emoji} type="button" onClick={() => { onPick(emoji); setOpen(false) }}
              className="w-[34px] h-[34px] grid place-items-center rounded-lg text-[21px] leading-none transition-transform hover:bg-[var(--theme-nav-hover)] active:scale-90">{emoji}</button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  pt: boolean
  /** Mostra o botão de emoji ao lado (padrão: sim). */
  emoji?: boolean
}

/**
 * Textarea com @menção (sugere pessoas enquanto digita "@nome") e botão de emoji.
 * Quem for marcado recebe a notificação "mencionou você" (gatilho no banco).
 */
export const MentionTextarea = forwardRef<HTMLTextAreaElement, Props>(function MentionTextarea({ value, onChange, pt, emoji = true, className, ...rest }, ref) {
  const area = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => area.current as HTMLTextAreaElement)
  const [query, setQuery] = useState<string | null>(null)
  const [people, setPeople] = useState<PersonCard[]>([])
  const [active, setActive] = useState(0)

  // Termo depois do @ logo antes do cursor (ex.: "olá @mar|" → "mar").
  const detect = (text: string, caret: number) => {
    const match = /(?:^|[\s(])@([a-z0-9_.]{1,20})$/i.exec(text.slice(0, caret))
    setQuery(match ? match[1] : null)
  }
  useEffect(() => {
    if (!query) { setPeople([]); return }
    let alive = true
    const id = setTimeout(() => {
      void listPeople({ query, limit: 6 }).then(list => { if (alive) { setPeople(list.filter(p => p.handle && !p.isMe)); setActive(0) } })
    }, 180)
    return () => { alive = false; clearTimeout(id) }
  }, [query])

  const pick = (person: PersonCard) => {
    const el = area.current
    const caret = el?.selectionStart ?? value.length
    const before = value.slice(0, caret).replace(/@([a-z0-9_.]{1,20})$/i, `@${person.handle} `)
    const next = before + value.slice(caret)
    onChange(next)
    setQuery(null)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(before.length, before.length) })
  }
  const addEmoji = (emojiChar: string) => {
    const { value: next, caret } = insertAt(area.current, value, emojiChar)
    onChange(next)
    requestAnimationFrame(() => { area.current?.focus(); area.current?.setSelectionRange(caret, caret) })
  }
  const open = query !== null && people.length > 0

  return (
    <div className="relative">
      <textarea ref={area} {...rest} value={value} className={className}
        onChange={e => { onChange(e.target.value); detect(e.target.value, e.target.selectionStart) }}
        onKeyDown={e => {
          if (open) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % people.length); return }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + people.length) % people.length); return }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(people[active]); return }
            if (e.key === 'Escape') { e.preventDefault(); setQuery(null); return }
          }
          rest.onKeyDown?.(e)
        }}
        onBlur={e => { setTimeout(() => setQuery(null), 150); rest.onBlur?.(e) }} />
      {emoji && <div className="absolute right-1 bottom-1"><EmojiButton onPick={addEmoji} pt={pt} /></div>}
      {open && (
        <ul role="listbox" aria-label={pt ? 'Marcar pessoa' : 'Mention someone'}
          className="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-auto rounded-2xl border p-1 shadow-xl"
          style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
          {people.map((person, i) => (
            <li key={person.userId} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={e => { e.preventDefault(); pick(person) }}
                className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left"
                style={{ backgroundColor: i === active ? 'var(--theme-nav-hover)' : undefined }}>
                <Avatar src={person.avatarUrl} name={person.name || person.handle} size={30} />
                <span className="min-w-0 leading-tight">
                  <span className="block text-[13.5px] font-medium truncate">{person.name || person.handle}</span>
                  <span className="block text-[12px] truncate" style={{ color: 'var(--theme-text-secondary)' }}>@{person.handle}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})

/** Texto de post/comentário com @menções viram link para o perfil. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/((?:^|(?<=[\s(]))@[a-z0-9_.]{3,20})/gi)
  return <>{parts.map((part, i) => /^@[a-z0-9_.]{3,20}$/i.test(part)
    ? <Link key={i} to={`/u/${part.slice(1).toLowerCase()}`} className="font-medium underline-offset-2 hover:underline" style={{ color: 'var(--theme-accent, var(--theme-text))' }}>{part}</Link>
    : <Fragment key={i}>{part}</Fragment>)}</>
}
