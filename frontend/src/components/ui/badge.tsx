import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

/**
 * Status label. Use only when it carries state (triage level, sync status, role) —
 * not as decoration. Normal case, 12px minimum, no letter-spacing tricks.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-slate-50 text-slate-700 border-slate-200",
        info: "bg-blue-50 text-blue-700 border-blue-200",
        success: "bg-emerald-50 text-emerald-700 border-emerald-200",
        warning: "bg-amber-50 text-amber-800 border-amber-200",
        danger: "bg-red-50 text-red-700 border-red-200",
        admin: "bg-purple-50 text-purple-700 border-purple-200",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
)

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { badgeVariants }
