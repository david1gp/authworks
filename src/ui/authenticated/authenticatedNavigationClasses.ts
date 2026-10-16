/**
 * Compact navigation language shared by the production authenticated shell and the demo shells,
 * so both render the same 240px rail, translucent header, and compact 32px rows.
 */
export const authenticatedNavigationClasses = {
  /** Fixed desktop rail; pairs with `contentOffset`. Uses logical sides so RTL mirrors it. */
  aside: "fixed inset-y-0 z-20 w-60 border-line bg-surface ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l",
  /** Desktop content offset applied while the rail is open. */
  contentOffset: "lg:ltr:ml-60 lg:rtl:mr-60",
  /** Sidebar brand row; the header has its own content-column framing. */
  brandRow: "flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4",
  brandLink: "min-w-0 flex-1 truncate text-[0.9375rem] font-semibold tracking-tight",
  footer: "shrink-0 border-t border-line px-2 py-2",
  footerButton: "w-full justify-start text-muted-foreground hover:text-foreground",
  frame: "flex h-full min-h-0 flex-col bg-surface",
  groupHeading: "px-2 pb-1.5 text-xs font-medium text-muted-foreground",
  groupSection: "mt-5 first:mt-0",
  link: "flex h-8 items-center gap-2.5 rounded-control px-2 text-sm font-medium transition-colors [&>svg]:size-4.5 [&>svg]:shrink-0",
  linkActive: "bg-accent-soft text-accent",
  linkInactive: "text-foreground/80 hover:bg-surface-hover hover:text-foreground",
  nav: "min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-3 pb-3",
  header:
    "sticky top-0 z-10 flex h-14 min-w-0 items-center justify-between gap-2 border-b border-line bg-surface/80 px-4 backdrop-blur-md sm:gap-4 sm:px-6",
  headerStart: "flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3",
  headerEnd: "flex shrink-0 items-center gap-1.5 sm:gap-3",
  headerBrand: "flex min-w-0 items-center gap-1.5 sm:gap-2",
  headerBrandMark: "size-7",
  headerLink: "max-w-16 truncate text-[0.8125rem] text-muted-foreground hover:text-foreground sm:max-w-none",
  sidebarToggle: "size-8 shrink-0 p-0 text-muted-foreground hover:bg-surface-hover hover:text-foreground",
  mobileContent: "h-[min(42rem,calc(95dvh-10rem))] w-[min(18rem,calc(100vw-5rem))]",
  mobileTitle: "text-[0.9375rem] font-semibold tracking-tight",
  mobileDescription: "mt-1 text-[0.8125rem] text-muted-foreground",
  content: "mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8",
} as const
