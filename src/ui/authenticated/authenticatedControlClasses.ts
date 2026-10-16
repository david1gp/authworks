const field =
  "h-9 w-full rounded-control border border-line-strong/70 bg-surface px-3 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus:border-accent disabled:opacity-50 dark:bg-muted"

export const authenticatedControlClasses = {
  input: field,
  select: field,
  textarea:
    "min-h-24 w-full rounded-control border border-line-strong/70 bg-surface px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus:border-accent disabled:opacity-50 dark:bg-muted",
  checkbox: "size-4 accent-[var(--accent)] disabled:opacity-50",
} as const
