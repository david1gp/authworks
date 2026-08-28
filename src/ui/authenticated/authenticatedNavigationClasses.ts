/**
 * Compact navigation language shared by the production authenticated shell and the demo shells,
 * so both render the same 240px rail, hairline framing, and dense ~28px rows.
 */
export const authenticatedNavigationClasses = {
  /** Fixed desktop rail; pairs with `contentOffset`. Uses logical sides so RTL mirrors it. */
  aside: "fixed inset-y-0 z-20 w-60 border-line bg-surface ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l",
  /** Desktop content offset applied while the rail is open. */
  contentOffset: "lg:ltr:ml-60 lg:rtl:mr-60",
  /** Sidebar and collapsed top bar brand row. */
  brandRow: "flex h-12 shrink-0 items-center gap-1 border-b border-line px-3",
  brandLink: "min-w-0 flex-1 truncate text-sm font-semibold tracking-tight",
  footer: "shrink-0 border-t border-line px-2 py-1.5",
  frame: "flex h-full min-h-0 flex-col bg-surface",
  groupHeading:
    "flex items-center gap-2 px-2 pb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground",
  groupSection: "mt-2 first:mt-0",
  link: "flex items-center gap-2 rounded-control px-2 py-1 text-[0.8125rem] leading-6 font-medium transition-colors",
  linkActive: "bg-accent-soft font-semibold text-foreground",
  linkInactive: "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
  nav: "min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-2 pb-3",
} as const
