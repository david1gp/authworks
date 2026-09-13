import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import type { OidcClientRow } from "../persistence/oidcClientTable.js"
import { oidcClientSchema } from "../public/oidcClientSchema.js"
import { oidcClientCompatibilitySettingsValidate } from "./oidcClientCompatibilitySettingsValidate.js"

export function oidcClientPublicViewCreate(row: OidcClientRow): Result<v.InferOutput<typeof oidcClientSchema>> {
  const op = "oidcClientPublicViewCreate"
  try {
    const storedAdditionalOrigins: unknown = JSON.parse(row.additionalOrigins ?? "[]")
    if (
      !Array.isArray(storedAdditionalOrigins) ||
      !storedAdditionalOrigins.every((origin): origin is string => typeof origin === "string")
    )
      return resultErrorCreate(op, "The OIDC client is invalid.", "oidc.client-invalid")
    const compatibility = oidcClientCompatibilitySettingsValidate({
      accessTokenRoleAssertion: row.accessTokenRoleAssertion === 1,
      additionalOrigins: storedAdditionalOrigins,
      idTokenUserinfoAssertion: row.idTokenUserinfoAssertion === 1,
    })
    if (!compatibility.success) return resultErrorCreate(op, "The OIDC client is invalid.", "oidc.client-invalid")
    const parsed = v.safeParse(oidcClientSchema, {
      allowedScopes: JSON.parse(row.allowedScopes),
      accessTokenRoleAssertion: compatibility.data.accessTokenRoleAssertion,
      applicationId: row.applicationId ?? undefined,
      clientType: row.clientType,
      additionalOrigins: compatibility.data.additionalOrigins,
      createdAt: row.createdAt,
      id: row.id,
      idTokenUserinfoAssertion: compatibility.data.idTokenUserinfoAssertion,
      realmId: row.realmId,
      name: row.name,
      postLogoutRedirectUris: JSON.parse(row.postLogoutRedirectUris),
      projectId: row.projectId ?? undefined,
      redirectUris: JSON.parse(row.redirectUris),
      requireConsent: row.requireConsent === 1,
      status: row.status,
      trusted: row.trusted === 1,
      updatedAt: row.updatedAt,
    })
    if (!parsed.success) return resultErrorCreate(op, "The OIDC client is invalid.", "oidc.client-invalid")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate(op, "The OIDC client is invalid.", "oidc.client-invalid")
  }
}
