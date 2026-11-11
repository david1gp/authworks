export const authenticatedCardClasses = {
  card: "relative flex min-w-0 flex-col gap-1.5 rounded-panel border border-line bg-surface p-3 compact:p-2.5 text-start shadow-panel",
  cardInteractive: "cursor-pointer transition-colors hover:border-line-strong hover:bg-surface-hover",
  list: "grid min-w-0 items-start gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6",
} as const
