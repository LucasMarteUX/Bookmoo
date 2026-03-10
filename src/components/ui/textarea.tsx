import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-[12px] border px-4 py-3 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] focus-visible:border-[var(--theme-primary)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className
        )}
        style={{
          backgroundColor: 'var(--theme-bg)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
          ...style
        }}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
