import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { userGet } from "../actions/userGet.js"

type UserAccountSummaryResolveOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
}

function nonblankTextResolve(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const normalized = value.trim()
  return normalized.length === 0 ? undefined : normalized
}

export function userAccountSummaryResolve(
  options: UserAccountSummaryResolveOptions,
): Result<{ label: string; loginIdentifier: string } | undefined> {
  const op = "userAccountSummaryResolve"
  if (options.realmId.length === 0 || options.userId.length === 0)
    return resultErrorCreate(op, "The user account summary scope is invalid.", "users.invalid")
  const user = userGet({
    context: realmSystemContextCreate("system"),
    database: options.database,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!user.success) {
    if (user.code === "users.not-found") return resultCreate(undefined)
    return user
  }
  const profile = user.data.user.profile
  const displayName = nonblankTextResolve(profile.displayName)
  const combinedName = [nonblankTextResolve(profile.firstName), nonblankTextResolve(profile.lastName)]
    .filter((value): value is string => value !== undefined)
    .join(" ")
  const label = displayName ?? (combinedName.length === 0 ? user.data.user.userName : combinedName)
  return resultCreate({ label, loginIdentifier: user.data.user.userName })
}
