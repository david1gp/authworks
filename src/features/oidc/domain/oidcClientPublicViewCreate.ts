import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import type { OidcClientRow } from "../persistence/oidcClientTable.js"
import { oidcClientSchema } from "../public/oidcClientSchema.js"
import { oidcClientCompatibilitySettingsValidate } from "./oidcClientCompatibilitySettingsValidate.js"

const oidcClientDefaultGrantTypes = ["authorization_code", "refresh_token"]
const oidcClientDefaultResponseTypes = ["code"]

function oidcClientStringListParse(value: string | null, fallback: string[]): string[] {
  if (value === null) return [...fallback]
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed) || !parsed.every((entry): entry is string => typeof entry === "string"))
      return [...fallback]
    return parsed
  } catch (_error) {
    return [...fallback]
  }
}

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
      idTokenRoleAssertion: row.idTokenRoleAssertion === 1,
      idTokenUserinfoAssertion: row.idTokenUserinfoAssertion === 1,
    })
    if (!compatibility.success) return resultErrorCreate(op, "The OIDC client is invalid.", "oidc.client-invalid")
    const parsed = v.safeParse(oidcClientSchema, {
      allowedScopes: JSON.parse(row.allowedScopes),
      accessTokenLifetimeSeconds: row.accessTokenLifetimeSeconds,
      accessTokenRoleAssertion: compatibility.data.accessTokenRoleAssertion,
      applicationId: row.applicationId ?? undefined,
      clientType: row.clientType,
      additionalOrigins: compatibility.data.additionalOrigins,
      createdAt: row.createdAt,
      devMode: row.devMode === 1,
      grantTypes: oidcClientStringListParse(row.grantTypes, oidcClientDefaultGrantTypes),
      id: row.id,
      idTokenLifetimeSeconds: row.idTokenLifetimeSeconds,
      idTokenRoleAssertion: compatibility.data.idTokenRoleAssertion,
      idTokenUserinfoAssertion: compatibility.data.idTokenUserinfoAssertion,
      realmId: row.realmId,
      name: row.name,
      postLogoutRedirectUris: JSON.parse(row.postLogoutRedirectUris),
      projectId: row.projectId ?? undefined,
      redirectUris: JSON.parse(row.redirectUris),
      refreshTokenAbsoluteLifetimeSeconds: row.refreshTokenAbsoluteLifetimeSeconds,
      refreshTokenIdleLifetimeSeconds: row.refreshTokenIdleLifetimeSeconds,
      requireConsent: row.requireConsent === 1,
      responseTypes: oidcClientStringListParse(row.responseTypes, oidcClientDefaultResponseTypes),
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
