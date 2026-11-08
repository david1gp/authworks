import { classMerge } from "#ui/utils/classMerge.js"
import type { AuthenticatedButtonVariant } from "./authenticatedButtonVariant.js"

const variants: Record<AuthenticatedButtonVariant, string> = {
  filledBlue: "bg-accent text-accent-contrast hover:bg-accent-hover shadow-xs",
  outline: "border border-line-strong/70 bg-surface text-foreground hover:bg-surface-hover shadow-xs",
  ghost: "text-foreground hover:bg-surface-hover",
  filledRed: "bg-danger text-white hover:bg-danger/90 shadow-xs dark:text-[var(--background)]",
  outlineRed: "border border-danger/40 bg-surface text-danger hover:bg-danger-soft",
}

/** Complete native control classes, also usable by non-button dialog triggers. */
export function authenticatedButtonClassGet(
  variant: AuthenticatedButtonVariant = "ghost",
  iconOnly = false,
  ...customClasses: (string | boolean | undefined | null | 0)[]
) {
  return classMerge(
    "inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition-colors active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    iconOnly
      ? "size-9 compact:size-8 compact:text-[13px] p-0 text-sm"
      : "h-9 compact:h-8 compact:text-[13px] px-3.5 text-sm",
    variants[variant],
    ...customClasses,
  )
}
