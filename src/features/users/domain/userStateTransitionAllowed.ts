import type { UserState } from "./userStateSchema.js"

export function userStateTransitionAllowed(from: UserState, to: UserState): boolean {
  if (from === to || from === "deleted") return false
  if (to === "deleted") return true
  if (from === "initial") return to === "active" || to === "inactive"
  if (from === "active") return to === "inactive" || to === "locked" || to === "suspended"
  if (from === "inactive") return to === "active"
  if (from === "locked" || from === "suspended") return to === "active"
  return false
}
