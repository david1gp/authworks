import { and, desc, eq, isNull } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"
import { sessionTable, type SessionRow } from "./sessionTable.js"

export function sessionRepositoryCreate(database: StorageExecutor) {
  return {
    sessionCreate(input: typeof sessionTable.$inferInsert): Result<SessionRow> {
      try {
        const row = database.insert(sessionTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("sessionCreate", "The session could not be created.", "sessions.write-failed")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("sessionCreate", "The session could not be created.", "sessions.write-failed")
      }
    },

    sessionGet(realmId: string, sessionId: string): Result<SessionRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(sessionTable)
            .where(and(eq(sessionTable.realmId, realmId), eq(sessionTable.id, sessionId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("sessionGet", "The session could not be read.", "sessions.read-failed")
      }
    },

    sessionGetByTokenHash(tokenHash: string): Result<SessionRow | null> {
      try {
        return resultCreate(
          database.select().from(sessionTable).where(eq(sessionTable.tokenHash, tokenHash)).get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("sessionGetByTokenHash", "The session could not be read.", "sessions.read-failed")
      }
    },

    sessionList(realmId: string, userId: string, limit?: number): Result<SessionRow[]> {
      try {
        const query = database
          .select()
          .from(sessionTable)
          .where(and(eq(sessionTable.realmId, realmId), eq(sessionTable.userId, userId)))
          .orderBy(desc(sessionTable.lastUsedAt), desc(sessionTable.createdAt))
        if (limit === undefined) return resultCreate(query.all())
        return resultCreate(query.limit(limit).all())
      } catch (_error) {
        return resultErrorCreate("sessionList", "The sessions could not be read.", "sessions.read-failed")
      }
    },

    sessionEventVersionGet(realmId: string, sessionId: string): Result<number> {
      try {
        const event = database
          .select({ aggregateVersion: storageEventTable.aggregateVersion })
          .from(storageEventTable)
          .where(
            and(
              eq(storageEventTable.realmId, realmId),
              eq(storageEventTable.aggregateId, sessionId),
              eq(storageEventTable.aggregateType, "session"),
            ),
          )
          .orderBy(desc(storageEventTable.aggregateVersion))
          .get()
        return resultCreate(event?.aggregateVersion ?? 0)
      } catch (_error) {
        return resultErrorCreate(
          "sessionEventVersionGet",
          "The session event version could not be read.",
          "sessions.read-failed",
        )
      }
    },

    sessionLastUsedUpdate(
      realmId: string,
      sessionId: string,
      tokenHash: string,
      lastUsedAt: number,
    ): Result<SessionRow | null> {
      try {
        return resultCreate(
          database
            .update(sessionTable)
            .set({ lastUsedAt })
            .where(
              and(
                eq(sessionTable.realmId, realmId),
                eq(sessionTable.id, sessionId),
                eq(sessionTable.tokenHash, tokenHash),
                isNull(sessionTable.revokedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("sessionLastUsedUpdate", "The session could not be used.", "sessions.write-failed")
      }
    },

    sessionRotate(
      realmId: string,
      sessionId: string,
      tokenHash: string,
      nextTokenHash: string,
      now: number,
      expectedVersion: number,
      nextVersion: number,
    ): Result<SessionRow | null> {
      try {
        return resultCreate(
          database
            .update(sessionTable)
            .set({ lastUsedAt: now, tokenHash: nextTokenHash, version: nextVersion })
            .where(
              and(
                eq(sessionTable.realmId, realmId),
                eq(sessionTable.id, sessionId),
                eq(sessionTable.tokenHash, tokenHash),
                eq(sessionTable.version, expectedVersion),
                isNull(sessionTable.revokedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("sessionRotate", "The session could not be rotated.", "sessions.write-failed")
      }
    },

    sessionAssuranceRotate(
      realmId: string,
      sessionId: string,
      tokenHash: string,
      nextTokenHash: string,
      now: number,
      expectedVersion: number,
      nextVersion: number,
      mfaMethod: "passkey" | "recovery_code" | "totp",
    ): Result<SessionRow | null> {
      try {
        return resultCreate(
          database
            .update(sessionTable)
            .set({
              assurance: "multi_factor",
              lastUsedAt: now,
              mfaMethod,
              tokenHash: nextTokenHash,
              version: nextVersion,
            })
            .where(
              and(
                eq(sessionTable.realmId, realmId),
                eq(sessionTable.id, sessionId),
                eq(sessionTable.tokenHash, tokenHash),
                eq(sessionTable.version, expectedVersion),
                isNull(sessionTable.revokedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "sessionAssuranceRotate",
          "The session could not be upgraded.",
          "sessions.write-failed",
        )
      }
    },

    sessionVersionUpdate(
      realmId: string,
      sessionId: string,
      expectedVersion: number,
      input: Partial<typeof sessionTable.$inferInsert>,
    ): Result<SessionRow | null> {
      try {
        return resultCreate(
          database
            .update(sessionTable)
            .set(input)
            .where(
              and(
                eq(sessionTable.realmId, realmId),
                eq(sessionTable.id, sessionId),
                eq(sessionTable.version, expectedVersion),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("sessionVersionUpdate", "The session could not be updated.", "sessions.write-failed")
      }
    },
  }
}
