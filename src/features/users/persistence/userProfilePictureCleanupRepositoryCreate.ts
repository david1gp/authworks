import { and, asc, eq, isNull, lte, ne, or } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { userPicturePublicUrlCreate } from "../domain/userPicturePublicUrlCreate.js"
import {
  type UserProfilePictureCleanupRow,
  type UserProfilePictureCleanupState,
  userProfilePictureCleanupTable,
} from "./userProfilePictureCleanupTable.js"
import { userProfileTable } from "./userProfileTable.js"
import { userTable } from "./userTable.js"

export function userProfilePictureCleanupRepositoryCreate(database: StorageExecutor) {
  return {
    userProfilePictureCleanupEnqueue(input: { readonly createdAt: number; readonly objectKey: string }): Result<void> {
      const op = "userProfilePictureCleanupEnqueue"
      const validated = userProfilePictureCleanupInputValidate(op, input.objectKey, input.createdAt)
      if (!validated.success) return validated
      try {
        database
          .insert(userProfilePictureCleanupTable)
          .values({
            createdAt: input.createdAt,
            objectKey: input.objectKey,
            state: "pending-delete",
          })
          .onConflictDoNothing({ target: userProfilePictureCleanupTable.objectKey })
          .run()
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCodedCreate(op, "The user picture cleanup could not be queued.", "users.write-failed")
      }
    },

    userProfilePictureCleanupReserveUploading(input: {
      readonly leaseToken: string
      readonly leaseUntil: number
      readonly now: number
      readonly objectKey: string
    }): Result<void> {
      const op = "userProfilePictureCleanupReserveUploading"
      const validated = userProfilePictureCleanupInputValidate(op, input.objectKey, input.now)
      if (!validated.success) return validated
      if (!userProfilePictureCleanupLeaseInputIsValid(input.leaseToken, input.leaseUntil, input.now))
        return resultErrorCodedCreate(op, "The user picture cleanup lease is invalid.", "users.invalid")
      try {
        const reserved = database
          .insert(userProfilePictureCleanupTable)
          .values({
            createdAt: input.now,
            leaseToken: input.leaseToken,
            leaseUntil: input.leaseUntil,
            objectKey: input.objectKey,
            state: "uploading",
          })
          .onConflictDoUpdate({
            set: {
              createdAt: input.now,
              leaseToken: input.leaseToken,
              leaseUntil: input.leaseUntil,
              state: "uploading",
            },
            target: userProfilePictureCleanupTable.objectKey,
            where: or(
              eq(userProfilePictureCleanupTable.state, "pending-delete"),
              and(
                eq(userProfilePictureCleanupTable.state, "uploading"),
                or(
                  isNull(userProfilePictureCleanupTable.leaseUntil),
                  lte(userProfilePictureCleanupTable.leaseUntil, input.now),
                ),
              ),
            ),
          })
          .returning({ objectKey: userProfilePictureCleanupTable.objectKey })
          .get()
        if (reserved === undefined)
          return resultErrorCodedCreate(
            op,
            "The user picture is being cleaned up; retry the upload.",
            "users.write-failed",
          )
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCodedCreate(
          op,
          "The user picture cleanup reservation could not be written.",
          "users.write-failed",
        )
      }
    },

    userProfilePictureCleanupList(limit: number, now = Date.now()): Result<UserProfilePictureCleanupRow[]> {
      const op = "userProfilePictureCleanupList"
      if (!Number.isSafeInteger(limit) || limit <= 0 || !Number.isSafeInteger(now) || now < 0)
        return resultErrorCodedCreate(op, "The user picture cleanup limit is invalid.", "users.invalid")
      try {
        return resultCreate(
          database
            .select()
            .from(userProfilePictureCleanupTable)
            .where(
              or(
                eq(userProfilePictureCleanupTable.state, "pending-delete"),
                and(
                  or(
                    eq(userProfilePictureCleanupTable.state, "uploading"),
                    eq(userProfilePictureCleanupTable.state, "deleting"),
                  ),
                  or(
                    isNull(userProfilePictureCleanupTable.leaseUntil),
                    lte(userProfilePictureCleanupTable.leaseUntil, now),
                  ),
                ),
              ),
            )
            .orderBy(asc(userProfilePictureCleanupTable.createdAt), asc(userProfilePictureCleanupTable.objectKey))
            .limit(limit)
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(op, "The user picture cleanup queue could not be read.", "users.read-failed")
      }
    },

    userProfilePictureCleanupClaimPendingDelete(input: {
      readonly leaseToken: string
      readonly leaseUntil: number
      readonly now: number
      readonly objectKey: string
      readonly publicOrigin?: string
    }): Result<boolean> {
      const op = "userProfilePictureCleanupClaimPendingDelete"
      if (!userProfilePictureCleanupObjectKeyIsValid(input.objectKey))
        return resultErrorCodedCreate(op, "The user picture cleanup key is invalid.", "users.invalid")
      if (!userProfilePictureCleanupLeaseInputIsValid(input.leaseToken, input.leaseUntil, input.now))
        return resultErrorCodedCreate(op, "The user picture cleanup lease is invalid.", "users.invalid")
      try {
        const current = database
          .select({
            leaseToken: userProfilePictureCleanupTable.leaseToken,
            leaseUntil: userProfilePictureCleanupTable.leaseUntil,
            state: userProfilePictureCleanupTable.state,
          })
          .from(userProfilePictureCleanupTable)
          .where(eq(userProfilePictureCleanupTable.objectKey, input.objectKey))
          .get()
        if (current === undefined) return resultCreate(false)
        if (current.state !== "pending-delete") {
          if (!userProfilePictureCleanupLeaseIsStale(current.leaseUntil, input.now)) return resultCreate(false)
          const recovered = database
            .update(userProfilePictureCleanupTable)
            .set({ leaseToken: null, leaseUntil: null, state: "pending-delete" })
            .where(
              and(
                eq(userProfilePictureCleanupTable.objectKey, input.objectKey),
                eq(userProfilePictureCleanupTable.state, current.state),
                current.leaseToken === null
                  ? isNull(userProfilePictureCleanupTable.leaseToken)
                  : eq(userProfilePictureCleanupTable.leaseToken, current.leaseToken),
                current.leaseUntil === null
                  ? isNull(userProfilePictureCleanupTable.leaseUntil)
                  : lte(userProfilePictureCleanupTable.leaseUntil, input.now),
              ),
            )
            .returning({ objectKey: userProfilePictureCleanupTable.objectKey })
            .get()
          if (recovered === undefined) return resultCreate(false)
        }

        if (input.publicOrigin !== undefined) {
          const referenced = userProfilePictureCleanupIsReferenced(database, input.publicOrigin, input.objectKey)
          if (!referenced.success) return referenced
          if (referenced.data) {
            database
              .delete(userProfilePictureCleanupTable)
              .where(
                and(
                  eq(userProfilePictureCleanupTable.objectKey, input.objectKey),
                  eq(userProfilePictureCleanupTable.state, "pending-delete"),
                ),
              )
              .run()
            return resultCreate(false)
          }
        }

        const claimed = database
          .update(userProfilePictureCleanupTable)
          .set({ leaseToken: input.leaseToken, leaseUntil: input.leaseUntil, state: "deleting" })
          .where(
            and(
              eq(userProfilePictureCleanupTable.objectKey, input.objectKey),
              eq(userProfilePictureCleanupTable.state, "pending-delete"),
            ),
          )
          .returning({ objectKey: userProfilePictureCleanupTable.objectKey })
          .get()
        return resultCreate(claimed !== undefined)
      } catch (_error) {
        return resultErrorCodedCreate(op, "The user picture cleanup could not be claimed.", "users.write-failed")
      }
    },

    userProfilePictureCleanupUploadComplete(input: {
      readonly leaseToken: string
      readonly objectKey: string
    }): Result<boolean> {
      return userProfilePictureCleanupLeaseDelete(
        database,
        "userProfilePictureCleanupUploadComplete",
        input.objectKey,
        input.leaseToken,
        "uploading",
      )
    },

    userProfilePictureCleanupUploadFailure(input: {
      readonly leaseToken: string
      readonly objectKey: string
    }): Result<boolean> {
      return userProfilePictureCleanupLeaseRestore(
        database,
        "userProfilePictureCleanupUploadFailure",
        input.objectKey,
        input.leaseToken,
        "uploading",
      )
    },

    userProfilePictureCleanupDeleteComplete(input: {
      readonly leaseToken: string
      readonly objectKey: string
    }): Result<void> {
      const deleted = userProfilePictureCleanupLeaseDelete(
        database,
        "userProfilePictureCleanupDeleteComplete",
        input.objectKey,
        input.leaseToken,
        "deleting",
      )
      if (!deleted.success) return deleted
      if (!deleted.data)
        return resultErrorCodedCreate(
          "userProfilePictureCleanupDeleteComplete",
          "The user picture cleanup claim was lost.",
          "users.write-failed",
        )
      return resultCreate(undefined)
    },

    userProfilePictureCleanupDeleteFailure(input: {
      readonly leaseToken: string
      readonly objectKey: string
    }): Result<void> {
      const restored = userProfilePictureCleanupLeaseRestore(
        database,
        "userProfilePictureCleanupDeleteFailure",
        input.objectKey,
        input.leaseToken,
        "deleting",
      )
      if (!restored.success) return restored
      return resultCreate(undefined)
    },

    userProfilePictureCleanupIsReferenced(publicOrigin: string, objectKey: string): Result<boolean> {
      return userProfilePictureCleanupIsReferenced(database, publicOrigin, objectKey)
    },

    userProfilePictureCleanupRemove(objectKey: string): Result<void> {
      const op = "userProfilePictureCleanupRemove"
      try {
        database
          .delete(userProfilePictureCleanupTable)
          .where(eq(userProfilePictureCleanupTable.objectKey, objectKey))
          .run()
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCodedCreate(op, "The user picture cleanup could not be removed.", "users.write-failed")
      }
    },
  }
}

function userProfilePictureCleanupIsReferenced(
  database: StorageExecutor,
  publicOrigin: string,
  objectKey: string,
): Result<boolean> {
  const op = "userProfilePictureCleanupIsReferenced"
  const publicUrl = userPicturePublicUrlCreate({ objectKey, publicOrigin })
  if (!publicUrl.success)
    return resultErrorCodedCreate(op, "The user picture cleanup public URL is invalid.", "users.invalid")
  try {
    const row = database
      .select({ userId: userProfileTable.userId })
      .from(userProfileTable)
      .innerJoin(userTable, eq(userTable.id, userProfileTable.userId))
      .where(and(eq(userProfileTable.pictureUrl, publicUrl.data), ne(userTable.state, "deleted")))
      .get()
    return resultCreate(row !== undefined)
  } catch (_error) {
    return resultErrorCodedCreate(op, "The user picture cleanup reference could not be read.", "users.read-failed")
  }
}

function userProfilePictureCleanupLeaseDelete(
  database: StorageExecutor,
  op: string,
  objectKey: string,
  leaseToken: string,
  state: UserProfilePictureCleanupState,
): Result<boolean> {
  try {
    const deleted = database
      .delete(userProfilePictureCleanupTable)
      .where(
        and(
          eq(userProfilePictureCleanupTable.objectKey, objectKey),
          eq(userProfilePictureCleanupTable.leaseToken, leaseToken),
          eq(userProfilePictureCleanupTable.state, state),
        ),
      )
      .returning({ objectKey: userProfilePictureCleanupTable.objectKey })
      .get()
    return resultCreate(deleted !== undefined)
  } catch (_error) {
    return resultErrorCodedCreate(op, "The user picture cleanup could not be removed.", "users.write-failed")
  }
}

function userProfilePictureCleanupLeaseRestore(
  database: StorageExecutor,
  op: string,
  objectKey: string,
  leaseToken: string,
  state: UserProfilePictureCleanupState,
): Result<boolean> {
  try {
    const restored = database
      .update(userProfilePictureCleanupTable)
      .set({ leaseToken: null, leaseUntil: null, state: "pending-delete" })
      .where(
        and(
          eq(userProfilePictureCleanupTable.objectKey, objectKey),
          eq(userProfilePictureCleanupTable.leaseToken, leaseToken),
          eq(userProfilePictureCleanupTable.state, state),
        ),
      )
      .returning({ objectKey: userProfilePictureCleanupTable.objectKey })
      .get()
    return resultCreate(restored !== undefined)
  } catch (_error) {
    return resultErrorCodedCreate(op, "The user picture cleanup could not be restored.", "users.write-failed")
  }
}

function userProfilePictureCleanupInputValidate(op: string, objectKey: string, createdAt: number): Result<void> {
  if (!userProfilePictureCleanupObjectKeyIsValid(objectKey))
    return resultErrorCodedCreate(op, "The user picture cleanup key is invalid.", "users.invalid")
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCodedCreate(op, "The user picture cleanup timestamp is invalid.", "users.invalid-timestamp")
  return resultCreate(undefined)
}

function userProfilePictureCleanupLeaseInputIsValid(leaseToken: string, leaseUntil: number, now: number): boolean {
  return (
    leaseToken.length > 0 &&
    Number.isSafeInteger(now) &&
    now >= 0 &&
    Number.isSafeInteger(leaseUntil) &&
    leaseUntil > now
  )
}

function userProfilePictureCleanupLeaseIsStale(leaseUntil: number | null, now: number): boolean {
  return leaseUntil === null || leaseUntil <= now
}

function userProfilePictureCleanupObjectKeyIsValid(objectKey: string): boolean {
  if (objectKey.startsWith("/") || objectKey.includes("\\") || /[?#\r\n]/.test(objectKey)) return false
  if (!/^user-pictures\/[^/]+_[0-9a-f]{32}_[0-9a-f]{64}\.(gif|jpg|png|webp)$/.test(objectKey)) return false
  return objectKey.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
}
