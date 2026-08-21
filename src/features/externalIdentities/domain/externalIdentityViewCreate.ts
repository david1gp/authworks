import * as v from "valibot"
import type { ExternalIdentityRow } from "../persistence/externalIdentityTable.js"
import { externalIdentityProviderTypeSchema } from "../public/externalIdentityProviderTypeSchema.js"
import type { ExternalIdentity } from "../public/externalIdentitySchema.js"

export function externalIdentityViewCreate(row: ExternalIdentityRow, providerType: string): ExternalIdentity {
  const parsedType = v.safeParse(externalIdentityProviderTypeSchema, providerType)
  return {
    createdAt: row.createdAt,
    ...(row.displayName === null ? {} : { displayName: row.displayName }),
    ...(row.email === null ? {} : { email: row.email }),
    emailVerified: row.emailVerified,
    externalSubject: row.externalSubject,
    id: row.id,
    realmId: row.realmId,
    providerId: row.providerId,
    providerType: parsedType.success ? parsedType.output : "google",
    updatedAt: row.updatedAt,
    userId: row.userId,
    ...(row.username === null ? {} : { username: row.username }),
    version: row.version,
  }
}
