/** Number of memberships above which the organization selector falls back to a native select. */
const tabLimit = 8

/**
 * Chooses between the accessible tab list and the native select fallback. Long membership lists
 * stop being scannable as tabs, and a native select stays usable on small screens.
 */
export function accountOrganizationSelectorModeGet(count: number): "select" | "tabs" {
  return count > tabLimit ? "select" : "tabs"
}
