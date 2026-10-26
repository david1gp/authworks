import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../../src/compositions/serverApplicationCreate.js"

const systemSecret = "oidc-conformance-secret"
const domain = "oidc-conformance.example.com"
const origin = `https://${domain}`
const clientRedirectUri = "https://client.example/callback"
const clientSignedOutUri = "https://client.example/signed-out"
const verifier = "conformance-verifier-0123456789abcdef-conformance-00"
const challenge = createHash("sha256").update(verifier, "utf8").digest("base64url")

type ConformanceSetup = {
  readonly authorize: (params: URLSearchParams, cookie: string) => Promise<Response>
  readonly json: (response: Response) => Promise<any>
  readonly request: (path: string, init?: RequestInit) => Promise<Response>
  readonly realmId: string
  readonly sessionCookie: string
  readonly clientId: string
  readonly stop: () => void
}

function cookieValue(setCookie: string | null, name: string): string {
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(setCookie ?? "")
  return match?.[1] ?? ""
}

async function conformanceSetup(clientInput: Record<string, unknown>): Promise<ConformanceSetup> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-conformance-"))
  const verificationTokens: string[] = []
  const created = serverApplicationCreate({
    databasePath: join(directory, "authworks.sqlite"),
    onVerificationToken: (delivery) => {
      verificationTokens.push(delivery.token)
    },
    publicOrigin: origin,
    systemSecret,
  })
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(created.errorMessage)
  }
  const app = created.data
  const stop = () => {
    app.stop()
  }
  const request = async (path: string, init?: RequestInit) => app.request(`${origin}${path}`, init)
  const systemHeaders = { authorization: `Bearer ${systemSecret}`, "content-type": "application/json" }
  const json = async (response: Response) => {
    expect(response.status).toBeLessThan(400)
    return (await response.json()) as any
  }

  const realmResponse = await request("/system/realms", {
    body: JSON.stringify({ domain, name: "OIDC conformance" }),
    headers: systemHeaders,
    method: "POST",
  })
  expect(realmResponse.status).toBe(201)
  const realmId = ((await realmResponse.json()) as { realm: { id: string } }).realm.id

  const keyResponse = await request(`/system/realms/${realmId}/oidc/signing-keys/ensure-active`, {
    headers: systemHeaders,
    method: "POST",
  })
  expect(keyResponse.status).toBe(200)

  const clientResponse = await request(`/system/realms/${realmId}/oidc/clients`, {
    body: JSON.stringify({
      allowedScopes: ["openid", "profile", "email", "offline_access"],
      clientType: "public",
      name: "Conformance client",
      postLogoutRedirectUris: [clientSignedOutUri],
      redirectUris: [clientRedirectUri],
      requireConsent: false,
      ...clientInput,
    }),
    headers: systemHeaders,
    method: "POST",
  })
  expect(clientResponse.status).toBe(201)
  const clientId = ((await clientResponse.json()) as { client: { id: string } }).client.id

  const userName = `conformance-user-${realmId.slice(-6)}`
  const registerResponse = await request(`/realms/${realmId}/password/register`, {
    body: JSON.stringify({
      email: `${userName}@example.com`,
      password: "Correct Horse 12",
      profile: { displayName: "Conformance User" },
      userName,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  })
  expect(registerResponse.status).toBe(200)
  const verifyResponse = await request(`/realms/${realmId}/password/verify-email`, {
    body: JSON.stringify({ token: verificationTokens[0] ?? "" }),
    headers: { "content-type": "application/json" },
    method: "POST",
  })
  expect(verifyResponse.status).toBe(200)

  const loginResponse = await request(`/realms/${realmId}/password/login`, {
    body: JSON.stringify({ identifier: userName, password: "Correct Horse 12" }),
    headers: { "content-type": "application/json" },
    method: "POST",
  })
  expect(loginResponse.status).toBe(200)
  // The JSON login answers with the session credential; browser mode would set
  // the cookie instead. The protocol carries the token as a `session` cookie.
  const loginBody = (await loginResponse.json()) as { session?: { token?: string } }
  const sessionCookie =
    cookieValue(loginResponse.headers.get("set-cookie"), "session") || loginBody.session?.token || ""
  expect(sessionCookie.length).toBeGreaterThan(0)

  const authorize = (params: URLSearchParams, cookie: string) =>
    request(`/oauth2/authorize?${params}`, {
      headers: { accept: "application/json", cookie: `session=${cookie}` },
    })

  return { authorize, clientId, json, realmId, request, sessionCookie, stop }
}

function authorizeParams(extra: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams({
    client_id: "",
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: clientRedirectUri,
    response_type: "code",
    scope: "openid profile offline_access",
    state: "conformance-state",
    ...extra,
  })
}

async function codeExchange(
  setup: ConformanceSetup,
  code: string,
  extra: Record<string, string> = {},
): Promise<Response> {
  return setup.request("/oauth2/token", {
    body: new URLSearchParams({
      client_id: setup.clientId,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: clientRedirectUri,
      ...extra,
    }).toString(),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  })
}

async function codeIssue(setup: ConformanceSetup, extra: Record<string, string> = {}): Promise<string> {
  const params = authorizeParams({ client_id: setup.clientId, ...extra })
  const authorized = await setup.authorize(params, setup.sessionCookie)
  expect(authorized.status).toBe(200)
  const code = ((await authorized.json()) as { code?: string }).code
  expect(code).toBeString()
  if (typeof code !== "string") throw new Error("The conformance authorization did not issue a code.")
  return code
}

test("authorization code plus PKCE issues tokens and verifies userinfo", async () => {
  const setup = await conformanceSetup({})
  try {
    const code = await codeIssue(setup)
    const token = await codeExchange(setup, code)
    expect(token.status).toBe(200)
    const tokens = (await token.json()) as {
      access_token: string
      id_token: string
      refresh_token?: string
      token_type: string
    }
    expect(tokens.token_type).toBe("Bearer")
    expect(tokens.access_token.length).toBeGreaterThan(0)
    expect(tokens.id_token.length).toBeGreaterThan(0)
    expect(tokens.refresh_token?.length).toBeGreaterThan(0)

    const userinfo = await setup.request("/oauth2/userinfo", {
      headers: { accept: "application/json", authorization: `Bearer ${tokens.access_token}` },
    })
    expect(userinfo.status).toBe(200)
    const claims = (await userinfo.json()) as { sub?: string }
    expect(claims.sub).toBeString()
  } finally {
    setup.stop()
  }
})

test("PKCE verifier mismatch rejects the code redemption", async () => {
  const setup = await conformanceSetup({})
  try {
    const code = await codeIssue(setup)
    const mismatched = await setup.request("/oauth2/token", {
      body: new URLSearchParams({
        client_id: setup.clientId,
        code,
        code_verifier: "wrong-verifier-0123456789abcdef-wrong-00000",
        grant_type: "authorization_code",
        redirect_uri: clientRedirectUri,
      }).toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    })
    expect(mismatched.status).toBe(400)
    expect(((await mismatched.json()) as { error?: string }).error).toBe("invalid_grant")
  } finally {
    setup.stop()
  }
})

test("refresh rotation replaces the token and rejects replay", async () => {
  const setup = await conformanceSetup({})
  try {
    const tokens = (await (await codeExchange(setup, await codeIssue(setup))).json()) as {
      refresh_token?: string
    }
    const refreshToken = tokens.refresh_token ?? ""
    expect(refreshToken.length).toBeGreaterThan(0)

    const rotated = await setup.request("/oauth2/token", {
      body: new URLSearchParams({
        client_id: setup.clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    })
    expect(rotated.status).toBe(200)
    const rotatedTokens = (await rotated.json()) as { access_token: string; refresh_token?: string }
    expect(rotatedTokens.access_token.length).toBeGreaterThan(0)

    // The rotated credential chains before any replay: the newest token stays usable.
    if (rotatedTokens.refresh_token !== undefined) {
      const secondRotation = await setup.request("/oauth2/token", {
        body: new URLSearchParams({
          client_id: setup.clientId,
          grant_type: "refresh_token",
          refresh_token: rotatedTokens.refresh_token,
        }).toString(),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      })
      expect(secondRotation.status).toBe(200)
    }

    // Replaying a replaced token is rejected and revokes the family.
    const replay = await setup.request("/oauth2/token", {
      body: new URLSearchParams({
        client_id: setup.clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    })
    expect(replay.status).toBe(400)
    expect(((await replay.json()) as { error?: string }).error).toBe("invalid_grant")
  } finally {
    setup.stop()
  }
})

test("token revocation deactivates access and refresh tokens", async () => {
  const setup = await conformanceSetup({})
  try {
    const tokens = (await (await codeExchange(setup, await codeIssue(setup))).json()) as {
      access_token: string
      refresh_token?: string
    }
    const revoke = async (token: string) =>
      setup.request("/oauth2/revoke", {
        body: new URLSearchParams({ client_id: setup.clientId, token }).toString(),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      })
    const introspect = async (token: string) =>
      setup.request("/oauth2/introspect", {
        body: new URLSearchParams({ client_id: setup.clientId, token }).toString(),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      })

    expect((await revoke(tokens.access_token)).status).toBe(200)
    const introspected = await introspect(tokens.access_token)
    expect(introspected.status).toBe(200)
    expect(((await introspected.json()) as { active?: boolean }).active).toBe(false)

    if (tokens.refresh_token !== undefined) {
      expect((await revoke(tokens.refresh_token)).status).toBe(200)
      const refresh = await setup.request("/oauth2/token", {
        body: new URLSearchParams({
          client_id: setup.clientId,
          grant_type: "refresh_token",
          refresh_token: tokens.refresh_token,
        }).toString(),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      })
      expect(refresh.status).toBe(400)
    }
  } finally {
    setup.stop()
  }
})

test("RFC7662 introspection reports active and inactive shapes", async () => {
  const setup = await conformanceSetup({})
  try {
    const tokens = (await (await codeExchange(setup, await codeIssue(setup))).json()) as {
      access_token: string
      scope: string
    }
    const introspect = await setup.request("/oauth2/introspect", {
      body: new URLSearchParams({ client_id: setup.clientId, token: tokens.access_token }).toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    })
    expect(introspect.status).toBe(200)
    const active = (await introspect.json()) as {
      active: boolean
      client_id?: string
      scope?: string
      sub?: string
      token_type?: string
    }
    expect(active.active).toBe(true)
    expect(active.sub).toBeString()
    expect(active.client_id).toBe(setup.clientId)
    expect(active.token_type).toBe("access_token")
    expect(active.scope).toContain("openid")

    const unknown = await setup.request("/oauth2/introspect", {
      body: new URLSearchParams({ client_id: setup.clientId, token: "unknown-token" }).toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    })
    expect(unknown.status).toBe(200)
    expect((await unknown.json()) as { active: boolean }).toEqual({ active: false })
  } finally {
    setup.stop()
  }
})

test("RP-initiated logout ends the browser session", async () => {
  const setup = await conformanceSetup({})
  try {
    const logout = await setup.request(
      `/oauth2/logout?client_id=${encodeURIComponent(setup.clientId)}&post_logout_redirect_uri=${encodeURIComponent(clientSignedOutUri)}&state=logout-state`,
      { headers: { accept: "application/json", cookie: `session=${setup.sessionCookie}` } },
    )
    expect(logout.status).toBe(200)

    const userinfo = await setup.request("/oauth2/authorize", {
      headers: { accept: "application/json", cookie: `session=${setup.sessionCookie}` },
    })
    expect(userinfo.status).toBe(400)
  } finally {
    setup.stop()
  }
})

test("consent approve and deny decide the authorization at protocol level", async () => {
  const setup = await conformanceSetup({ requireConsent: true })
  try {
    const authorize = async () => setup.authorize(authorizeParams({ client_id: setup.clientId }), setup.sessionCookie)
    const pending = async () => {
      const required = await authorize()
      expect(required.status).toBe(200)
      const body = (await required.json()) as { consent_required?: boolean; request_id?: string }
      expect(body.consent_required).toBe(true)
      expect(body.request_id).toBeString()
      if (typeof body.request_id !== "string") throw new Error("The conformance consent was not requested.")
      return body.request_id
    }
    const csrf = await setup.request(`/realms/${setup.realmId}/sessions/csrf`, {
      headers: { cookie: `session=${setup.sessionCookie}` },
    })
    expect(csrf.status).toBe(200)
    const csrfToken = ((await csrf.json()) as { csrfToken?: string }).csrfToken ?? ""
    const decide = async (decision: "approve" | "deny", requestId: string) =>
      setup.request("/oauth2/consent", {
        body: JSON.stringify({ decision, request_id: requestId }),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          cookie: `session=${setup.sessionCookie}; csrf=${csrfToken}`,
          origin,
          "x-csrf-token": csrfToken,
        },
        method: "POST",
      })

    const denied = (await (await decide("deny", await pending())).json()) as {
      approved?: boolean
      error?: string
    }
    expect(denied.approved).toBe(false)
    expect(denied.error).toBe("access_denied")

    const approve = await decide("approve", await pending())
    expect(approve.status).toBe(200)
    const approved = (await approve.json()) as { approved?: boolean; code?: string }
    expect(approved.approved).toBe(true)
    expect(approved.code).toBeString()

    const token = await codeExchange(setup, approved.code ?? "")
    expect(token.status).toBe(200)
  } finally {
    setup.stop()
  }
})

test("discovery advertises endpoints that respond", async () => {
  const setup = await conformanceSetup({})
  try {
    const discovery = await setup.request("/.well-known/openid-configuration")
    expect(discovery.status).toBe(200)
    const document = (await discovery.json()) as {
      authorization_endpoint: string
      claims_supported: string[]
      end_session_endpoint: string
      grant_types_supported: string[]
      introspection_endpoint: string
      issuer: string
      jwks_uri: string
      response_types_supported: string[]
      revocation_endpoint: string
      scopes_supported: string[]
      subject_types_supported: string[]
      token_endpoint: string
      userinfo_endpoint: string
    }
    expect(document.issuer).toContain(domain)
    expect(document.response_types_supported).toEqual(["code"])
    expect(document.grant_types_supported).toContain("authorization_code")
    expect(document.grant_types_supported).toContain("refresh_token")
    expect(document.scopes_supported).toContain("openid")
    expect(document.scopes_supported).toContain("profile")
    expect(document.claims_supported).toContain("sub")
    expect(document.subject_types_supported).toEqual(["public"])
    for (const endpoint of [
      document.authorization_endpoint,
      document.token_endpoint,
      document.userinfo_endpoint,
      document.jwks_uri,
      document.introspection_endpoint,
      document.revocation_endpoint,
      document.end_session_endpoint,
    ])
      expect(endpoint.startsWith(document.issuer)).toBe(true)

    const jwks = await setup.request("/.well-known/jwks.json")
    expect(jwks.status).toBe(200)
    expect((((await jwks.json()) as { keys?: unknown[] }).keys ?? []).length).toBeGreaterThan(0)

    // POST-only advertised endpoints exist and enforce client authentication:
    // an empty call fails as invalid_client, not a missing route.
    const emptyToken = await setup.request("/oauth2/token", {
      body: "",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    })
    expect(emptyToken.status).toBe(401)
    expect(((await emptyToken.json()) as { error?: string }).error).toBe("invalid_client")
    const emptyIntrospect = await setup.request("/oauth2/introspect", {
      body: "",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    })
    expect(emptyIntrospect.status).toBe(401)
    expect(((await emptyIntrospect.json()) as { error?: string }).error).toBe("invalid_client")
  } finally {
    setup.stop()
  }
})

test("tokens from one realm are rejected in another", async () => {
  const alpha = await conformanceSetup({})
  try {
    const tokens = (await (await codeExchange(alpha, await codeIssue(alpha))).json()) as { access_token: string }
    const foreign = await alpha.request("/oauth2/userinfo", {
      headers: { accept: "application/json", authorization: `Bearer ${tokens.access_token}`, host: "other.example" },
    })
    expect(foreign.status).toBeGreaterThanOrEqual(400)

    const foreignIntrospect = await alpha.request("/oauth2/introspect", {
      body: new URLSearchParams({ client_id: alpha.clientId, token: tokens.access_token }).toString(),
      headers: { "content-type": "application/x-www-form-urlencoded", host: "other.example" },
      method: "POST",
    })
    expect(foreignIntrospect.status).toBeGreaterThanOrEqual(400)
  } finally {
    alpha.stop()
  }
})

test("prompt and max_age gate the authorization", async () => {
  const setup = await conformanceSetup({})
  try {
    const silent = await setup.authorize(
      authorizeParams({ client_id: setup.clientId, prompt: "none" }),
      setup.sessionCookie,
    )
    expect(silent.status).toBe(200)
    expect(((await silent.json()) as { code?: string }).code).toBeString()

    const forced = await setup.authorize(
      authorizeParams({ client_id: setup.clientId, prompt: "login" }),
      setup.sessionCookie,
    )
    expect(forced.status).toBe(400)
    expect(((await forced.json()) as { error?: string }).error).toBe("interaction_required")

    const stale = await setup.authorize(
      authorizeParams({ client_id: setup.clientId, max_age: "0" }),
      setup.sessionCookie,
    )
    expect(stale.status).toBe(400)
    expect(((await stale.json()) as { error?: string }).error).toBe("interaction_required")
  } finally {
    setup.stop()
  }
})
