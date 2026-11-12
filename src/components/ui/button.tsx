import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "destructive" | "ghost" | "outline"
  size?: "default" | "sm" | "lg" | "icon"
}

// Botões no estilo do app: compactos, cantos médios, peso médio. "default" = tinta (preto/branco conforme o tema).
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium cursor-pointer transition-[background-color,opacity,box-shadow,transform] duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--theme-bg)] disabled:pointer-events-none disabled:opacity-50",
          {
            "hover:opacity-90 shadow-[0_1px_2px_rgba(0,0,0,0.12)]": variant === "default",
            "hover:bg-[var(--ui-hover)]": variant === "secondary",
            "bg-[var(--color-destructive)] text-white hover:opacity-90": variant === "destructive",
            "hover:bg-[var(--ui-hover)] active:bg-[var(--ui-press)] text-[var(--theme-text)]": variant === "ghost",
            "border bg-[var(--theme-bg)] hover:bg-[var(--ui-hover)] active:bg-[var(--ui-press)]": variant === "outline",
            // No celular nenhum botão fica abaixo de 44pt (alvo de toque da Apple).
            "h-9 px-3.5 max-md:h-11 max-md:text-[15px] max-md:px-4": size === "default",
            "h-8 px-2.5 text-[13px] max-md:h-10 max-md:text-[14px]": size === "sm",
            "h-11 px-5 text-[15px] max-md:h-12 max-md:text-[16px]": size === "lg",
            "h-9 w-9 max-md:h-11 max-md:w-11": size === "icon",
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
