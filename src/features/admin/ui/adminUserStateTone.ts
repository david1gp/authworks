import type { AuthenticatedStatusTone } from "../../../ui/authenticated/authenticatedStatusTone.js"
import type { UserState } from "../../users/public/userStateSchema.js"

const tones = {
  initial: "neutral",
  active: "success",
  inactive: "warning",
  locked: "danger",
  suspended: "warning",
  deleted: "danger",
} as const satisfies Record<UserState, AuthenticatedStatusTone>

/** Maps a user lifecycle state to the shared authenticated status tone. */
export function adminUserStateTone(state: UserState): AuthenticatedStatusTone {
  return tones[state]
}
