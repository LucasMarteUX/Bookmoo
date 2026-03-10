import { Settings, Sun, Moon, Coffee, Minus, Plus } from 'lucide-react'
import { useReaderSettings } from '@/store/useReaderSettings'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function FloatingSettings() {
  const [isOpen, setIsOpen] = useState(false)
  const { theme, fontSize, lineHeight, showHighlights, setTheme, setFontSize, setLineHeight, toggleHighlights } = useReaderSettings()

  return (
    <div className="fixed right-8 top-1/2 -translate-y-1/2 z-40">
      <div 
        className="backdrop-blur-md border p-1.5 rounded-2xl shadow-2xl flex flex-col gap-1 transition-colors"
        style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)' }}
      >
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--theme-nav-hover)]"
          style={{ color: 'var(--theme-nav-text-muted)' }}
        >
          <Settings className="w-5 h-5" />
        </button>

        {isOpen && (
          <div 
            className="absolute right-14 top-0 border p-4 rounded-2xl shadow-xl w-64 flex flex-col gap-4 transition-colors"
            style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border-subtle)' }}
          >
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-nav-text-muted)' }}>Font Size</span>
              <div className="flex items-center justify-between rounded-xl p-1 transition-colors" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                <Button variant="ghost" size="icon" onClick={() => setFontSize(Math.max(14, fontSize - 2))} style={{ color: 'var(--theme-text)' }}>
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{fontSize}px</span>
                <Button variant="ghost" size="icon" onClick={() => setFontSize(Math.min(32, fontSize + 2))} style={{ color: 'var(--theme-text)' }}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-nav-text-muted)' }}>Line Height</span>
              <div className="flex items-center justify-between rounded-xl p-1 transition-colors" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                <Button variant="ghost" size="icon" onClick={() => setLineHeight(Math.max(1.2, lineHeight - 0.2))} style={{ color: 'var(--theme-text)' }}>
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{lineHeight.toFixed(1)}</span>
                <Button variant="ghost" size="icon" onClick={() => setLineHeight(Math.min(2.4, lineHeight + 0.2))} style={{ color: 'var(--theme-text)' }}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-nav-text-muted)' }}>Theme</span>
              <div className="flex gap-2">
                <Button 
                  variant={theme === 'light' ? 'default' : 'outline'} 
                  size="icon" 
                  onClick={() => setTheme('light')}
                  className="flex-1"
                >
                  <Sun className="w-4 h-4" />
                </Button>
                <Button 
                  variant={theme === 'sepia' ? 'default' : 'outline'} 
                  size="icon" 
                  onClick={() => setTheme('sepia')}
                  className="flex-1 bg-[#f4ecd8] text-[#433422] hover:bg-[#e6dcc5] border-transparent"
                >
                  <Coffee className="w-4 h-4" />
                </Button>
                <Button 
                  variant={theme === 'dark' ? 'default' : 'outline'} 
                  size="icon" 
                  onClick={() => setTheme('dark')}
                  className="flex-1 bg-zinc-900 text-white hover:bg-zinc-800 border-transparent"
                >
                  <Moon className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t transition-colors" style={{ borderColor: 'var(--theme-border-subtle)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-nav-text-muted)' }}>Highlights</span>
                <button 
                  onClick={toggleHighlights}
                  className={`w-10 h-6 rounded-full transition-colors relative ${showHighlights ? 'bg-[var(--theme-accent)]' : 'bg-zinc-200'}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${showHighlights ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
