// Data de nascimento guardada nos metadados da conta (privada, não aparece no perfil).
// Usada só para indicar quais livros estão acima da idade da pessoa.
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { ageFrom } from '@/lib/catalog'

export function useBirthDate() {
  const { session } = useAuth()
  return (session?.user?.user_metadata?.birth_date as string | undefined) ?? ''
}

export function BirthDateField({ pt, onSaved, compact = false }: { pt: boolean; onSaved?: () => void; compact?: boolean }) {
  const current = useBirthDate()
  const [value, setValue] = useState(current)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const save = async () => {
    if (!supabase || ageFrom(value) === null) { setState('error'); return }
    setState('saving')
    const { error } = await supabase.auth.updateUser({ data: { birth_date: value } })
    setState(error ? 'error' : 'saved')
    if (!error) onSaved?.()
  }
  return (
    <div className={compact ? 'flex flex-wrap items-center gap-2' : 'flex flex-wrap items-center gap-2'}>
      <input type="date" value={value} max={new Date().toISOString().slice(0, 10)} onChange={e => { setValue(e.target.value); setState('idle') }}
        aria-label={pt ? 'Data de nascimento' : 'Date of birth'}
        className="h-9 rounded-lg border px-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }} />
      <button type="button" disabled={!value || state === 'saving' || value === current} onClick={() => { void save() }}
        className="h-9 px-4 rounded-full text-[13px] font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
        {state === 'saving' ? (pt ? 'Salvando…' : 'Saving…') : (pt ? 'Salvar' : 'Save')}
      </button>
      {state === 'saved' && <span className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Salvo.' : 'Saved.'}</span>}
      {state === 'error' && <span className="text-[12.5px]" style={{ color: 'var(--color-destructive)' }}>{pt ? 'Data inválida ou erro ao salvar.' : 'Invalid date or save error.'}</span>}
    </div>
  )
}
