import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import type { OidcSigningKeyRow } from "../persistence/oidcSigningKeyTable.js"
import { oidcSigningKeySchema } from "../public/oidcSigningKeySchema.js"

export function oidcSigningKeyPublicViewCreate(
  row: OidcSigningKeyRow,
): Result<v.InferOutput<typeof oidcSigningKeySchema>> {
  const op = "oidcSigningKeyPublicViewCreate"
  try {
    const publicJwk = JSON.parse(row.publicJwk) as unknown
    const parsed = v.safeParse(oidcSigningKeySchema, {
      algorithm: row.algorithm,
      createdAt: row.createdAt,
      id: row.id,
      realmId: row.realmId,
      publicJwk,
      retiredAt: row.retiredAt,
      status: row.status,
    })
    if (!parsed.success) return resultErrorCreate(op, "The signing key is invalid.", "oidc.invalid")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate(op, "The signing key is invalid.", "oidc.invalid")
  }
}
