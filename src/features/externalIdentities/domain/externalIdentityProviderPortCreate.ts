import { createPublicKey, verify } from "node:crypto"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type {
  ExternalIdentityProviderPort,
  ExternalIdentityProviderPortCallbackInput,
  ExternalIdentityProviderPortConfiguration,
  ExternalIdentityProviderPorts,
} from "./externalIdentityProviderPort.js"
import type { ExternalIdentityProviderIdentity } from "./externalIdentityProviderIdentity.js"
import type { ExternalIdentityProviderType } from "../public/externalIdentityProviderTypeSchema.js"

type ExternalIdentityProviderPortCreateOptions = {
  readonly fetch?: typeof fetch
  readonly timeoutMs?: number
}

export function externalIdentityProviderPortCreate(
  options: ExternalIdentityProviderPortCreateOptions = {},
): ExternalIdentityProviderPorts {
  const fetcher = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? 10_000
  return {
    github: externalIdentityProviderPortCreateFor("github", fetcher, timeoutMs),
    google: externalIdentityProviderPortCreateFor("google", fetcher, timeoutMs),
    microsoft: externalIdentityProviderPortCreateFor("microsoft", fetcher, timeoutMs),
  }
}

function externalIdentityProviderPortCreateFor(
  type: ExternalIdentityProviderType,
  fetcher: typeof fetch,
  timeoutMs: number,
): ExternalIdentityProviderPort {
  return {
    authorizationUrlCreate(configuration, input) {
      const endpoint = authorizationEndpointGet(type)
      const query = new URLSearchParams({
        client_id: configuration.clientId,
        code_challenge: input.pkceChallenge,
        code_challenge_method: "S256",
        redirect_uri: configuration.redirectUri,
        response_type: "code",
        scope: configuration.scopes.join(" "),
        state: input.state,
      })
      if (type !== "github" && input.nonce !== undefined) query.set("nonce", input.nonce)
      return resultCreate(`${endpoint}?${query.toString()}`)
    },
    async callbackExchange(configuration, input) {
      const token = await providerTokenFetch(fetcher, timeoutMs, configuration, input)
      if (!token.success) return token
      if (type === "google")
        return googleIdentityFetch(
          fetcher,
          timeoutMs,
          token.data.accessToken,
          token.data.idToken,
          input.nonce,
          configuration.clientId,
        )
      if (type === "microsoft")
        return microsoftIdentityCreate(fetcher, timeoutMs, token.data.idToken, input.nonce, configuration.clientId)
      return githubIdentityFetch(fetcher, timeoutMs, token.data.accessToken)
    },
  }
}

type ProviderToken = { readonly accessToken: string; readonly idToken?: string }

async function providerTokenFetch(
  fetcher: typeof fetch,
  timeoutMs: number,
  configuration: ExternalIdentityProviderPortConfiguration,
  input: ExternalIdentityProviderPortCallbackInput,
): Promise<ReturnType<typeof resultCreate<ProviderToken>> | ReturnType<typeof resultErrorCreate>> {
  const body = new URLSearchParams({
    client_id: configuration.clientId,
    client_secret: configuration.clientSecret,
    code: input.code,
    code_verifier: input.pkceVerifier,
    grant_type: "authorization_code",
    redirect_uri: configuration.redirectUri,
  })
  try {
    const response = await fetcher(tokenEndpointGet(configuration.type), {
      body,
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
    })
    const raw = (await response.json().catch(() => undefined)) as unknown
    if (!response.ok || typeof raw !== "object" || raw === null)
      return resultErrorCreate(
        "externalIdentityProviderCallback",
        "The external provider token response is invalid.",
        "external-identities.invalid",
      )
    const accessToken = providerStringGet(raw, "access_token")
    const idToken = providerStringGet(raw, "id_token")
    if (accessToken === null)
      return resultErrorCreate(
        "externalIdentityProviderCallback",
        "The external provider token response is invalid.",
        "external-identities.invalid",
      )
    if ((configuration.type === "google" || configuration.type === "microsoft") && idToken === null)
      return resultErrorCreate(
        "externalIdentityProviderCallback",
        "The external provider identity response is invalid.",
        "external-identities.invalid",
      )
    return resultCreate({ accessToken, ...(idToken === null ? {} : { idToken }) })
  } catch (_error) {
    return resultErrorCreate(
      "externalIdentityProviderCallback",
      "The external provider could not be reached.",
      "external-identities.read-failed",
    )
  }
}

