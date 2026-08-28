import type { AdminViewStatus } from "./adminViewStatusSchema.js"

type AdminPanelState = "empty" | "error" | "inaccessible" | "loading"

/**
 * Maps an administration view status to the shared state-panel presentation. Every administration
 * page reported the same four outcomes through a repeated nested ternary; this is that one rule.
 */
export function adminViewStatusPanelState(status: AdminViewStatus): AdminPanelState {
  if (status === "loading") return "loading"
  if (status === "empty") return "empty"
  if (status === "permission-denied" || status === "expired") return "inaccessible"
  return "error"
}
