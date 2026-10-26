import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { resultCreate } from "../../../platform/errors/resultCreate.js"

/**
 * Parses a lifetime text input. Empty means "no override" so the caller can map
 * it to undefined on create or null on edit, following the patch-clearable schemas.
 */
export function oidcAdminLifetimeParse(
  raw: string,
  schema: v.GenericSchema<number | null>,
): Result<number | undefined> {
  const op = "oidcAdminLifetimeParse"
  const trimmed = raw.trim()
  if (trimmed.length === 0) return resultCreate(undefined)
  if (!/^[0-9]+$/.test(trimmed))
    return resultErrorCodedCreate(op, "The lifetime must be a whole number of seconds.", "oidc.configuration-invalid")
  const parsed = v.safeParse(schema, Number(trimmed))
  if (!parsed.success || parsed.output === null)
    return resultErrorCodedCreate(op, "The lifetime is outside the allowed range.", "oidc.configuration-invalid")
  return resultCreate(parsed.output)
}
