import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-[16px] border transition-colors",
      className
    )}
    style={{
      backgroundColor: 'var(--theme-card-bg)',
      borderColor: 'var(--theme-border)',
      color: 'var(--theme-text)',
      border: '1px solid var(--theme-border)'
    }}
    {...props}
  />
))
Card.displayName = "Card"

export { Card }
