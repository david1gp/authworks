import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext, RealmTenantContext } from "../../realms/server/index.js"
import { userMetadataRepositoryCreate } from "../persistence/userMetadataRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import { userMetadataKeySchema } from "../public/userMetadataKeySchema.js"
import type { UserMetadata } from "../public/userMetadataSchema.js"
import { userMetadataAuthorize } from "./userMetadataAuthorize.js"

type UserMetadataGetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly key: string
  readonly realmId: string
  readonly userId: string
}

export function userMetadataGet(options: UserMetadataGetOptions): Result<{ metadata: UserMetadata }> {
  const op = "userMetadataGet"
  if (!v.safeParse(userMetadataKeySchema, options.key).success)
    return resultErrorCreate(op, "The metadata key is invalid.", "users.invalid")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The user is not available in this tenant context.", "users.tenant-mismatch")
  const user = userRepositoryCreate(options.database.db).userGet(options.realmId, options.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state === "deleted")
    return resultErrorCreate(op, "The user was not found.", "users.not-found")
  const authorized = userMetadataAuthorize({
    allowSelfRead: true,
    context: options.context,
    database: options.database,
    permission: "user.read",
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!authorized.success) return authorized
  const entry = userMetadataRepositoryCreate(options.database.db).userMetadataGet(
    options.realmId,
    options.userId,
    options.key,
  )
  if (!entry.success) return entry
  if (entry.data === null) return resultErrorCreate(op, "The user metadata was not found.", "users.not-found")
  return resultCreate({
    metadata: {
      createdAt: entry.data.createdAt,
      key: entry.data.key,
      updatedAt: entry.data.updatedAt,
      userId: entry.data.userId,
      value: entry.data.value,
      version: entry.data.version,
    },
  })
}
