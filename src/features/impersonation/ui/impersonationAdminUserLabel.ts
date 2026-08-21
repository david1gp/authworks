import type { User } from "../../users/public/userSchema.js"

/** The stable, non-sensitive label used for an impersonation subject across every view. */
export function impersonationAdminUserLabel(user: User): string {
  return user.profile.displayName ?? user.userName
}
