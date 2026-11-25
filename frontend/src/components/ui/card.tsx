import * as React from "react"
import { cn } from "../../lib/utils"

/**
 * Surface for grouped content. `interactive` makes the whole card a tap target.
 * Radius 12px (rounded-xl), one border, one resting shadow — never stacked effects.
 */
export function Card({
  className,
  interactive = false,
  selected = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean; selected?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white shadow-card",
        selected ? "border-2 border-blue-600" : "border-slate-200",
        interactive &&
          "cursor-pointer transition-[box-shadow,border-color] duration-150 hover:shadow-card-hover hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-blue-600",
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-bold text-slate-900 leading-snug", className)} {...props} />
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4 text-base text-slate-600", className)} {...props} />
}
