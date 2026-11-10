import { useEffect, useRef } from 'react'
import { Bold, Highlighter, Italic, List, ListOrdered, RemoveFormatting, Underline } from 'lucide-react'

const COLORS = ['#E24B4B', '#E09A2B', '#3E9B62', '#3C7BE0', '#8A5CD0']

function run(command: string, value?: string) {
  document.execCommand('styleWithCSS', false, 'true')
  document.execCommand(command, false, value)
}

/** Anotações com as ferramentas básicas de texto: negrito, lista, marca-texto e cor. */
export function NotesEditor({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const seeded = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || seeded.current) return
    seeded.current = true
    if (value && /<[a-z]/i.test(value)) el.innerHTML = value
    else el.textContent = value
  }, [value])

  const tool = 'w-8 h-8 grid place-items-center rounded-md transition-colors hover:bg-[var(--theme-nav-hover)]'
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)' }}>
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b" style={{ borderColor: 'var(--theme-border)' }}>
        <button type="button" className={tool} title="Bold" onMouseDown={(e) => { e.preventDefault(); run('bold') }}><Bold className="w-4 h-4" /></button>
        <button type="button" className={tool} title="Italic" onMouseDown={(e) => { e.preventDefault(); run('italic') }}><Italic className="w-4 h-4" /></button>
        <button type="button" className={tool} title="Underline" onMouseDown={(e) => { e.preventDefault(); run('underline') }}><Underline className="w-4 h-4" /></button>
        <span className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--theme-border)' }} />
        <button type="button" className={tool} title="Bullets" onMouseDown={(e) => { e.preventDefault(); run('insertUnorderedList') }}><List className="w-4 h-4" /></button>
        <button type="button" className={tool} title="Numbers" onMouseDown={(e) => { e.preventDefault(); run('insertOrderedList') }}><ListOrdered className="w-4 h-4" /></button>
        <button type="button" className={tool} title="Highlight" onMouseDown={(e) => { e.preventDefault(); run('hiliteColor', '#F6E7A1') }}><Highlighter className="w-4 h-4" /></button>
        <span className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--theme-border)' }} />
        <button type="button" className="h-8 px-2 rounded-md text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}
          onMouseDown={(e) => { e.preventDefault(); run('fontName', 'Georgia') }}>Serif</button>
        <button type="button" className="h-8 px-2 rounded-md text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}
          onMouseDown={(e) => { e.preventDefault(); run('fontName', 'Helvetica') }}>Sans</button>
        <span className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--theme-border)' }} />
        {COLORS.map(color => (
          <button key={color} type="button" aria-label={color} className="w-5 h-5 rounded-full border"
            style={{ backgroundColor: color, borderColor: 'var(--theme-border)' }}
            onMouseDown={(e) => { e.preventDefault(); run('foreColor', color) }} />
        ))}
        <button type="button" className={tool} title="Clear" onMouseDown={(e) => { e.preventDefault(); run('removeFormat') }}><RemoveFormatting className="w-4 h-4" /></button>
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-label={placeholder}
        data-placeholder={placeholder}
        className="notes-editor min-h-[180px] px-4 py-3 text-[15px] leading-relaxed outline-none"
        style={{ color: 'var(--theme-text)' }}
        onInput={(e) => onChange((e.currentTarget.innerHTML || '').replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ''))}
      />
    </div>
  )
}
