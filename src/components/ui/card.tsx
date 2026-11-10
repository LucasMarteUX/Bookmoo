import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-xl border transition-colors", className)}
    style={{
      backgroundColor: 'var(--theme-card-bg)',
      borderColor: 'var(--theme-border)',
      color: 'var(--theme-text)',
      ...style,
    }}
    {...props}
  />
))
Card.displayName = "Card"

export { Card }
