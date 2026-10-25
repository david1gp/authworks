/**
 * Compact class overrides for the vendored table primitives, which default to a roomy 48px header and
 * 16px cell padding. Applied per part they yield a 32px header and 36px rows without editing `ui/`.
 */
export const authenticatedTableClasses = {
  /** Right-aligned trailing action cell. */
  action: "w-0 whitespace-nowrap py-2 ps-2 pe-5 text-end",
  cell: "px-3 py-3 align-middle first:ps-5 last:pe-5",
  head: "h-10 whitespace-nowrap px-3 text-start text-xs font-medium text-muted-foreground first:ps-5 last:pe-5",
  header: "bg-muted/70 [&_tr]:border-line",
  /** Monospace, truncating cell for identifiers and other long technical values. */
  identifier:
    "max-w-[22ch] truncate px-3 py-3 align-middle font-mono text-[0.8125rem] text-muted-foreground first:ps-5 last:pe-5",
  row: "border-line-subtle hover:bg-surface-hover/70",
  table: "text-sm",
  /**
   * Table half of a responsive pair: hidden below `md`, where `AuthenticatedRecordList` renders the
   * same records stacked so no column or action is clipped on a phone.
   */
  tableWide: "hidden text-sm md:table",
} as const
