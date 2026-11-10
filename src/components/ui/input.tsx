import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border px-3 text-[14px] placeholder:text-[var(--theme-text-secondary)]/70 file:border-0 file:bg-transparent file:text-sm file:font-medium transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:border-[var(--theme-accent)] focus-visible:ring-[3px] focus-visible:ring-[var(--theme-accent)]/15 disabled:cursor-not-allowed disabled:opacity-50",
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
Input.displayName = "Input"

export { Input }
