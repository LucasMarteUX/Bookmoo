import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

const DialogContext = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void }>({
  open: false,
  onOpenChange: () => {},
})

export function Dialog({ open, onOpenChange, children }: { open: boolean, onOpenChange: (open: boolean) => void, children: React.ReactNode }) {
  if (!open) return null

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto py-6 px-4 sm:px-0">
        <div className="fixed inset-0 bg-black/55" onClick={() => onOpenChange(false)} />
        {children}
      </div>
    </DialogContext.Provider>
  )
}

export function DialogContent({ className, children, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn("z-50 grid w-full max-w-lg gap-4 p-6 sm:max-w-md animate-in fade-in-90 zoom-in-95", className)} 
      style={{
        backgroundColor: 'var(--theme-card-bg)',
        color: 'var(--theme-text)',
        borderRadius: '24px',
        border: '1px solid var(--theme-border)',
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold tracking-tight", className)} {...props} />
}

export function DialogDescription({ className, style, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs transition-colors", className)} style={{ color: 'var(--theme-text-secondary)', ...style }} {...props} />
}
