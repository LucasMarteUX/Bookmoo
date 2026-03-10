import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FloatingActionProps {
  rect: DOMRect
  onAdd: () => void
}

export function FloatingAction({ rect, onAdd }: FloatingActionProps) {
  return (
    <div 
      className="fixed z-50 flex items-center justify-center transform -translate-x-1/2 -translate-y-full pb-2"
      style={{
        left: rect.left + rect.width / 2,
        top: rect.top - 10
      }}
    >
      <Button 
        onMouseDown={(e) => {
          e.preventDefault() // Prevents the selection from being cleared
          e.stopPropagation()
          onAdd()
        }}
        className="floating-action-btn bg-[#00160a] text-white hover:bg-[#00160a]/90 rounded-full px-4 py-2 shadow-xl flex items-center gap-2 h-auto"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm font-medium">Adicionar Vocabulário</span>
      </Button>
    </div>
  )
}
