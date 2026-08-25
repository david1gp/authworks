import type { UserEmailRow } from "../persistence/userEmailTable.js"
import type { UserEmailAddress } from "../public/userEmailAddressSchema.js"

export function userEmailAddressPublicViewCreate(row: UserEmailRow): UserEmailAddress {
  return {
    createdAt: row.createdAt,
    email: row.email,
    id: row.id,
    isPrimary: row.isPrimary,
    updatedAt: row.updatedAt,
    verified: row.verifiedAt !== null,
    verifiedAt: row.verifiedAt,
    version: row.version,
  }
}
