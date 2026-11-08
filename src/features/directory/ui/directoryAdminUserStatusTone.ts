import type { AuthenticatedChipTone } from "../../../ui/authenticated/authenticatedChipTone.js"
import type { UserState } from "../../users/public/userStateSchema.js"

const tones = {
  active: "success",
  deleted: "danger",
  inactive: "warning",
  initial: "neutral",
  locked: "danger",
  suspended: "warning",
} as const satisfies Record<UserState, AuthenticatedChipTone>

/** Maps a user lifecycle state to the compact chip tone shown in the directory table. Never throws: unknown states render as neutral. */
export function directoryAdminUserStatusTone(state: UserState): AuthenticatedChipTone {
  return (tones as Record<string, AuthenticatedChipTone>)[state] ?? "neutral"
}
