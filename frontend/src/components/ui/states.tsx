import * as React from "react"
import { AlertTriangle, RotateCw } from "lucide-react"
import { cn } from "../../lib/utils"

/** Grey placeholder block shown while data loads. Size it like the content it stands in for. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("skeleton h-4 w-full", className)} {...props} />
}

/** Nothing to show yet: says what will appear here and, optionally, how to get it. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-12 px-6 text-center", className)}>
      {icon && <div className="mb-2 text-slate-400 [&_svg]:size-10">{icon}</div>}
      <p className="text-lg font-semibold text-slate-800">{title}</p>
      {description && <p className="max-w-md text-base text-slate-600">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/** Something failed: what went wrong and a way to try again. */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = "Try again",
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  onRetry?: () => void
  retryLabel?: string
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn("flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-left", className)}
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-red-800">{title}</p>
        {description && <p className="mt-0.5 text-sm text-red-700">{description}</p>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="tap inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
        >
          <RotateCw className="size-4" aria-hidden="true" />
          {retryLabel}
        </button>
      )}
    </div>
  )
}

/** One headline number for dashboards. `tone` colours the value only. */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: "neutral" | "info" | "success" | "warning" | "danger"
  className?: string
}) {
  const valueColor = {
    neutral: "text-slate-900",
    info: "text-blue-700",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-red-700",
  }[tone]
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card min-w-0", className)}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tabular-nums leading-none", valueColor)}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
