import { type Result } from "#result"
import * as v from "valibot"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
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
      instanceId: row.instanceId,
      publicJwk,
      retiredAt: row.retiredAt,
      status: row.status,
    })
    if (!parsed.success) return resultErrorCreate(op, "The signing key is invalid.")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate(op, "The signing key is invalid.")
  }
}