async function googleIdentityFetch(
  fetcher: typeof fetch,
  timeoutMs: number,
  accessToken: string,
  idToken: string | undefined,
  expectedNonce: string | undefined,
  clientId: string,
): Promise<ReturnType<typeof resultCreate<ExternalIdentityProviderIdentity>> | ReturnType<typeof resultErrorCreate>> {
  if (idToken === undefined)
    return resultErrorCreate(
      "externalIdentityProviderCallback",
      "The external provider identity response is invalid.",
      "external-identities.invalid",
    )
  const tokenClaims = await providerJwtClaimsVerify(
    fetcher,
    timeoutMs,
    "https://www.googleapis.com/oauth2/v3/certs",
    idToken,
  )
  if (!tokenClaims.success) return tokenClaims
  const userInfo = await providerClaimsGet(fetcher, timeoutMs, "google", accessToken)
  if (!userInfo.success) return userInfo
  const subject = providerStringGet(tokenClaims.data, "sub")
  const issuer = providerStringGet(tokenClaims.data, "iss")
  const audience = providerStringGet(tokenClaims.data, "aud")
  const nonce = providerStringGet(tokenClaims.data, "nonce")
  const userInfoSubject = providerStringGet(userInfo.data, "sub")
  if (
    subject === null ||
    issuer !== "https://accounts.google.com" ||
    audience !== clientId ||
    nonce !== expectedNonce ||
    (userInfoSubject !== null && userInfoSubject !== subject)
  )
    return resultErrorCreate(
      "externalIdentityProviderCallback",
      "The external provider identity response is invalid.",
      "external-identities.invalid",
    )
  return resultCreate({
    displayName: providerStringGet(userInfo.data, "name") ?? providerStringGet(tokenClaims.data, "name") ?? undefined,
    email: providerStringGet(userInfo.data, "email") ?? providerStringGet(tokenClaims.data, "email") ?? undefined,
    emailVerified:
      providerBooleanGet(userInfo.data, "email_verified") || providerBooleanGet(tokenClaims.data, "email_verified"),
    externalSubject: subject,
    issuer,
    nonce,
    providerType: "google",
    username: providerStringGet(userInfo.data, "preferred_username") ?? undefined,
  })
}

async function githubIdentityFetch(
  fetcher: typeof fetch,
  timeoutMs: number,
  accessToken: string,
): Promise<ReturnType<typeof resultCreate<ExternalIdentityProviderIdentity>> | ReturnType<typeof resultErrorCreate>> {
  try {
    const response = await fetcher("https://api.github.com/user", {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${accessToken}`,
        "user-agent": "authworks",
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const raw = (await response.json().catch(() => undefined)) as unknown
    if (!response.ok || typeof raw !== "object" || raw === null) throw new Error("invalid user")
    const subject = providerStringGet(raw, "id")
    if (subject === null) throw new Error("invalid subject")
    let email = providerStringGet(raw, "email")
    let emailVerified = false
    if (email === null) {
      const emailsResponse = await fetcher("https://api.github.com/user/emails", {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${accessToken}`,
          "user-agent": "authworks",
        },
        signal: AbortSignal.timeout(timeoutMs),
      })
      const emails = (await emailsResponse.json().catch(() => undefined)) as unknown
      if (emailsResponse.ok && Array.isArray(emails)) {
        const primary = emails.find(
          (candidate) =>
            typeof candidate === "object" && candidate !== null && providerBooleanGet(candidate, "primary"),
        )
        if (primary !== undefined && typeof primary === "object" && primary !== null) {
          email = providerStringGet(primary, "email")
          emailVerified = providerBooleanGet(primary, "verified")
        }
      }
    }
    return resultCreate({
      displayName: providerStringGet(raw, "name") ?? undefined,
      ...(email === null ? {} : { email }),
      emailVerified,
      externalSubject: subject,
      providerType: "github",
      username: providerStringGet(raw, "login") ?? undefined,
    })
  } catch (_error) {
    return resultErrorCreate(
      "externalIdentityProviderCallback",
      "The external provider identity response is invalid.",
      "external-identities.invalid",
    )
  }
}

async function microsoftIdentityCreate(
  fetcher: typeof fetch,
  timeoutMs: number,
  idToken: string | undefined,
  expectedNonce: string | undefined,
  clientId: string,
): Promise<ReturnType<typeof resultCreate<ExternalIdentityProviderIdentity>> | ReturnType<typeof resultErrorCreate>> {
  if (idToken === undefined)
    return resultErrorCreate(
      "externalIdentityProviderCallback",
      "The external provider identity response is invalid.",
      "external-identities.invalid",
    )
  const claims = await providerJwtClaimsVerify(
    fetcher,
    timeoutMs,
    "https://login.microsoftonline.com/common/discovery/v2.0/keys",
    idToken,
  )
  if (!claims.success) return claims
  const subject = providerStringGet(claims.data, "sub")
  const issuer = providerStringGet(claims.data, "iss")
  const audience = providerStringGet(claims.data, "aud")
  const nonce = providerStringGet(claims.data, "nonce")
  if (
    subject === null ||
    issuer === null ||
    !issuer.startsWith("https://login.microsoftonline.com/") ||
    audience !== clientId ||
    nonce !== expectedNonce
  )
    return resultErrorCreate(
      "externalIdentityProviderCallback",
      "The external provider identity response is invalid.",
      "external-identities.invalid",
    )
  return resultCreate({
    displayName: providerStringGet(claims.data, "name") ?? undefined,
    email: providerStringGet(claims.data, "email") ?? providerStringGet(claims.data, "preferred_username") ?? undefined,
    emailVerified: true,
    externalSubject: subject,
    issuer,
    nonce,
    providerType: "microsoft",
    username: providerStringGet(claims.data, "preferred_username") ?? undefined,
  })
}

