/**
 * Compact navigation language shared by the production authenticated shell and the demo shells,
 * so both render the same 240px rail, compact 32px rows, and a slim top bar that only appears on
 * mobile or while the rail is collapsed. Global controls (organization, language, theme, identity)
 * live inside the rail rather than in a separate navbar.
 */
export const authenticatedNavigationClasses = {
  /** Fixed desktop rail; pairs with `contentOffset`. Uses logical sides so RTL mirrors it. */
  aside: "fixed inset-y-0 z-20 w-60 border-line bg-surface ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l",
  /** Desktop content offset applied while the rail is open. */
  contentOffset: "lg:ltr:ml-60 lg:rtl:mr-60",
  /** Sidebar brand row; the header has its own content-column framing. */
  brandRow: "flex h-14 shrink-0 items-center gap-2.5 border-b border-line ps-4 pe-2 max-lg:hidden",
  /** Icon-only control in the brand row that collapses the desktop rail. */
  brandCollapse:
    "grid size-8 shrink-0 place-items-center rounded-control text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground [&>svg]:size-4.5 rtl:[&>svg]:-scale-x-100",
  brandLink: "min-w-0 flex-1 truncate text-[0.9375rem] font-semibold tracking-tight",
  /** Rail footer holding preferences and the signed-in identity; also shown inside the mobile drawer. */
  footer: "grid shrink-0 gap-1.5 border-t border-line p-2",
  footerPreferences: "flex min-w-0 items-center justify-between gap-2 px-1 py-0.5",
  identityRow: "flex min-w-0 items-center gap-1 rounded-control",
  identityLink:
    "flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-1.5 py-1.5 transition-colors hover:bg-surface-hover aria-[current=page]:bg-accent-soft",
  identityAvatar:
    "grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent",
  identityName: "block truncate text-[0.8125rem] font-medium text-foreground",
  identityCaption: "block truncate text-xs text-muted-foreground",
  identityAction:
    "grid size-8 shrink-0 place-items-center rounded-control text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground [&>svg]:size-4",
  /** Wrapper for the organization switcher card at the top of the rail. */
  organizationSwitcher: "shrink-0 px-2 pt-2",
  /** Workspace-style card: initials tile, caption, and organization name. */
  organizationCard: "flex w-full min-w-0 items-center gap-2.5 rounded-control px-2 py-1.5",
  /** Interactive variant of the card when more than one organization is available. */
  organizationTrigger:
    "transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-progress disabled:opacity-70 data-expanded:bg-surface-hover",
  organizationTile:
    "grid size-8 shrink-0 place-items-center rounded-[9px] text-xs font-semibold ring-1 ring-line-subtle ring-inset",
  organizationCaption: "truncate text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground",
  organizationName: "truncate text-[0.8125rem] font-semibold text-foreground",
  organizationMenu:
    "z-50 flex min-w-56 flex-col overflow-hidden rounded-control border border-line bg-surface text-sm shadow-overlay data-open:animate-in data-open:fade-in-50% data-closed:animate-out data-closed:fade-out-50%",
  organizationSearch: "flex items-center gap-2 border-b border-line px-2.5 py-2",
  organizationOption:
    "flex w-full min-w-0 items-center gap-2.5 rounded-sm px-2 py-1.5 text-start text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none aria-selected:font-semibold",
  organizationOptionTile:
    "grid size-6 shrink-0 place-items-center rounded-md text-[0.625rem] font-semibold ring-1 ring-line-subtle ring-inset",
  frame: "flex h-full min-h-0 flex-col bg-surface",
  groupHeading:
    "flex h-8 w-full items-center gap-2 rounded-control px-2 text-start text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground [&>span]:flex-1",
  groupSection: "mt-5 first:mt-0",
  link: "flex h-8 items-center gap-2.5 rounded-control px-2 text-sm font-medium transition-colors [&>svg]:size-4.5 [&>svg]:shrink-0",
  linkActive: "bg-accent-soft font-semibold text-accent dark:bg-accent/20 dark:text-accent-hover",
  linkInactive: "text-foreground/80 hover:bg-surface-hover hover:text-foreground",
  nav: "min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-3 pb-3",
  header:
    "sticky top-0 z-10 flex h-14 min-w-0 items-center justify-between gap-2 border-b border-line bg-surface/80 px-4 backdrop-blur-md sm:gap-4 sm:px-6",
  /** Slim top bar shown only on mobile or while the desktop rail is collapsed. */
  topBar:
    "sticky top-0 z-30 flex h-12 min-w-0 items-center gap-2 border-b border-line bg-surface/80 px-2 backdrop-blur-md sm:px-4",
  headerStart: "flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3",
  headerEnd: "flex shrink-0 items-center gap-1.5 sm:gap-3",
  headerBrand: "flex min-w-0 items-center gap-1.5 sm:gap-2",
  headerBrandMark: "size-7 rounded-[9px] text-sm leading-none",
  headerLink: "max-w-16 truncate text-[0.8125rem] text-muted-foreground hover:text-foreground sm:max-w-none",
  sidebarToggle: "size-8 shrink-0 p-0 text-muted-foreground hover:bg-surface-hover hover:text-foreground",
  mobileContent: "h-[min(42rem,calc(95dvh-10rem))] w-[min(18rem,calc(100vw-5rem))]",
  mobileTitle: "text-[0.9375rem] font-semibold tracking-tight",
  mobileDescription: "mt-1 text-[0.8125rem] text-muted-foreground",
  content: "mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8",
} as const
