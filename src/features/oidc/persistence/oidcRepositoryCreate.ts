import { and, asc, desc, eq, gt, isNull } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"
import { type OidcAuthorizationCodeRow, oidcAuthorizationCodeTable } from "./oidcAuthorizationCodeTable.js"
import { type OidcAuthorizationRequestRow, oidcAuthorizationRequestTable } from "./oidcAuthorizationRequestTable.js"
import { type OidcAccessTokenRow, oidcAccessTokenTable } from "./oidcAccessTokenTable.js"
import { type OidcClientRow, oidcClientTable } from "./oidcClientTable.js"
import { type OidcConsentRow, oidcConsentTable } from "./oidcConsentTable.js"
import { type OidcRefreshTokenRow, oidcRefreshTokenTable } from "./oidcRefreshTokenTable.js"
import { type OidcSigningKeyRow, oidcSigningKeyTable } from "./oidcSigningKeyTable.js"

type OidcClientInsert = typeof oidcClientTable.$inferInsert
type OidcClientUpdate = Partial<OidcClientInsert>
type OidcSigningKeyInsert = typeof oidcSigningKeyTable.$inferInsert
type OidcSigningKeyUpdate = Partial<OidcSigningKeyInsert>
type OidcAuthorizationCodeInsert = typeof oidcAuthorizationCodeTable.$inferInsert
type OidcAuthorizationRequestInsert = typeof oidcAuthorizationRequestTable.$inferInsert
type OidcConsentInsert = typeof oidcConsentTable.$inferInsert
type OidcAccessTokenInsert = typeof oidcAccessTokenTable.$inferInsert
type OidcRefreshTokenInsert = typeof oidcRefreshTokenTable.$inferInsert

