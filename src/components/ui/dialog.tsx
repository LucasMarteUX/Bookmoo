import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

const DialogContext = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void }>({
  open: false,
  onOpenChange: () => {},
})

export function Dialog({ open, onOpenChange, children }: { open: boolean, onOpenChange: (open: boolean) => void, children: React.ReactNode }) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])
  if (!open) return null

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto py-6 sm:py-[8vh] px-4 sm:px-0">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] dialog-fade" onClick={() => onOpenChange(false)} />
        {children}
      </div>
    </DialogContext.Provider>
  )
}

export function DialogContent({ className, children, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { onOpenChange } = React.useContext(DialogContext)
  return (
    <div 
      role="dialog" aria-modal="true"
      className={cn("elevated dialog-pop relative z-50 grid w-full max-w-lg gap-4 p-6 sm:max-w-md", className)}
      style={{
        color: 'var(--theme-text)',
        borderRadius: '16px',
        ...style
      }}
      {...props}
    >
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="absolute right-3 top-3 w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--theme-nav-hover)]"
        style={{ color: 'var(--theme-text-secondary)' }}
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>
      {children}
    </div>
  )
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-[17px] font-semibold tracking-tight", className)} {...props} />
}

export function DialogDescription({ className, style, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[13px] leading-relaxed transition-colors", className)} style={{ color: 'var(--theme-text-secondary)', ...style }} {...props} />
}
