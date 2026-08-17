import { and, asc, desc, eq, gt, isNull } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type OidcAuthorizationCodeRow, oidcAuthorizationCodeTable } from "./oidcAuthorizationCodeTable.js"
import { type OidcAuthorizationRequestRow, oidcAuthorizationRequestTable } from "./oidcAuthorizationRequestTable.js"
import { type OidcAccessTokenRow, oidcAccessTokenTable } from "./oidcAccessTokenTable.js"
import { type OidcClientRow, oidcClientTable } from "./oidcClientTable.js"
import { type OidcRefreshTokenRow, oidcRefreshTokenTable } from "./oidcRefreshTokenTable.js"
import { type OidcSigningKeyRow, oidcSigningKeyTable } from "./oidcSigningKeyTable.js"

type OidcClientInsert = typeof oidcClientTable.$inferInsert
type OidcClientUpdate = Partial<OidcClientInsert>
type OidcSigningKeyInsert = typeof oidcSigningKeyTable.$inferInsert
type OidcSigningKeyUpdate = Partial<OidcSigningKeyInsert>
type OidcAuthorizationCodeInsert = typeof oidcAuthorizationCodeTable.$inferInsert
type OidcAuthorizationRequestInsert = typeof oidcAuthorizationRequestTable.$inferInsert
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
