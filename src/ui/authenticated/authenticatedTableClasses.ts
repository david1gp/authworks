/**
 * Compact class overrides for the vendored table primitives, which default to a roomy 48px header and
 * 16px cell padding. Applied per part they yield a 32px header and 36px rows without editing `ui/`.
 */
export const authenticatedTableClasses = {
  /** Right-aligned trailing action cell. */
  action: "w-0 whitespace-nowrap py-1.5 pr-3 pl-2 text-right",
  cell: "px-3 py-2 align-middle",
  head: "h-8 px-3 text-2xs font-semibold tracking-[0.12em] uppercase",
  header: "bg-muted/60 [&_tr]:border-line",
  /** Monospace, truncating cell for identifiers and other long technical values. */
  identifier: "max-w-[22ch] truncate px-3 py-2 align-middle font-mono text-xs text-muted-foreground",
  row: "border-line-subtle hover:bg-surface-hover",
  table: "text-sm",
  /**
   * Table half of a responsive pair: hidden below `md`, where `AuthenticatedRecordList` renders the
   * same records stacked so no column or action is clipped on a phone.
   */
  tableWide: "hidden text-sm md:table",
} as const
