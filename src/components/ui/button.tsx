import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "destructive" | "ghost" | "outline"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-[12px] text-sm font-semibold transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "hover:opacity-95": variant === "default",
            "border border-[var(--theme-border)]": variant === "secondary",
            "bg-[var(--color-destructive)] text-white hover:opacity-95": variant === "destructive",
            "hover:bg-[var(--theme-nav-hover)] text-[var(--theme-text)]": variant === "ghost",
            "border border-[var(--theme-border)] bg-[var(--theme-bg)]": variant === "outline",
            "h-12 px-6": size === "default",
            "h-9 rounded-lg px-4 text-xs": size === "sm",
            "h-12 rounded-2xl px-8": size === "lg",
            "h-10 w-10 rounded-[12px]": size === "icon",
          },
          className
        )}
        style={{
          ...(variant === 'default' ? { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' } : {}),
          ...(variant === 'secondary' ? { backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text)' } : {}),
          ...(variant === 'outline' ? { borderColor: 'var(--theme-border)', color: 'var(--theme-text)' } : {}),
          ...style
        }}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
