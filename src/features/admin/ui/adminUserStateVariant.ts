import type { BadgeVariant } from "#ui/static/badge/badgeCva.jsx"
import type { UserState } from "../../users/public/userStateSchema.js"

const variants = {
  initial: "subtle",
  active: "filledGreen",
  inactive: "filledYellow",
  locked: "filledRed",
  suspended: "filledYellow",
  deleted: "filledRed",
} as const satisfies Record<UserState, BadgeVariant>

export function adminUserStateVariant(state: UserState): BadgeVariant {
  return variants[state]
}
