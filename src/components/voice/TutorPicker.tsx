// Escolha do tutor (Bia ou Luck): botão redondo com o rosto do escolhido; abre uma lista e troca na hora, sem reiniciar nada.
import { useState } from 'react'
import { Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAvatarSettings } from '@/store/useAvatarSettings'
import { CHARACTERS, characterAvatarUrl, effectiveCharacterId } from '@/lib/livliv/characters'

export function TutorPicker({ pt }: { pt: boolean }) {
  const chosen = useAvatarSettings(s => s.characterId)
  const setCharacter = useAvatarSettings(s => s.setCharacter)
  const [open, setOpen] = useState(false)
  const id = effectiveCharacterId(chosen)
  const current = CHARACTERS.find(c => c.id === id)!
  if (CHARACTERS.length < 2) return null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={pt ? `Tutor: ${current.name}. Trocar` : `Tutor: ${current.name}. Change`} title={pt ? 'Escolher o tutor' : 'Choose your tutor'}
          className="w-10 h-10 rounded-full grid place-items-center transition-colors hover:bg-[var(--ui-hover)]">
          <span className="w-8 h-8 rounded-full overflow-hidden border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
            <img src={characterAvatarUrl(id)} alt="" className="w-full h-full object-cover" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" sideOffset={6} collisionPadding={12} className="w-64 p-1.5">
        <p className="px-3 pt-1.5 pb-1 text-[12px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Com quem você quer conversar?' : 'Who do you want to talk with?'}</p>
        {CHARACTERS.map(c => (
          <button key={c.id} type="button" onClick={() => { setCharacter(c.id); setOpen(false) }} aria-pressed={c.id === id}
            className="w-full h-14 px-2.5 rounded-xl flex items-center gap-3 text-left transition-colors hover:bg-[var(--ui-hover)]">
            <span className="w-10 h-10 rounded-full overflow-hidden border shrink-0" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
              <img src={characterAvatarUrl(c.id)} alt="" className="w-full h-full object-cover" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-medium leading-tight">{c.name}</span>
              <span className="block text-[12px] leading-tight" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? (c.voice.gender === 'female' ? 'Tutora' : 'Tutor') : 'Tutor'} · {pt ? c.pt : c.en}</span>
            </span>
            {c.id === id && <Check className="w-4 h-4 shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