async function providerClaimsGet(
  fetcher: typeof fetch,
  timeoutMs: number,
  type: "google",
  accessToken: string,
): Promise<ReturnType<typeof resultCreate<Record<string, unknown>>> | ReturnType<typeof resultErrorCreate>> {
  try {
    const response = await fetcher("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { accept: "application/json", authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const raw = (await response.json().catch(() => undefined)) as unknown
    if (!response.ok || typeof raw !== "object" || raw === null)
      return resultErrorCreate(
        "externalIdentityProviderCallback",
        "The external provider identity response is invalid.",
        "external-identities.invalid",
      )
    return resultCreate(raw as Record<string, unknown>)
  } catch (_error) {
    return resultErrorCreate(
      "externalIdentityProviderCallback",
      `The ${type} provider could not be reached.`,
      "external-identities.read-failed",
    )
  }
}

async function providerJwtClaimsVerify(
  fetcher: typeof fetch,
  timeoutMs: number,
  jwksEndpoint: string,
  token: string,
): Promise<ReturnType<typeof resultCreate<Record<string, unknown>>> | ReturnType<typeof resultErrorCreate>> {
  try {
    const parts = token.split(".")
    if (parts.length !== 3 || parts[0] === undefined || parts[1] === undefined || parts[2] === undefined)
      throw new Error("invalid jwt")
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0]))) as unknown
    if (typeof header !== "object" || header === null || Array.isArray(header)) throw new Error("invalid header")
    if ((header as Record<string, unknown>).alg !== "RS256") throw new Error("unsupported jwt algorithm")
    const keyId = (header as Record<string, unknown>).kid
    if (typeof keyId !== "string" || keyId.length === 0) throw new Error("missing key id")
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]))) as unknown
    if (typeof claims !== "object" || claims === null || Array.isArray(claims)) throw new Error("invalid claims")
    const expiration = (claims as Record<string, unknown>).exp
    if (typeof expiration !== "number" || !Number.isFinite(expiration) || expiration <= Math.floor(Date.now() / 1_000))
      throw new Error("expired jwt")
    const keysResponse = await fetcher(jwksEndpoint, { signal: AbortSignal.timeout(timeoutMs) })
    const keys = (await keysResponse.json().catch(() => undefined)) as unknown
    if (
      !keysResponse.ok ||
      typeof keys !== "object" ||
      keys === null ||
      !Array.isArray((keys as Record<string, unknown>).keys)
    )
      throw new Error("invalid jwks")
    const jwk = (keys as { keys: unknown[] }).keys.find(
      (candidate) =>
        typeof candidate === "object" && candidate !== null && (candidate as Record<string, unknown>).kid === keyId,
    )
    if (typeof jwk !== "object" || jwk === null || Array.isArray(jwk)) throw new Error("missing jwk")
    const signature = base64UrlDecode(parts[2])
    const publicKey = createPublicKey({ format: "jwk", key: jwk as never })
    if (!verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, signature))
      throw new Error("invalid signature")
    return resultCreate(claims as Record<string, unknown>)
  } catch (_error) {
    return resultErrorCreate(
      "externalIdentityProviderCallback",
      "The external provider identity response is invalid.",
      "external-identities.invalid",
    )
  }
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=")
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function providerStringGet(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  const candidate = (value as Record<string, unknown>)[key]
  return typeof candidate === "string" || typeof candidate === "number" ? String(candidate) : null
}

function providerBooleanGet(value: unknown, key: string): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  return (value as Record<string, unknown>)[key] === true
}

function authorizationEndpointGet(type: ExternalIdentityProviderType): string {
  if (type === "google") return "https://accounts.google.com/o/oauth2/v2/auth"
  if (type === "microsoft") return "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
  return "https://github.com/login/oauth/authorize"
}

function tokenEndpointGet(type: ExternalIdentityProviderType): string {
  if (type === "google") return "https://oauth2.googleapis.com/token"
  if (type === "microsoft") return "https://login.microsoftonline.com/common/oauth2/v2.0/token"
  return "https://github.com/login/oauth/access_token"
}
