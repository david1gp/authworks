import { and, asc, desc, eq, isNull } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import {
  type ExternalIdentityOAuthTransactionRow,
  externalIdentityOAuthTransactionTable,
} from "./externalIdentityOAuthTransactionTable.js"
import { type ExternalIdentityProviderRow, externalIdentityProviderTable } from "./externalIdentityProviderTable.js"
import { type ExternalIdentityRow, externalIdentityTable } from "./externalIdentityTable.js"

export function externalIdentityRepositoryCreate(database: StorageExecutor) {
  return {
    externalIdentityCreate(input: typeof externalIdentityTable.$inferInsert): Result<ExternalIdentityRow> {
      try {
        const row = database.insert(externalIdentityTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate(
            "externalIdentityCreate",
            "The external identity could not be created.",
            "external-identities.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate(
          "externalIdentityCreate",
          "The external identity could not be created.",
          "external-identities.write-failed",
        )
      }
    },

    externalIdentityDelete(
      realmId: string,
      userId: string,
      providerId: string,
      externalSubject: string,
    ): Result<ExternalIdentityRow | null> {
      try {
        return resultCreate(
          database
            .delete(externalIdentityTable)
            .where(
              and(
                eq(externalIdentityTable.realmId, realmId),
                eq(externalIdentityTable.userId, userId),
                eq(externalIdentityTable.providerId, providerId),
                eq(externalIdentityTable.externalSubject, externalSubject),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "externalIdentityDelete",
          "The external identity could not be removed.",
          "external-identities.write-failed",
        )
      }
    },

    externalIdentityGetByProviderSubject(
      providerId: string,
      externalSubject: string,
    ): Result<ExternalIdentityRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(externalIdentityTable)
            .where(
              and(
                eq(externalIdentityTable.providerId, providerId),
                eq(externalIdentityTable.externalSubject, externalSubject),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "externalIdentityGetByProviderSubject",
          "The external identity could not be read.",
          "external-identities.read-failed",
        )
      }
    },

    externalIdentityList(realmId: string, userId: string): Result<ExternalIdentityRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(externalIdentityTable)
            .where(and(eq(externalIdentityTable.realmId, realmId), eq(externalIdentityTable.userId, userId)))
            .orderBy(asc(externalIdentityTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate(
          "externalIdentityList",
          "The external identities could not be read.",
          "external-identities.read-failed",
        )
      }
    },

    externalIdentityOAuthTransactionCreate(
      input: typeof externalIdentityOAuthTransactionTable.$inferInsert,
    ): Result<ExternalIdentityOAuthTransactionRow> {
      try {
        const row = database.insert(externalIdentityOAuthTransactionTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate(
            "externalIdentityOAuthTransactionCreate",
            "The external authentication transaction could not be created.",
            "external-identities.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate(
          "externalIdentityOAuthTransactionCreate",
          "The external authentication transaction could not be created.",
          "external-identities.write-failed",
        )
      }
    },

    externalIdentityOAuthTransactionGetByState(
      realmId: string,
      stateHash: string,
    ): Result<ExternalIdentityOAuthTransactionRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(externalIdentityOAuthTransactionTable)
            .where(
              and(
                eq(externalIdentityOAuthTransactionTable.realmId, realmId),
                eq(externalIdentityOAuthTransactionTable.stateHash, stateHash),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "externalIdentityOAuthTransactionGetByState",
          "The external authentication transaction could not be read.",
          "external-identities.read-failed",
        )
      }
    },

    externalIdentityOAuthTransactionGetByConfirmationToken(
      realmId: string,
      confirmationTokenHash: string,
    ): Result<ExternalIdentityOAuthTransactionRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(externalIdentityOAuthTransactionTable)
            .where(
              and(
                eq(externalIdentityOAuthTransactionTable.realmId, realmId),
                eq(externalIdentityOAuthTransactionTable.confirmationTokenHash, confirmationTokenHash),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "externalIdentityOAuthTransactionGetByConfirmationToken",
          "The external identity link confirmation could not be read.",
          "external-identities.read-failed",
        )
      }
    },

    externalIdentityOAuthTransactionConsume(
      id: string,
      expectedVersion: number,
      consumedAt: number,
    ): Result<ExternalIdentityOAuthTransactionRow | null> {
      try {
        return resultCreate(
          database
            .update(externalIdentityOAuthTransactionTable)
            .set({ consumedAt, version: expectedVersion + 1 })
            .where(
              and(
                eq(externalIdentityOAuthTransactionTable.id, id),
                eq(externalIdentityOAuthTransactionTable.version, expectedVersion),
                isNull(externalIdentityOAuthTransactionTable.consumedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "externalIdentityOAuthTransactionConsume",
          "The external authentication transaction could not be consumed.",
          "external-identities.write-failed",
        )
      }
    },

    externalIdentityOAuthTransactionValidateAndStore(
      id: string,
      expectedVersion: number,
      input: Partial<typeof externalIdentityOAuthTransactionTable.$inferInsert>,
    ): Result<ExternalIdentityOAuthTransactionRow | null> {
      try {
        return resultCreate(
          database
            .update(externalIdentityOAuthTransactionTable)
            .set({ ...input, callbackValidatedAt: input.callbackValidatedAt ?? null, version: expectedVersion + 1 })
            .where(
              and(
                eq(externalIdentityOAuthTransactionTable.id, id),
                eq(externalIdentityOAuthTransactionTable.version, expectedVersion),
                isNull(externalIdentityOAuthTransactionTable.consumedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "externalIdentityOAuthTransactionValidateAndStore",
          "The external authentication transaction could not be updated.",
          "external-identities.write-failed",
        )
      }
    },

    externalIdentityProviderCreate(
      input: typeof externalIdentityProviderTable.$inferInsert,
    ): Result<ExternalIdentityProviderRow> {
      try {
        const row = database.insert(externalIdentityProviderTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate(
            "externalIdentityProviderCreate",
            "The external identity provider could not be created.",
            "external-identities.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate(
          "externalIdentityProviderCreate",
          "The external identity provider could not be created.",
          "external-identities.write-failed",
        )
      }
    },

    externalIdentityProviderGet(realmId: string, providerId: string): Result<ExternalIdentityProviderRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(externalIdentityProviderTable)
            .where(
              and(eq(externalIdentityProviderTable.realmId, realmId), eq(externalIdentityProviderTable.id, providerId)),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "externalIdentityProviderGet",
          "The external identity provider could not be read.",
          "external-identities.read-failed",
        )
      }
    },

    externalIdentityProviderList(realmId: string, organizationId?: string): Result<ExternalIdentityProviderRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(externalIdentityProviderTable)
            .where(
              organizationId === undefined
                ? and(
                    eq(externalIdentityProviderTable.realmId, realmId),
                    isNull(externalIdentityProviderTable.organizationId),
                  )
                : and(
                    eq(externalIdentityProviderTable.realmId, realmId),
                    eq(externalIdentityProviderTable.organizationId, organizationId),
                  ),
            )
            .orderBy(asc(externalIdentityProviderTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate(
          "externalIdentityProviderList",
          "The external identity providers could not be read.",
          "external-identities.read-failed",
        )
      }
    },

    externalIdentityProviderUpdate(
      realmId: string,
      providerId: string,
      input: Partial<typeof externalIdentityProviderTable.$inferInsert>,
    ): Result<ExternalIdentityProviderRow | null> {
      try {
        return resultCreate(
          database
            .update(externalIdentityProviderTable)
            .set(input)
            .where(
              and(eq(externalIdentityProviderTable.realmId, realmId), eq(externalIdentityProviderTable.id, providerId)),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "externalIdentityProviderUpdate",
          "The external identity provider could not be updated.",
          "external-identities.write-failed",
        )
      }
    },

    externalIdentityProviderEventVersionGet(providerId: string): Result<number> {
      try {
        const event = database
          .select({ aggregateVersion: storageEventTable.aggregateVersion })
          .from(storageEventTable)
          .where(
            and(
              eq(storageEventTable.aggregateType, "external_identity_provider"),
              eq(storageEventTable.aggregateId, providerId),
            ),
          )
          .orderBy(desc(storageEventTable.aggregateVersion))
          .get()
        return resultCreate(event?.aggregateVersion ?? 0)
      } catch (_error) {
        return resultErrorCreate(
          "externalIdentityProviderEventVersionGet",
          "The external identity provider event version could not be read.",
          "external-identities.read-failed",
        )
      }
    },

    externalIdentityEventVersionGet(identityId: string): Result<number> {
      try {
        const event = database
          .select({ aggregateVersion: storageEventTable.aggregateVersion })
          .from(storageEventTable)
          .where(
            and(
              eq(storageEventTable.aggregateType, "external_identity"),
              eq(storageEventTable.aggregateId, identityId),
            ),
          )
          .orderBy(desc(storageEventTable.aggregateVersion))
          .get()
        return resultCreate(event?.aggregateVersion ?? 0)
      } catch (_error) {
        return resultErrorCreate(
          "externalIdentityEventVersionGet",
          "The external identity event version could not be read.",
          "external-identities.read-failed",
        )
      }
    },
  }
}
