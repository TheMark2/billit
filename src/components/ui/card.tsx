import { forwardRef } from "react"
import { cn } from "@/lib/utils"

const Card = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-white text-card-foreground",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

export { Card } 