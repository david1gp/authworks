import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext, RealmTenantContext } from "../../realms/server/index.js"
import { userMetadataRepositoryCreate } from "../persistence/userMetadataRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { UserMetadataListQuery } from "../public/userMetadataListQuerySchema.js"
import { userMetadataListQuerySchema } from "../public/userMetadataListQuerySchema.js"
import type { UserMetadataListResponse } from "../public/userMetadataListResponseSchema.js"
import type { UserMetadata } from "../public/userMetadataSchema.js"
import { userMetadataAuthorize } from "./userMetadataAuthorize.js"

type UserMetadataListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly query?: UserMetadataListQuery
  readonly realmId: string
  readonly userId: string
}

export function userMetadataList(options: UserMetadataListOptions): Result<UserMetadataListResponse> {
  const op = "userMetadataList"
  const parsed = v.safeParse(userMetadataListQuerySchema, options.query ?? {})
  if (!parsed.success) return resultErrorCreate(op, "The metadata list query is invalid.", "users.invalid")
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
  const entries = userMetadataRepositoryCreate(options.database.db).userMetadataList(options.realmId, options.userId)
  if (!entries.success) return entries
  const prefix = parsed.output.keyPrefix
  const rows: UserMetadata[] = entries.data
    .filter((entry) => prefix === undefined || entry.key.startsWith(prefix))
    .map((entry) => ({
      createdAt: entry.createdAt,
      key: entry.key,
      updatedAt: entry.updatedAt,
      userId: entry.userId,
      value: entry.value,
      version: entry.version,
    }))
  return listRowsPage({
    idGet: (entry) => entry.key,
    query: parsed.output,
    rows,
    sortValueGet: (entry) => entry.key,
  })
}
