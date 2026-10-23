import type { RealmAdministratorRow } from "../persistence/realmAdministratorTable.js"
import type { RealmAdministrator } from "../public/realmAdministratorSchema.js"

export function realmAdministratorPublicViewCreate(
  row: RealmAdministratorRow,
  user: { displayName?: string | null; email: string; userName: string },
): RealmAdministrator {
  const displayName = user.displayName ?? undefined
  return {
    createdAt: row.createdAt,
    ...(row.createdBy === null ? {} : { createdBy: row.createdBy }),
    realmId: row.realmId,
    user: {
      ...(displayName === undefined ? {} : { displayName }),
      email: user.email,
      userName: user.userName,
    },
    userId: row.userId,
  }
}
