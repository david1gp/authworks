import { createPublicKey, verify } from "node:crypto"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ExternalIdentityProviderType } from "../public/externalIdentityProviderTypeSchema.js"
import type { ExternalIdentityProviderIdentity } from "./externalIdentityProviderIdentity.js"
import { externalIdentityOidcIssuerValidate } from "./externalIdentityOidcIssuerValidate.js"
import type {
  ExternalIdentityProviderPort,
  ExternalIdentityProviderPortCallbackInput,
  ExternalIdentityProviderPortConfiguration,
  ExternalIdentityProviderPorts,
} from "./externalIdentityProviderPort.js"

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
    oidc: externalIdentityOidcPortCreate(fetcher, timeoutMs),
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
      // Ask the provider for its account chooser so linking is not silently bound to
      // whichever account happens to be signed in (GitHub, Google, and Microsoft all
      // honor prompt=select_account).
      if (input.prompt !== undefined) query.set("prompt", input.prompt)
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
  // GitHub documents only client_id, client_secret, code, redirect_uri, and code_verifier
  // for the web authorization-code exchange (no grant_type); Google and Microsoft require
  // grant_type=authorization_code.
  const body = new URLSearchParams({
    client_id: configuration.clientId,
    client_secret: configuration.clientSecret,
    code: input.code,
    code_verifier: input.pkceVerifier,
    redirect_uri: configuration.redirectUri,
    ...(configuration.type === "github" ? {} : { grant_type: "authorization_code" }),
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
  const picture = providerPictureGet(userInfo.data, "picture") ?? providerPictureGet(tokenClaims.data, "picture")
  return resultCreate({
    displayName: providerStringGet(userInfo.data, "name") ?? providerStringGet(tokenClaims.data, "name") ?? undefined,
    email: providerStringGet(userInfo.data, "email") ?? providerStringGet(tokenClaims.data, "email") ?? undefined,
    emailVerified:
      providerBooleanGet(userInfo.data, "email_verified") || providerBooleanGet(tokenClaims.data, "email_verified"),
    externalSubject: subject,
    issuer,
    nonce,
    ...(picture === undefined ? {} : { picture }),
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
      const verified = emails.find(
        (candidate) =>
          typeof candidate === "object" &&
          candidate !== null &&
          providerStringGet(candidate, "email") !== null &&
          providerBooleanGet(candidate, "verified"),
      )
      const primary = emails.find(
        (candidate) => typeof candidate === "object" && candidate !== null && providerBooleanGet(candidate, "primary"),
      )
      const selected = verified ?? primary
      if (selected !== undefined && typeof selected === "object" && selected !== null) {
        email = providerStringGet(selected, "email") ?? email
        emailVerified = providerBooleanGet(selected, "verified")
      }
    }
    const picture = providerPictureGet(raw, "avatar_url")
    return resultCreate({
      displayName: providerStringGet(raw, "name") ?? undefined,
      ...(email === null ? {} : { email }),
      emailVerified,
      externalSubject: subject,
      ...(picture === undefined ? {} : { picture }),
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

function providerPictureGet(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined
  const candidate = (value as Record<string, unknown>)[key]
  return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined
}

type ExternalIdentityOidcDiscovery = {
  readonly authorizationEndpoint: string
  readonly issuer: string
  readonly jwksUri: string
  readonly tokenEndpoint: string
  readonly userinfoEndpoint?: string
}

const externalIdentityOidcDiscoveryCache = new Map<
  string,
  { readonly discovery: ExternalIdentityOidcDiscovery; readonly expiresAt: number }
>()

const externalIdentityOidcDiscoveryTtlMs = 5 * 60 * 1_000

function externalIdentityOidcPortCreate(fetcher: typeof fetch, timeoutMs: number): ExternalIdentityProviderPort {
  return {
    authorizationUrlCreate() {
      return resultErrorCreate(
        "externalIdentityProviderStart",
        "The external provider discovery has not completed.",
        "external-identities.read-failed",
      )
    },
    async authorizationUrlCreateAsync(configuration, input) {
      const op = "externalIdentityProviderStart"
      const issuer = externalIdentityOidcIssuerValidate(configuration.issuer)
      if (!issuer.success) return issuer
      const discovery = await externalIdentityOidcDiscoveryGet(fetcher, timeoutMs, issuer.data)
      if (!discovery.success) return discovery
      const query = new URLSearchParams({
        client_id: configuration.clientId,
        code_challenge: input.pkceChallenge,
        code_challenge_method: "S256",
        redirect_uri: configuration.redirectUri,
        response_type: "code",
        scope: configuration.scopes.join(" "),
        state: input.state,
      })
      if (input.prompt !== undefined) query.set("prompt", input.prompt)
      if (input.nonce !== undefined) query.set("nonce", input.nonce)
      return resultCreate(`${discovery.data.authorizationEndpoint}?${query.toString()}`)
    },
    async callbackExchange(configuration, input) {
      const issuer = externalIdentityOidcIssuerValidate(configuration.issuer)
      if (!issuer.success)
        return resultErrorCreate(
          "externalIdentityProviderCallback",
          "The external provider identity response is invalid.",
          "external-identities.invalid",
        )
      const discovery = await externalIdentityOidcDiscoveryGet(fetcher, timeoutMs, issuer.data)
      if (!discovery.success) return discovery
      const token = await externalIdentityOidcTokenFetch(
        fetcher,
        timeoutMs,
        discovery.data.tokenEndpoint,
        configuration,
        input,
      )
      if (!token.success) return token
      if (token.data.idToken === undefined)
        return resultErrorCreate(
          "externalIdentityProviderCallback",
          "The external provider identity response is invalid.",
          "external-identities.invalid",
        )
      const claims = await providerJwtClaimsVerify(fetcher, timeoutMs, discovery.data.jwksUri, token.data.idToken)
      if (!claims.success) return claims
      const subject = providerStringGet(claims.data, "sub")
      const tokenIssuer = providerStringGet(claims.data, "iss")
      const nonce = providerStringGet(claims.data, "nonce")
      if (
        subject === null ||
        tokenIssuer !== issuer.data ||
        !externalIdentityOidcAudienceMatches(claims.data, configuration.clientId) ||
        nonce !== input.nonce
      )
        return resultErrorCreate(
          "externalIdentityProviderCallback",
          "The external provider identity response is invalid.",
          "external-identities.invalid",
        )
      const userinfo = await externalIdentityOidcUserinfoGet(
        fetcher,
        timeoutMs,
        discovery.data.userinfoEndpoint,
        token.data.accessToken,
      )
      const profile = userinfo ?? {}
      const email = providerStringGet(profile, "email") ?? providerStringGet(claims.data, "email") ?? undefined
      const emailVerified =
        providerBooleanGet(profile, "email_verified") || providerBooleanGet(claims.data, "email_verified")
      const displayName =
        providerStringGet(profile, "name") ??
        providerStringGet(claims.data, "name") ??
        externalIdentityOidcDisplayNameGet({ ...claims.data, ...profile }) ??
        undefined
      const picture = providerPictureGet(profile, "picture") ?? providerPictureGet(claims.data, "picture") ?? undefined
      return resultCreate({
        ...(displayName === undefined ? {} : { displayName }),
        ...(email === undefined ? {} : { email }),
        emailVerified,
        externalSubject: subject,
        issuer: issuer.data,
        ...(nonce === null ? {} : { nonce }),
        ...(picture === undefined ? {} : { picture }),
        providerType: "oidc",
        username:
          providerStringGet(profile, "preferred_username") ??
          providerStringGet(claims.data, "preferred_username") ??
          undefined,
      })
    },
  }
}

async function externalIdentityOidcDiscoveryGet(
  fetcher: typeof fetch,
  timeoutMs: number,
  issuer: string,
): Promise<ReturnType<typeof resultCreate<ExternalIdentityOidcDiscovery>> | ReturnType<typeof resultErrorCreate>> {
  const op = "externalIdentityProviderStart"
  const cached = externalIdentityOidcDiscoveryCache.get(issuer)
  if (cached !== undefined && cached.expiresAt > Date.now()) return resultCreate(cached.discovery)
  let raw: unknown
  try {
    const response = await fetcher(`${issuer}/.well-known/openid-configuration`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    })
    raw = await response.json().catch(() => undefined)
    if (!response.ok || typeof raw !== "object" || raw === null) throw new Error("invalid discovery")
  } catch (_error) {
    return resultErrorCreate(op, "The external provider could not be reached.", "external-identities.read-failed")
  }
  const document = raw as Record<string, unknown>
  const documentIssuer =
    typeof document.issuer === "string" ? externalIdentityOidcIssuerValidate(document.issuer) : null
  const authorizationEndpoint =
    typeof document.authorization_endpoint === "string" ? document.authorization_endpoint : null
  const tokenEndpoint = typeof document.token_endpoint === "string" ? document.token_endpoint : null
  const jwksUri = typeof document.jwks_uri === "string" ? document.jwks_uri : null
  const userinfoEndpoint =
    typeof document.userinfo_endpoint === "string" && document.userinfo_endpoint.length > 0
      ? document.userinfo_endpoint
      : undefined
  if (
    documentIssuer === null ||
    !documentIssuer.success ||
    documentIssuer.data !== issuer ||
    authorizationEndpoint === null ||
    tokenEndpoint === null ||
    jwksUri === null
  )
    return resultErrorCreate(
      "externalIdentityProviderCallback",
      "The external provider identity response is invalid.",
      "external-identities.invalid",
    )
  const discovery: ExternalIdentityOidcDiscovery = {
    authorizationEndpoint,
    issuer,
    jwksUri,
    tokenEndpoint,
    ...(userinfoEndpoint === undefined ? {} : { userinfoEndpoint }),
  }
  externalIdentityOidcDiscoveryCache.set(issuer, {
    discovery,
    expiresAt: Date.now() + externalIdentityOidcDiscoveryTtlMs,
  })
  return resultCreate(discovery)
}

async function externalIdentityOidcTokenFetch(
  fetcher: typeof fetch,
  timeoutMs: number,
  tokenEndpoint: string,
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
    const response = await fetcher(tokenEndpoint, {
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
    if (accessToken === null || idToken === null)
      return resultErrorCreate(
        "externalIdentityProviderCallback",
        "The external provider token response is invalid.",
        "external-identities.invalid",
      )
    return resultCreate({ accessToken, idToken })
  } catch (_error) {
    return resultErrorCreate(
      "externalIdentityProviderCallback",
      "The external provider could not be reached.",
      "external-identities.read-failed",
    )
  }
}

async function externalIdentityOidcUserinfoGet(
  fetcher: typeof fetch,
  timeoutMs: number,
  userinfoEndpoint: string | undefined,
  accessToken: string,
): Promise<Record<string, unknown> | null> {
  if (userinfoEndpoint === undefined) return null
  try {
    const response = await fetcher(userinfoEndpoint, {
      headers: { accept: "application/json", authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const raw = (await response.json().catch(() => undefined)) as unknown
    if (!response.ok || typeof raw !== "object" || raw === null) return null
    return raw as Record<string, unknown>
  } catch (_error) {
    return null
  }
}

function externalIdentityOidcAudienceMatches(claims: Record<string, unknown>, clientId: string): boolean {
  const audience = claims.aud
  if (typeof audience === "string") return audience === clientId
  if (Array.isArray(audience)) return audience.some((candidate) => candidate === clientId)
  return false
}

function externalIdentityOidcDisplayNameGet(claims: Record<string, unknown>): string | null {
  const given = typeof claims.given_name === "string" ? claims.given_name : null
  const family = typeof claims.family_name === "string" ? claims.family_name : null
  if (given === null && family === null) return null
  return [given, family].filter((part) => part !== null && part.length > 0).join(" ") || null
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