export function oidcRepositoryCreate(database: StorageExecutor) {
  return {
    authorizationCodeConsume(
      instanceId: string,
      clientId: string,
      authorizationCodeId: string,
      tokenHash: string,
      consumedAt: number,
      now: number,
    ): Result<OidcAuthorizationCodeRow | null> {
      try {
        return resultCreate(
          database
            .update(oidcAuthorizationCodeTable)
            .set({ usedAt: consumedAt })
            .where(
              and(
                eq(oidcAuthorizationCodeTable.id, authorizationCodeId),
                eq(oidcAuthorizationCodeTable.instanceId, instanceId),
                eq(oidcAuthorizationCodeTable.clientId, clientId),
                eq(oidcAuthorizationCodeTable.tokenHash, tokenHash),
                gt(oidcAuthorizationCodeTable.expiresAt, now),
                isNull(oidcAuthorizationCodeTable.usedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("oidcAuthorizationCodeConsume", "The authorization code could not be consumed.")
      }
    },

    authorizationCodeCreate(input: OidcAuthorizationCodeInsert): Result<OidcAuthorizationCodeRow> {
      try {
        const row = database.insert(oidcAuthorizationCodeTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("oidcAuthorizationCodeCreate", "The authorization code could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("oidcAuthorizationCodeCreate", "The authorization code could not be created.")
      }
    },

    authorizationCodeGetByTokenHash(instanceId: string, tokenHash: string): Result<OidcAuthorizationCodeRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcAuthorizationCodeTable)
            .where(
              and(
                eq(oidcAuthorizationCodeTable.instanceId, instanceId),
                eq(oidcAuthorizationCodeTable.tokenHash, tokenHash),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("oidcAuthorizationCodeGetByTokenHash", "The authorization code could not be read.")
      }
    },

    accessTokenCreate(input: OidcAccessTokenInsert): Result<OidcAccessTokenRow> {
      try {
        const row = database.insert(oidcAccessTokenTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("oidcAccessTokenCreate", "The access token could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("oidcAccessTokenCreate", "The access token could not be created.")
      }
    },

    accessTokenGetByTokenHash(instanceId: string, tokenHash: string): Result<OidcAccessTokenRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcAccessTokenTable)
            .where(and(eq(oidcAccessTokenTable.instanceId, instanceId), eq(oidcAccessTokenTable.tokenHash, tokenHash)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("oidcAccessTokenGetByTokenHash", "The access token could not be read.")
      }
    },

    accessTokenRevoke(
      instanceId: string,
      clientId: string,
      tokenHash: string,
      revokedAt: number,
    ): Result<OidcAccessTokenRow | null> {
      try {
        return resultCreate(
          database
            .update(oidcAccessTokenTable)
            .set({ revokedAt })
            .where(
              and(
                eq(oidcAccessTokenTable.instanceId, instanceId),
                eq(oidcAccessTokenTable.clientId, clientId),
                eq(oidcAccessTokenTable.tokenHash, tokenHash),
                isNull(oidcAccessTokenTable.revokedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("oidcAccessTokenRevoke", "The access token could not be revoked.")
      }
    },

    accessTokenFamilyRevoke(
      instanceId: string,
      clientId: string,
      familyId: string,
      revokedAt: number,
    ): Result<OidcAccessTokenRow[]> {
      try {
        const rows = database
          .update(oidcAccessTokenTable)
          .set({ revokedAt })
          .where(
            and(
              eq(oidcAccessTokenTable.instanceId, instanceId),
              eq(oidcAccessTokenTable.clientId, clientId),
              eq(oidcAccessTokenTable.refreshFamilyId, familyId),
              isNull(oidcAccessTokenTable.revokedAt),
            ),
          )
          .returning()
          .all()
        return resultCreate(rows)
      } catch (_error) {
        return resultErrorCreate("oidcAccessTokenFamilyRevoke", "The access token family could not be revoked.")
      }
    },

    refreshTokenCreate(input: OidcRefreshTokenInsert): Result<OidcRefreshTokenRow> {
      try {
        const row = database.insert(oidcRefreshTokenTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("oidcRefreshTokenCreate", "The refresh token could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("oidcRefreshTokenCreate", "The refresh token could not be created.")
      }
    },

    refreshTokenFamilyRevoke(
      instanceId: string,
      clientId: string,
      familyId: string,
      revokedAt: number,
    ): Result<OidcRefreshTokenRow[]> {
      try {
        const rows = database
          .update(oidcRefreshTokenTable)
          .set({ revokedAt })
          .where(
            and(
              eq(oidcRefreshTokenTable.instanceId, instanceId),
              eq(oidcRefreshTokenTable.clientId, clientId),
              eq(oidcRefreshTokenTable.familyId, familyId),
              isNull(oidcRefreshTokenTable.revokedAt),
            ),
          )
          .returning()
          .all()
        return resultCreate(rows)
      } catch (_error) {
        return resultErrorCreate("oidcRefreshTokenFamilyRevoke", "The refresh token family could not be revoked.")
      }
    },

    refreshTokenGetByTokenHash(instanceId: string, tokenHash: string): Result<OidcRefreshTokenRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcRefreshTokenTable)
            .where(
              and(eq(oidcRefreshTokenTable.instanceId, instanceId), eq(oidcRefreshTokenTable.tokenHash, tokenHash)),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("oidcRefreshTokenGetByTokenHash", "The refresh token could not be read.")
      }
    },

    refreshTokenRotate(
      instanceId: string,
      clientId: string,
      tokenHash: string,
      replacedByHash: string,
      now: number,
    ): Result<OidcRefreshTokenRow | null> {
      try {
        return resultCreate(
          database
            .update(oidcRefreshTokenTable)
            .set({ replacedByHash, revokedAt: now })
            .where(
              and(
                eq(oidcRefreshTokenTable.instanceId, instanceId),
                eq(oidcRefreshTokenTable.clientId, clientId),
                eq(oidcRefreshTokenTable.tokenHash, tokenHash),
                gt(oidcRefreshTokenTable.expiresAt, now),
                isNull(oidcRefreshTokenTable.revokedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("oidcRefreshTokenRotate", "The refresh token could not be rotated.")
      }
    },

    authorizationRequestCreate(input: OidcAuthorizationRequestInsert): Result<OidcAuthorizationRequestRow> {
      try {
        const row = database.insert(oidcAuthorizationRequestTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("oidcAuthorizationRequestCreate", "The authorization request could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("oidcAuthorizationRequestCreate", "The authorization request could not be created.")
      }
    },

    authorizationRequestGet(instanceId: string, requestId: string): Result<OidcAuthorizationRequestRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcAuthorizationRequestTable)
            .where(
              and(
                eq(oidcAuthorizationRequestTable.instanceId, instanceId),
                eq(oidcAuthorizationRequestTable.id, requestId),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("oidcAuthorizationRequestGet", "The authorization request could not be read.")
      }
    },

    authorizationRequestApprove(
      instanceId: string,
      requestId: string,
      approvedAt: number,
    ): Result<OidcAuthorizationRequestRow | null> {
      try {
        return resultCreate(
          database
            .update(oidcAuthorizationRequestTable)
            .set({ approvedAt })
            .where(
              and(
                eq(oidcAuthorizationRequestTable.instanceId, instanceId),
                eq(oidcAuthorizationRequestTable.id, requestId),
                isNull(oidcAuthorizationRequestTable.approvedAt),
                isNull(oidcAuthorizationRequestTable.rejectedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("oidcAuthorizationRequestApprove", "The authorization request could not be approved.")
      }
    },

    authorizationRequestReject(
      instanceId: string,
      requestId: string,
      rejectedAt: number,
    ): Result<OidcAuthorizationRequestRow | null> {
      try {
        return resultCreate(
          database
            .update(oidcAuthorizationRequestTable)
            .set({ rejectedAt })
            .where(
              and(
                eq(oidcAuthorizationRequestTable.instanceId, instanceId),
                eq(oidcAuthorizationRequestTable.id, requestId),
                isNull(oidcAuthorizationRequestTable.approvedAt),
                isNull(oidcAuthorizationRequestTable.rejectedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("oidcAuthorizationRequestReject", "The authorization request could not be rejected.")
      }
    },

    consentGet(instanceId: string, userId: string, clientId: string): Result<OidcConsentRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcConsentTable)
            .where(
              and(
                eq(oidcConsentTable.instanceId, instanceId),
                eq(oidcConsentTable.userId, userId),
                eq(oidcConsentTable.clientId, clientId),
                isNull(oidcConsentTable.revokedAt),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("oidcConsentGet", "The OIDC consent could not be read.")
      }
    },

    consentList(instanceId: string, userId: string): Result<OidcConsentRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcConsentTable)
            .where(
              and(
                eq(oidcConsentTable.instanceId, instanceId),
                eq(oidcConsentTable.userId, userId),
                isNull(oidcConsentTable.revokedAt),
              ),
            )
            .orderBy(asc(oidcConsentTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("oidcConsentList", "The OIDC consents could not be read.")
      }
    },

    consentUpsert(input: OidcConsentInsert): Result<OidcConsentRow> {
      try {
        const existing = database
          .select()
          .from(oidcConsentTable)
          .where(
            and(
              eq(oidcConsentTable.instanceId, input.instanceId),
              eq(oidcConsentTable.userId, input.userId),
              eq(oidcConsentTable.clientId, input.clientId),
            ),
          )
          .get()
        if (existing === undefined) {
          const row = database.insert(oidcConsentTable).values(input).returning().get()
          if (row === undefined) return resultErrorCreate("oidcConsentUpsert", "The OIDC consent could not be saved.")
          return resultCreate(row)
        }
        const row = database
          .update(oidcConsentTable)
          .set({ ...input, revokedAt: null })
          .where(
            and(
              eq(oidcConsentTable.instanceId, input.instanceId),
              eq(oidcConsentTable.userId, input.userId),
              eq(oidcConsentTable.clientId, input.clientId),
            ),
          )
          .returning()
          .get()
        if (row === undefined) return resultErrorCreate("oidcConsentUpsert", "The OIDC consent could not be saved.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("oidcConsentUpsert", "The OIDC consent could not be saved.")
      }
    },

    consentRevoke(
      instanceId: string,
      userId: string,
      clientId: string,
      revokedAt: number,
    ): Result<OidcConsentRow | null> {
      try {
        return resultCreate(
          database
            .update(oidcConsentTable)
            .set({ revokedAt, updatedAt: revokedAt })
            .where(
              and(
                eq(oidcConsentTable.instanceId, instanceId),
                eq(oidcConsentTable.userId, userId),
                eq(oidcConsentTable.clientId, clientId),
                isNull(oidcConsentTable.revokedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("oidcConsentRevoke", "The OIDC consent could not be revoked.")
      }
    },

    consentEventVersionGet(instanceId: string, userId: string, clientId: string): Result<number> {
      try {
        const event = database
          .select({ aggregateVersion: storageEventTable.aggregateVersion })
          .from(storageEventTable)
          .where(
            and(
              eq(storageEventTable.instanceId, instanceId),
              eq(storageEventTable.aggregateType, "oidc_consent"),
              eq(storageEventTable.aggregateId, `${userId}:${clientId}`),
            ),
          )
          .orderBy(desc(storageEventTable.aggregateVersion))
          .get()
        return resultCreate(event?.aggregateVersion ?? 0)
      } catch (_error) {
        return resultErrorCreate("oidcConsentEventVersionGet", "The OIDC consent event version could not be read.")
      }
    },

    accessTokenSessionRevoke(instanceId: string, sessionId: string, revokedAt: number): Result<OidcAccessTokenRow[]> {
      try {
        return resultCreate(
          database
            .update(oidcAccessTokenTable)
            .set({ revokedAt })
            .where(
              and(
                eq(oidcAccessTokenTable.instanceId, instanceId),
                eq(oidcAccessTokenTable.sessionId, sessionId),
                isNull(oidcAccessTokenTable.revokedAt),
              ),
            )
            .returning()
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("oidcAccessTokenSessionRevoke", "The access tokens could not be revoked.")
      }
    },

    refreshTokenSessionRevoke(instanceId: string, sessionId: string, revokedAt: number): Result<OidcRefreshTokenRow[]> {
      try {
        return resultCreate(
          database
            .update(oidcRefreshTokenTable)
            .set({ revokedAt })
            .where(
              and(
                eq(oidcRefreshTokenTable.instanceId, instanceId),
                eq(oidcRefreshTokenTable.sessionId, sessionId),
                isNull(oidcRefreshTokenTable.revokedAt),
              ),
            )
            .returning()
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("oidcRefreshTokenSessionRevoke", "The refresh tokens could not be revoked.")
      }
    },

    clientCreate(input: OidcClientInsert): Result<OidcClientRow> {
      try {
        const row = database.insert(oidcClientTable).values(input).returning().get()
        if (row === undefined) return resultErrorCreate("oidcClientCreate", "The OIDC client could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("oidcClientCreate", "The OIDC client could not be created.")
      }
    },

    clientGet(instanceId: string, clientId: string): Result<OidcClientRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcClientTable)
            .where(and(eq(oidcClientTable.instanceId, instanceId), eq(oidcClientTable.id, clientId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("oidcClientGet", "The OIDC client could not be read.")
      }
    },

    clientList(instanceId: string): Result<OidcClientRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcClientTable)
            .where(eq(oidcClientTable.instanceId, instanceId))
            .orderBy(asc(oidcClientTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("oidcClientList", "The OIDC clients could not be read.")
      }
    },

    clientUpdate(instanceId: string, clientId: string, input: OidcClientUpdate): Result<OidcClientRow | null> {
      try {
        return resultCreate(
          database
            .update(oidcClientTable)
            .set(input)
            .where(and(eq(oidcClientTable.instanceId, instanceId), eq(oidcClientTable.id, clientId)))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("oidcClientUpdate", "The OIDC client could not be updated.")
      }
    },

    signingKeyCreate(input: OidcSigningKeyInsert): Result<OidcSigningKeyRow> {
      try {
        const row = database.insert(oidcSigningKeyTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("oidcSigningKeyCreate", "The OIDC signing key could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("oidcSigningKeyCreate", "The OIDC signing key could not be created.")
      }
    },

    signingKeyGet(instanceId: string, signingKeyId: string): Result<OidcSigningKeyRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcSigningKeyTable)
            .where(and(eq(oidcSigningKeyTable.instanceId, instanceId), eq(oidcSigningKeyTable.id, signingKeyId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("oidcSigningKeyGet", "The OIDC signing key could not be read.")
      }
    },

    signingKeyList(instanceId: string): Result<OidcSigningKeyRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcSigningKeyTable)
            .where(eq(oidcSigningKeyTable.instanceId, instanceId))
            .orderBy(desc(oidcSigningKeyTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("oidcSigningKeyList", "The OIDC signing keys could not be read.")
      }
    },

    signingKeyUpdate(
      instanceId: string,
      signingKeyId: string,
      input: OidcSigningKeyUpdate,
    ): Result<OidcSigningKeyRow | null> {
      try {
        return resultCreate(
          database
            .update(oidcSigningKeyTable)
            .set(input)
            .where(and(eq(oidcSigningKeyTable.instanceId, instanceId), eq(oidcSigningKeyTable.id, signingKeyId)))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("oidcSigningKeyUpdate", "The OIDC signing key could not be updated.")
      }
    },
  }
}
