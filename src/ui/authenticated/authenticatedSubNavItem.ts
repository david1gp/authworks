/** One vertical settings destination rendered by the section sub-navigation. */
export type AuthenticatedSubNavItem = {
  readonly value: string
  readonly label: string
  readonly href: string
  readonly description?: string
  readonly icon?: string
}
