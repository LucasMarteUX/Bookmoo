import * as React from "react"
import { cn } from "@/lib/utils"

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, style, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 transition-colors",
      className
    )}
    style={{ color: 'var(--theme-text)', ...style }}
    {...props}
  />
))
Label.displayName = "Label"

export { Label }
