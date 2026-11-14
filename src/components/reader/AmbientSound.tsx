// Som ambiente durante a leitura (chuva, lareira…). Um único <audio> em loop para o app inteiro;
// a escolha e o volume ficam salvos no aparelho. Novas trilhas entram em AMBIENTS.
import { useEffect, useState, type ComponentType } from 'react'
import { CloudRain, Flame, Music, VolumeX } from 'lucide-react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToolButton } from '@/components/ui/toolbar'

type AmbientId = 'rain' | 'fireplace'
export const AMBIENTS: { id: AmbientId; src: string; icon: ComponentType<{ className?: string }>; pt: string; en: string }[] = [
  { id: 'rain', src: '/sounds/rain.m4a', icon: CloudRain, pt: 'Chuva', en: 'Rain' },
  { id: 'fireplace', src: '/sounds/fireplace.m4a', icon: Flame, pt: 'Lareira', en: 'Fireplace' },
]

const useAmbience = create<{ track: AmbientId | null; volume: number; setTrack: (t: AmbientId | null) => void; setVolume: (v: number) => void }>()(
  persist((set) => ({ track: null, volume: 0.5, setTrack: track => set({ track }), setVolume: volume => set({ volume }) }), { name: 'bookmoo-ambience', partialize: s => ({ volume: s.volume }) }),
)

let audio: HTMLAudioElement | null = null
function play(src: string, volume: number) {
  if (!audio) { audio = new Audio(); audio.loop = true; audio.preload = 'auto' }
  if (!audio.src.endsWith(src)) audio.src = src
  audio.volume = volume
  void audio.play().catch(() => { /* o navegador pode bloquear até o primeiro toque */ })
}
export function stopAmbience() { audio?.pause(); useAmbience.getState().setTrack(null) }

export function AmbientSoundButton({ pt }: { pt: boolean }) {
  const { track, volume, setTrack, setVolume } = useAmbience()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const item = AMBIENTS.find(a => a.id === track)
    if (item) play(item.src, volume); else audio?.pause()
  }, [track])
  useEffect(() => { if (audio) audio.volume = volume }, [volume])
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolButton icon={<Music className="w-4 h-4" />} active={!!track} hint={pt ? 'Som ambiente para ler' : 'Ambient sound for reading'} aria-label={pt ? 'Som ambiente' : 'Ambient sound'} />
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="end" side="bottom" sideOffset={8} collisionPadding={12}>
        <p className="px-2 pt-1 pb-2 text-[12.5px] font-medium">{pt ? 'Som ambiente' : 'Ambient sound'}</p>
        <div className="space-y-0.5">
          {AMBIENTS.map(({ id, icon: Icon, pt: namePt, en }) => {
            const on = track === id
            return (
              <button key={id} type="button" onClick={() => setTrack(on ? null : id)} aria-pressed={on}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 h-10 text-[13.5px] transition-colors hover:bg-[var(--ui-hover)]"
                style={{ backgroundColor: on ? 'var(--theme-nav-active)' : undefined, fontWeight: on ? 600 : 400 }}>
                <Icon className="w-4 h-4" />{pt ? namePt : en}
                {on && <span className="ml-auto flex items-end gap-[2px] h-3" aria-hidden>{[0, 1, 2].map(i => <span key={i} className="w-[3px] rounded-sm animate-pulse" style={{ height: `${6 + i * 3}px`, backgroundColor: 'currentColor', animationDelay: `${i * 150}ms` }} />)}</span>}
              </button>
            )
          })}
        </div>
        <label className="mt-2 flex items-center gap-2 px-2 pb-1 text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Volume' : 'Volume'}
          <input type="range" min={0} max={1} step={0.05} value={volume} onChange={e => setVolume(Number(e.target.value))} className="flex-1 accent-[var(--theme-primary)]" aria-label={pt ? 'Volume do som ambiente' : 'Ambient volume'} />
        </label>
        {track && (
          <button type="button" onClick={() => setTrack(null)} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 h-9 text-[12.5px] hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-text-secondary)' }}>
            <VolumeX className="w-4 h-4" />{pt ? 'Desligar' : 'Turn off'}
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
