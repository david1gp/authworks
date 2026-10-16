import { classMerge } from "#ui/utils/classMerge.js"
import type { AuthenticatedButtonSize } from "./authenticatedButtonSize.js"
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
  size: AuthenticatedButtonSize = "md",
  iconOnly = false,
  ...customClasses: (string | boolean | undefined | null | 0)[]
) {
  return classMerge(
    "inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition-colors active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    iconOnly
      ? size === "sm"
        ? "size-8 p-0 text-[0.8125rem]"
        : "size-9 p-0 text-sm"
      : size === "sm"
        ? "h-8 px-3 text-[0.8125rem]"
        : "h-9 px-3.5 text-sm",
    variants[variant],
    ...customClasses,
  )
}
