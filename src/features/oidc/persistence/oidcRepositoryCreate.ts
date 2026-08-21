import { and, asc, desc, eq, gt, isNull } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type OidcAccessTokenRow, oidcAccessTokenTable } from "./oidcAccessTokenTable.js"
import { type OidcAuthorizationCodeRow, oidcAuthorizationCodeTable } from "./oidcAuthorizationCodeTable.js"
import { type OidcAuthorizationRequestRow, oidcAuthorizationRequestTable } from "./oidcAuthorizationRequestTable.js"
import { type OidcClientRow, oidcClientTable } from "./oidcClientTable.js"
import { type OidcConsentRow, oidcConsentTable } from "./oidcConsentTable.js"
import { type OidcInteractionRow, oidcInteractionTable } from "./oidcInteractionTable.js"
import { type OidcRefreshTokenRow, oidcRefreshTokenTable } from "./oidcRefreshTokenTable.js"
import { type OidcSigningKeyRow, oidcSigningKeyTable } from "./oidcSigningKeyTable.js"

type OidcClientInsert = typeof oidcClientTable.$inferInsert
type OidcClientUpdate = Partial<OidcClientInsert>
type OidcSigningKeyInsert = typeof oidcSigningKeyTable.$inferInsert
type OidcSigningKeyUpdate = Partial<OidcSigningKeyInsert>
type OidcAuthorizationCodeInsert = typeof oidcAuthorizationCodeTable.$inferInsert
type OidcAuthorizationRequestInsert = typeof oidcAuthorizationRequestTable.$inferInsert
type OidcConsentInsert = typeof oidcConsentTable.$inferInsert
type OidcInteractionInsert = typeof oidcInteractionTable.$inferInsert
type OidcAccessTokenInsert = typeof oidcAccessTokenTable.$inferInsert
type OidcRefreshTokenInsert = typeof oidcRefreshTokenTable.$inferInsert

