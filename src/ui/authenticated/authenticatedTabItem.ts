/** One URL-driven tab: each tab owns its `href` so tabs survive reloads and deep links. */
export type AuthenticatedTabItem = {
  readonly value: string
  readonly label: string
  readonly href: string
  readonly count?: number
  readonly icon?: string
}
