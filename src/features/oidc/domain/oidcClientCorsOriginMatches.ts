import { oidcOriginValidate } from "./oidcOriginValidate.js"
import { oidcRedirectUriValidate } from "./oidcRedirectUriValidate.js"

type OidcClientCorsOriginSource = {
  readonly additionalOrigins: string
  readonly redirectUris: string
}

export function oidcClientCorsOriginMatches(
  client: OidcClientCorsOriginSource,
  requestOrigin: string | undefined,
): boolean {
  const origin = oidcRequestOriginNormalize(requestOrigin)
  if (origin === undefined) return false

  const origins = new Set<string>()
  const redirectUris = oidcStringArrayParse(client.redirectUris)
  if (redirectUris === undefined) return false
  for (const redirectUri of redirectUris) {
    const validated = oidcRedirectUriValidate(redirectUri)
    if (!validated.success) return false
    try {
      const parsed = new URL(validated.data)
      if (parsed.origin !== "null") origins.add(parsed.origin)
    } catch (_error) {
      return false
    }
  }

  const additionalOrigins = oidcStringArrayParse(client.additionalOrigins)
  if (additionalOrigins === undefined) return false
  for (const additionalOrigin of additionalOrigins) {
    const validated = oidcOriginValidate(additionalOrigin)
    if (!validated.success) return false
    origins.add(validated.data)
  }
  return origins.has(origin)
}

function oidcRequestOriginNormalize(requestOrigin: string | undefined): string | undefined {
  if (requestOrigin === undefined || requestOrigin === "null") return undefined
  try {
    const parsed = new URL(requestOrigin)
    if (
      parsed.origin === "null" ||
      parsed.origin !== requestOrigin ||
      parsed.username.length > 0 ||
      parsed.password.length > 0 ||
      parsed.pathname !== "/" ||
      parsed.search.length > 0 ||
      parsed.hash.length > 0
    )
      return undefined
    return parsed.origin
  } catch (_error) {
    return undefined
  }
}

function oidcStringArrayParse(value: string): string[] | undefined {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string")
      ? parsed
      : undefined
  } catch (_error) {
    return undefined
  }
}