export function oidcRepositoryCreate(database: StorageExecutor) {
  return {
    authorizationCodeConsume(
      realmId: string,
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
                eq(oidcAuthorizationCodeTable.realmId, realmId),
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
        return resultErrorCodedCreate(
          "oidcAuthorizationCodeConsume",
          "The authorization code could not be consumed.",
          "oidc.write-failed",
        )
      }
    },

    authorizationCodeCreate(input: OidcAuthorizationCodeInsert): Result<OidcAuthorizationCodeRow> {
      try {
        const row = database.insert(oidcAuthorizationCodeTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "oidcAuthorizationCodeCreate",
            "The authorization code could not be created.",
            "oidc.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcAuthorizationCodeCreate",
          "The authorization code could not be created.",
          "oidc.write-failed",
        )
      }
    },

    authorizationCodeGetByTokenHash(realmId: string, tokenHash: string): Result<OidcAuthorizationCodeRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcAuthorizationCodeTable)
            .where(
              and(eq(oidcAuthorizationCodeTable.realmId, realmId), eq(oidcAuthorizationCodeTable.tokenHash, tokenHash)),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcAuthorizationCodeGetByTokenHash",
          "The authorization code could not be read.",
          "oidc.read-failed",
        )
      }
    },

    accessTokenCreate(input: OidcAccessTokenInsert): Result<OidcAccessTokenRow> {
      try {
        const row = database.insert(oidcAccessTokenTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "oidcAccessTokenCreate",
            "The access token could not be created.",
            "oidc.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcAccessTokenCreate",
          "The access token could not be created.",
          "oidc.write-failed",
        )
      }
    },

    accessTokenGetByTokenHash(realmId: string, tokenHash: string): Result<OidcAccessTokenRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcAccessTokenTable)
            .where(and(eq(oidcAccessTokenTable.realmId, realmId), eq(oidcAccessTokenTable.tokenHash, tokenHash)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcAccessTokenGetByTokenHash",
          "The access token could not be read.",
          "oidc.read-failed",
        )
      }
    },

    accessTokenRevoke(
      realmId: string,
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
                eq(oidcAccessTokenTable.realmId, realmId),
                eq(oidcAccessTokenTable.clientId, clientId),
                eq(oidcAccessTokenTable.tokenHash, tokenHash),
                isNull(oidcAccessTokenTable.revokedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcAccessTokenRevoke",
          "The access token could not be revoked.",
          "oidc.write-failed",
        )
      }
    },

    accessTokenFamilyRevoke(
      realmId: string,
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
              eq(oidcAccessTokenTable.realmId, realmId),
              eq(oidcAccessTokenTable.clientId, clientId),
              eq(oidcAccessTokenTable.refreshFamilyId, familyId),
              isNull(oidcAccessTokenTable.revokedAt),
            ),
          )
          .returning()
          .all()
        return resultCreate(rows)
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcAccessTokenFamilyRevoke",
          "The access token family could not be revoked.",
          "oidc.write-failed",
        )
      }
    },

    refreshTokenCreate(input: OidcRefreshTokenInsert): Result<OidcRefreshTokenRow> {
      try {
        const row = database.insert(oidcRefreshTokenTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "oidcRefreshTokenCreate",
            "The refresh token could not be created.",
            "oidc.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcRefreshTokenCreate",
          "The refresh token could not be created.",
          "oidc.write-failed",
        )
      }
    },

    refreshTokenFamilyRevoke(
      realmId: string,
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
              eq(oidcRefreshTokenTable.realmId, realmId),
              eq(oidcRefreshTokenTable.clientId, clientId),
              eq(oidcRefreshTokenTable.familyId, familyId),
              isNull(oidcRefreshTokenTable.revokedAt),
            ),
          )
          .returning()
          .all()
        return resultCreate(rows)
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcRefreshTokenFamilyRevoke",
          "The refresh token family could not be revoked.",
          "oidc.write-failed",
        )
      }
    },

    refreshTokenGetByTokenHash(realmId: string, tokenHash: string): Result<OidcRefreshTokenRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcRefreshTokenTable)
            .where(and(eq(oidcRefreshTokenTable.realmId, realmId), eq(oidcRefreshTokenTable.tokenHash, tokenHash)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcRefreshTokenGetByTokenHash",
          "The refresh token could not be read.",
          "oidc.read-failed",
        )
      }
    },

    refreshTokenRotate(
      realmId: string,
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
                eq(oidcRefreshTokenTable.realmId, realmId),
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
        return resultErrorCodedCreate(
          "oidcRefreshTokenRotate",
          "The refresh token could not be rotated.",
          "oidc.write-failed",
        )
      }
    },

    authorizationRequestCreate(input: OidcAuthorizationRequestInsert): Result<OidcAuthorizationRequestRow> {
      try {
        const row = database.insert(oidcAuthorizationRequestTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "oidcAuthorizationRequestCreate",
            "The authorization request could not be created.",
            "oidc.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcAuthorizationRequestCreate",
          "The authorization request could not be created.",
          "oidc.write-failed",
        )
      }
    },

    interactionCreate(input: OidcInteractionInsert): Result<OidcInteractionRow> {
      try {
        const row = database.insert(oidcInteractionTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "oidcInteractionCreate",
            "The OIDC interaction could not be created.",
            "oidc.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcInteractionCreate",
          "The OIDC interaction could not be created.",
          "oidc.write-failed",
        )
      }
    },

    interactionGetByHandleHash(realmId: string, handleHash: string): Result<OidcInteractionRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcInteractionTable)
            .where(and(eq(oidcInteractionTable.realmId, realmId), eq(oidcInteractionTable.handleHash, handleHash)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcInteractionGetByHandleHash",
          "The OIDC interaction could not be read.",
          "oidc.read-failed",
        )
      }
    },

    interactionBind(
      realmId: string,
      interactionId: string,
      sessionId: string,
      userId: string,
    ): Result<OidcInteractionRow | null> {
      try {
        return resultCreate(
          database
            .update(oidcInteractionTable)
            .set({ sessionId, userId })
            .where(
              and(
                eq(oidcInteractionTable.realmId, realmId),
                eq(oidcInteractionTable.id, interactionId),
                isNull(oidcInteractionTable.sessionId),
                isNull(oidcInteractionTable.userId),
                isNull(oidcInteractionTable.completedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcInteractionBind",
          "The OIDC interaction could not be bound.",
          "oidc.write-failed",
        )
      }
    },

    interactionAuthorizationRequestSet(
      realmId: string,
      interactionId: string,
      authorizationRequestId: string,
    ): Result<OidcInteractionRow | null> {
      try {
        return resultCreate(
          database
            .update(oidcInteractionTable)
            .set({ authorizationRequestId })
            .where(
              and(
                eq(oidcInteractionTable.realmId, realmId),
                eq(oidcInteractionTable.id, interactionId),
                isNull(oidcInteractionTable.authorizationRequestId),
                isNull(oidcInteractionTable.completedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcInteractionAuthorizationRequestSet",
          "The OIDC interaction could not be updated.",
          "oidc.write-failed",
        )
      }
    },

    interactionComplete(
      realmId: string,
      interactionId: string,
      completedAt: number,
    ): Result<OidcInteractionRow | null> {
      try {
        return resultCreate(
          database
            .update(oidcInteractionTable)
            .set({ completedAt })
            .where(
              and(
                eq(oidcInteractionTable.realmId, realmId),
                eq(oidcInteractionTable.id, interactionId),
                isNull(oidcInteractionTable.completedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcInteractionComplete",
          "The OIDC interaction could not be completed.",
          "oidc.write-failed",
        )
      }
    },

    authorizationRequestGet(realmId: string, requestId: string): Result<OidcAuthorizationRequestRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcAuthorizationRequestTable)
            .where(
              and(eq(oidcAuthorizationRequestTable.realmId, realmId), eq(oidcAuthorizationRequestTable.id, requestId)),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcAuthorizationRequestGet",
          "The authorization request could not be read.",
          "oidc.read-failed",
        )
      }
    },

    authorizationRequestApprove(
      realmId: string,
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
                eq(oidcAuthorizationRequestTable.realmId, realmId),
                eq(oidcAuthorizationRequestTable.id, requestId),
                isNull(oidcAuthorizationRequestTable.approvedAt),
                isNull(oidcAuthorizationRequestTable.rejectedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcAuthorizationRequestApprove",
          "The authorization request could not be approved.",
          "oidc.write-failed",
        )
      }
    },

    authorizationRequestReject(
      realmId: string,
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
                eq(oidcAuthorizationRequestTable.realmId, realmId),
                eq(oidcAuthorizationRequestTable.id, requestId),
                isNull(oidcAuthorizationRequestTable.approvedAt),
                isNull(oidcAuthorizationRequestTable.rejectedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcAuthorizationRequestReject",
          "The authorization request could not be rejected.",
          "oidc.write-failed",
        )
      }
    },

    consentGet(realmId: string, userId: string, clientId: string): Result<OidcConsentRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcConsentTable)
            .where(
              and(
                eq(oidcConsentTable.realmId, realmId),
                eq(oidcConsentTable.userId, userId),
                eq(oidcConsentTable.clientId, clientId),
                isNull(oidcConsentTable.revokedAt),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate("oidcConsentGet", "The OIDC consent could not be read.", "oidc.read-failed")
      }
    },

    consentList(realmId: string, userId: string): Result<OidcConsentRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcConsentTable)
            .where(
              and(
                eq(oidcConsentTable.realmId, realmId),
                eq(oidcConsentTable.userId, userId),
                isNull(oidcConsentTable.revokedAt),
              ),
            )
            .orderBy(asc(oidcConsentTable.createdAt), asc(oidcConsentTable.clientId))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate("oidcConsentList", "The OIDC consents could not be read.", "oidc.read-failed")
      }
    },

    consentUpsert(input: OidcConsentInsert): Result<OidcConsentRow> {
      try {
        const existing = database
          .select()
          .from(oidcConsentTable)
          .where(
            and(
              eq(oidcConsentTable.realmId, input.realmId),
              eq(oidcConsentTable.userId, input.userId),
              eq(oidcConsentTable.clientId, input.clientId),
            ),
          )
          .get()
        if (existing === undefined) {
          const row = database.insert(oidcConsentTable).values(input).returning().get()
          if (row === undefined)
            return resultErrorCodedCreate(
              "oidcConsentUpsert",
              "The OIDC consent could not be saved.",
              "oidc.write-failed",
            )
          return resultCreate(row)
        }
        const row = database
          .update(oidcConsentTable)
          .set({ ...input, revokedAt: null })
          .where(
            and(
              eq(oidcConsentTable.realmId, input.realmId),
              eq(oidcConsentTable.userId, input.userId),
              eq(oidcConsentTable.clientId, input.clientId),
            ),
          )
          .returning()
          .get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "oidcConsentUpsert",
            "The OIDC consent could not be saved.",
            "oidc.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate("oidcConsentUpsert", "The OIDC consent could not be saved.", "oidc.write-failed")
      }
    },

    consentRevoke(realmId: string, userId: string, clientId: string, revokedAt: number): Result<OidcConsentRow | null> {
      try {
        return resultCreate(
          database
            .update(oidcConsentTable)
            .set({ revokedAt, updatedAt: revokedAt })
            .where(
              and(
                eq(oidcConsentTable.realmId, realmId),
                eq(oidcConsentTable.userId, userId),
                eq(oidcConsentTable.clientId, clientId),
                isNull(oidcConsentTable.revokedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcConsentRevoke",
          "The OIDC consent could not be revoked.",
          "oidc.write-failed",
        )
      }
    },

    consentEventVersionGet(realmId: string, userId: string, clientId: string): Result<number> {
      try {
        const event = database
          .select({ aggregateVersion: storageEventTable.aggregateVersion })
          .from(storageEventTable)
          .where(
            and(
              eq(storageEventTable.realmId, realmId),
              eq(storageEventTable.aggregateType, "oidc_consent"),
              eq(storageEventTable.aggregateId, `${userId}:${clientId}`),
            ),
          )
          .orderBy(desc(storageEventTable.aggregateVersion))
          .get()
        return resultCreate(event?.aggregateVersion ?? 0)
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcConsentEventVersionGet",
          "The OIDC consent event version could not be read.",
          "oidc.read-failed",
        )
      }
    },

    accessTokenSessionRevoke(realmId: string, sessionId: string, revokedAt: number): Result<OidcAccessTokenRow[]> {
      try {
        return resultCreate(
          database
            .update(oidcAccessTokenTable)
            .set({ revokedAt })
            .where(
              and(
                eq(oidcAccessTokenTable.realmId, realmId),
                eq(oidcAccessTokenTable.sessionId, sessionId),
                isNull(oidcAccessTokenTable.revokedAt),
              ),
            )
            .returning()
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcAccessTokenSessionRevoke",
          "The access tokens could not be revoked.",
          "oidc.write-failed",
        )
      }
    },

    refreshTokenSessionRevoke(realmId: string, sessionId: string, revokedAt: number): Result<OidcRefreshTokenRow[]> {
      try {
        return resultCreate(
          database
            .update(oidcRefreshTokenTable)
            .set({ revokedAt })
            .where(
              and(
                eq(oidcRefreshTokenTable.realmId, realmId),
                eq(oidcRefreshTokenTable.sessionId, sessionId),
                isNull(oidcRefreshTokenTable.revokedAt),
              ),
            )
            .returning()
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcRefreshTokenSessionRevoke",
          "The refresh tokens could not be revoked.",
          "oidc.write-failed",
        )
      }
    },

    clientCreate(input: OidcClientInsert): Result<OidcClientRow> {
      try {
        const row = database.insert(oidcClientTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "oidcClientCreate",
            "The OIDC client could not be created.",
            "oidc.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate("oidcClientCreate", "The OIDC client could not be created.", "oidc.write-failed")
      }
    },

    clientGet(realmId: string, clientId: string): Result<OidcClientRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcClientTable)
            .where(and(eq(oidcClientTable.realmId, realmId), eq(oidcClientTable.id, clientId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate("oidcClientGet", "The OIDC client could not be read.", "oidc.read-failed")
      }
    },

    clientList(realmId: string): Result<OidcClientRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcClientTable)
            .where(eq(oidcClientTable.realmId, realmId))
            .orderBy(asc(oidcClientTable.createdAt), asc(oidcClientTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate("oidcClientList", "The OIDC clients could not be read.", "oidc.read-failed")
      }
    },

    clientUpdate(realmId: string, clientId: string, input: OidcClientUpdate): Result<OidcClientRow | null> {
      try {
        return resultCreate(
          database
            .update(oidcClientTable)
            .set(input)
            .where(and(eq(oidcClientTable.realmId, realmId), eq(oidcClientTable.id, clientId)))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate("oidcClientUpdate", "The OIDC client could not be updated.", "oidc.write-failed")
      }
    },

    signingKeyCreate(input: OidcSigningKeyInsert): Result<OidcSigningKeyRow> {
      try {
        const row = database.insert(oidcSigningKeyTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "oidcSigningKeyCreate",
            "The OIDC signing key could not be created.",
            "oidc.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcSigningKeyCreate",
          "The OIDC signing key could not be created.",
          "oidc.write-failed",
        )
      }
    },

    signingKeyGet(realmId: string, signingKeyId: string): Result<OidcSigningKeyRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcSigningKeyTable)
            .where(and(eq(oidcSigningKeyTable.realmId, realmId), eq(oidcSigningKeyTable.id, signingKeyId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcSigningKeyGet",
          "The OIDC signing key could not be read.",
          "oidc.read-failed",
        )
      }
    },

    signingKeyList(realmId: string): Result<OidcSigningKeyRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(oidcSigningKeyTable)
            .where(eq(oidcSigningKeyTable.realmId, realmId))
            .orderBy(desc(oidcSigningKeyTable.createdAt), desc(oidcSigningKeyTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcSigningKeyList",
          "The OIDC signing keys could not be read.",
          "oidc.read-failed",
        )
      }
    },

    signingKeyUpdate(
      realmId: string,
      signingKeyId: string,
      input: OidcSigningKeyUpdate,
    ): Result<OidcSigningKeyRow | null> {
      try {
        return resultCreate(
          database
            .update(oidcSigningKeyTable)
            .set(input)
            .where(and(eq(oidcSigningKeyTable.realmId, realmId), eq(oidcSigningKeyTable.id, signingKeyId)))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "oidcSigningKeyUpdate",
          "The OIDC signing key could not be updated.",
          "oidc.write-failed",
        )
      }
    },
  }
}
