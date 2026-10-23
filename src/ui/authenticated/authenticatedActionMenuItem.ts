/** One row action offered by the authenticated overflow menu. */
export type AuthenticatedActionMenuItem = {
  readonly label: string
  readonly icon?: string
  readonly onSelect: () => void
  readonly tone?: "default" | "danger"
  readonly disabled?: boolean
}
