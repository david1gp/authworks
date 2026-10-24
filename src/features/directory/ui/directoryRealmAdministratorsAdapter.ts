import type { Result } from "#result"
import type { RealmAdministrator } from "../../realms/public/realmAdministratorSchema.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"

/** One searchable realm user with derived administrator membership. */
export type DirectoryRealmAdministratorCandidate = {
  readonly alreadyAdmin: boolean
  readonly displayName: string
  readonly email: string
  readonly userId: string
  readonly userName: string
}

/** The single boundary between the shared realm-administrators views and their data sources. */
export type DirectoryRealmAdministratorsAdapter = {
  readonly administratorList: () => Promise<Result<readonly RealmAdministrator[]>>
  readonly administratorGrant: (userId: string) => Promise<Result<{ readonly administrator: RealmAdministrator }>>
  readonly administratorRevoke: (userId: string) => Promise<Result<{ readonly userId: string }>>
  /** Realm-wide user search backing the grant picker (`search` substring filter). */
  readonly realmUserSearch: (search: string) => Promise<Result<readonly DirectoryEntry[]>>
}

/** Picks the user-facing display name, falling back through userName. */
export function directoryRealmAdministratorNameGet(admin: RealmAdministrator): string {
  return admin.user.displayName ?? admin.user.userName
}

/** Resolves who granted the status; a missing granter reads as the system actor. */
export function directoryRealmAdministratorAddedByNameGet(
  administrators: readonly RealmAdministrator[],
  admin: RealmAdministrator,
): string {
  if (admin.createdBy === undefined) return "system"
  const granter = administrators.find((entry) => entry.userId === admin.createdBy)
  if (granter === undefined) return "system"
  return directoryRealmAdministratorNameGet(granter)
}
