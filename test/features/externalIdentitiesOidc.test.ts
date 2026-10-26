import { expect, test } from "bun:test"
import { createSign, generateKeyPairSync } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { externalIdentityCallback } from "../../src/features/externalIdentities/actions/externalIdentityCallback.js"
import { externalIdentityLinkComplete } from "../../src/features/externalIdentities/actions/externalIdentityLinkComplete.js"
import { externalIdentityLinkStart } from "../../src/features/externalIdentities/actions/externalIdentityLinkStart.js"
import { externalIdentityProviderCreate } from "../../src/features/externalIdentities/actions/externalIdentityProviderCreate.js"
import { externalIdentityProviderUpdate } from "../../src/features/externalIdentities/actions/externalIdentityProviderUpdate.js"
import { externalIdentityStart } from "../../src/features/externalIdentities/actions/externalIdentityStart.js"
import type { ExternalIdentityProviderPort } from "../../src/features/externalIdentities/domain/externalIdentityProviderPort.js"
import { externalIdentityProviderPortCreate } from "../../src/features/externalIdentities/domain/externalIdentityProviderPortCreate.js"
import type { ExternalIdentityProviderType } from "../../src/features/externalIdentities/public/externalIdentityProviderTypeSchema.js"
import { externalIdentityProviderTable } from "../../src/features/externalIdentities/persistence/externalIdentityProviderTable.js"
import { externalIdentityRepositoryCreate } from "../../src/features/externalIdentities/persistence/externalIdentityRepositoryCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationLoginPolicySet } from "../../src/features/organizations/actions/organizationLoginPolicySet.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-external-oidc-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data, testkit)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

let linkNonce = ""

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

function oidcTestKeysCreate() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const publicJwk = publicKey.export({ format: "jwk" })
  return { kid: "item13-key", privateKey, publicJwk: { ...publicJwk, kid: "item13-key", use: "sig" } }
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

function oidcTestIdTokenCreate(
  privateKey: ReturnType<typeof oidcTestKeysCreate>["privateKey"],
  kid: string,
  claims: Record<string, unknown>,
): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", kid, typ: "JWT" }))
  const payload = base64UrlEncode(JSON.stringify(claims))
  const signature = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(privateKey).toString("base64url")
  return `${header}.${payload}.${signature}`
}

function providerJsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status,
  })
}

type OidcStubWorld = {
  readonly fetch: typeof fetch
  readonly issuer: string
  readonly tokenEndpoint: string
}

function oidcStubWorldCreate(options: {
  readonly issuer: string
  readonly clientId?: string
  readonly discovery?: Record<string, unknown> | null
  readonly discoveryStatus?: number
  readonly idTokenForCode?: (code: string) => string | undefined
  readonly keys: ReturnType<typeof oidcTestKeysCreate>
  readonly userinfo?: Record<string, unknown> | null
}): OidcStubWorld {
  const clientId = options.clientId ?? "oidc-client"
  const tokenEndpoint = `${options.issuer}/token`
  const fetch = Object.assign(
    async (input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      if (url === `${options.issuer}/.well-known/openid-configuration`) {
        if (options.discovery === null || options.discovery === undefined)
          return providerJsonResponse({ error: "down" }, options.discoveryStatus ?? 500)
        return providerJsonResponse({
          authorization_endpoint: `${options.issuer}/authorize`,
          issuer: options.issuer,
          jwks_uri: `${options.issuer}/jwks`,
          token_endpoint: tokenEndpoint,
          userinfo_endpoint: `${options.issuer}/userinfo`,
          ...options.discovery,
        })
      }
      if (url === `${options.issuer}/jwks`) return providerJsonResponse({ keys: [options.keys.publicJwk] })
      if (url === `${options.issuer}/userinfo`) {
        if (options.userinfo === null || options.userinfo === undefined)
          return providerJsonResponse({ error: "down" }, 500)
        return providerJsonResponse(options.userinfo)
      }
      if (url === tokenEndpoint) {
        const rawBody =
          typeof _init?.body === "string"
            ? _init.body
            : _init?.body instanceof URLSearchParams
              ? _init.body.toString()
              : ""
        const body = new URLSearchParams(rawBody)
        const idToken = options.idTokenForCode?.(body.get("code") ?? "")
        if (idToken === undefined) return providerJsonResponse({ error: "bad code" }, 400)
        if (body.get("client_id") !== clientId || body.get("client_secret") === null)
          return providerJsonResponse({ error: "bad client" }, 401)
        return providerJsonResponse({ access_token: "oidc-access", id_token: idToken, token_type: "Bearer" })
      }
      throw new Error(`unexpected fetch ${url}`)
    },
    { preconnect: globalThis.fetch.preconnect },
  )
  return { fetch, issuer: options.issuer, tokenEndpoint }
}

function oidcClaimsCreate(
  issuer: string,
  clientId: string,
  subject: string,
  nonce: string | undefined,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    aud: clientId,
    email: `${subject}@example.com`,
    email_verified: true,
    exp: Math.floor(Date.now() / 1_000) + 600,
    family_name: "User",
    given_name: "Oidc",
    iss: issuer,
    name: "Oidc User",
    picture: "https://cdn.test/oidc.png",
    preferred_username: subject,
    sub: subject,
    ...(nonce === undefined ? {} : { nonce }),
    ...overrides,
  }
}

async function createOidcProvider(
  database: StorageDatabase,
  realmId: string,
  issuer: string,
  options: { readonly encryptionSecret?: string; readonly organizationId?: string } = {},
) {
  const created = externalIdentityProviderCreate({
    allowDevelopmentFallback: options.encryptionSecret === undefined,
    context: realmSystemContextCreate(),
    database,
    ...(options.encryptionSecret === undefined ? {} : { encryptionSecret: options.encryptionSecret }),
    input: {
      allowAccountCreation: true,
      clientId: "oidc-client",
      clientSecret: "oidc-secret",
      displayName: "Generic",
      issuer,
      ...(options.organizationId === undefined ? {} : { organizationId: options.organizationId }),
      redirectUri: "https://app.test/callback",
      type: "oidc",
    },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.provider
}

function autoLinkPortCreate(
  email: string,
  type: ExternalIdentityProviderType,
  emailVerified = true,
): ExternalIdentityProviderPort {
  return {
    authorizationUrlCreate(_configuration, input) {
      return resultCreate(`https://provider.test/authorize?state=${encodeURIComponent(input.state)}`)
    },
    callbackExchange(_configuration, input) {
      return Promise.resolve(
        resultCreate({
          displayName: "Linked User",
          email,
          emailVerified,
          externalSubject: `subject-${type}`,
          ...(input.nonce === undefined ? {} : { nonce: input.nonce }),
          providerType: type,
        }),
      )
    },
  }
}

async function verifiedUserCreate(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  realmId: string,
  email: string,
  userName: string,
) {
  const context = realmTenantContextCreate(realmId, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context,
    database,
    input: { email, password: "Correct Horse 12", profile: {}, userName },
    onVerificationToken: ({ token: verificationToken }) => {
      token = verificationToken
    },
    realmId,
    runtime: testkit.runtime,
  })
  expect(registered.success).toBe(true)
  if (!registered.success) throw new Error(registered.errorMessage)
  const verified = passwordEmailVerify({ context, database, input: { token }, realmId, runtime: testkit.runtime })
  expect(verified.success).toBe(true)
  if (!verified.success) throw new Error(verified.errorMessage)
  return verified.data.user
}

test("generic OIDC issuer is required for oidc and forbidden for built-ins", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "oidc-schema.example.com")
    const base = {
      allowAccountCreation: true,
      clientId: "client-id",
      clientSecret: "client-secret",
      displayName: "Provider",
      redirectUri: "https://app.test/callback",
    }
    expect(
      externalIdentityProviderCreate({
        allowDevelopmentFallback: true,
        context: realmSystemContextCreate(),
        database,
        input: { ...base, type: "oidc" },
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      externalIdentityProviderCreate({
        allowDevelopmentFallback: true,
        context: realmSystemContextCreate(),
        database,
        input: { ...base, issuer: "https://idp.test", type: "google" },
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      externalIdentityProviderCreate({
        allowDevelopmentFallback: true,
        context: realmSystemContextCreate(),
        database,
        input: { ...base, issuer: "http://idp.test", type: "oidc" },
        realmId: realm.id,
      }).success,
    ).toBe(false)
    const created = externalIdentityProviderCreate({
      allowDevelopmentFallback: true,
      context: realmSystemContextCreate(),
      database,
      input: { ...base, issuer: "https://idp.test/", type: "oidc" },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.provider.issuer).toBe("https://idp.test")
  })
})

test("generic OIDC completes a full login and link flow", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "oidc-login.example.com")
    const issuer = "https://oidc-login-item13.example.com"
    const provider = await createOidcProvider(database, realm.id, issuer)
    const keys = oidcTestKeysCreate()
    let loginNonce = ""
    const world = oidcStubWorldCreate({
      clientId: "oidc-client",
      discovery: {},
      idTokenForCode: (code) => {
        if (code !== "login-code" && code !== "link-code") return undefined
        const subject = code === "login-code" ? "oidc-subject-1" : "oidc-subject-2"
        return oidcTestIdTokenCreate(
          keys.privateKey,
          keys.kid,
          oidcClaimsCreate(issuer, "oidc-client", subject, code === "login-code" ? loginNonce : linkNonce, {
            email: `${subject}@example.com`,
          }),
        )
      },
      issuer,
      keys,
      userinfo: { email: "userinfo@example.com", email_verified: true, name: "Userinfo Name" },
    })
    const ports = externalIdentityProviderPortCreate({ fetch: world.fetch })
    const started = await externalIdentityStart({
      allowDevelopmentFallback: true,
      database,
      input: {},
      realmId: realm.id,
      providerId: provider.id,
      providerPorts: ports,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    expect(started.data.authorizationUrl.startsWith(`${issuer}/authorize?`)).toBe(true)
    loginNonce = new URL(started.data.authorizationUrl).searchParams.get("nonce") ?? ""
    expect(loginNonce.length).toBeGreaterThan(0)
    const state = new URL(started.data.authorizationUrl).searchParams.get("state") ?? ""
    const callback = await externalIdentityCallback({
      allowDevelopmentFallback: true,
      code: "login-code",
      database,
      realmId: realm.id,
      providerId: provider.id,
      providerPorts: ports,
      state,
      runtime: testkit.runtime,
    })
    expect(callback.success).toBe(true)
    if (!callback.success || callback.data.kind !== "authenticated") return
    // userinfo supplies the email/name fallback over the id_token claims.
    expect(callback.data.identity.email).toBe("userinfo@example.com")

    const linker = await verifiedUserCreate(database, testkit, realm.id, "linker@example.com", "linker")
    const login = passwordLogin({
      context: realmTenantContextCreate(realm.id, "anonymous"),
      database,
      input: { identifier: "linker", password: "Correct Horse 12" },
      realmId: realm.id,
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) return
    const linkStart = await externalIdentityLinkStart({
      allowDevelopmentFallback: true,
      database,
      input: {},
      realmId: realm.id,
      providerId: provider.id,
      providerPorts: ports,
      session: login.data.session.session,
      userId: linker.id,
      runtime: testkit.runtime,
    })
    expect(linkStart.success).toBe(true)
    if (!linkStart.success) return
    linkNonce = new URL(linkStart.data.authorizationUrl).searchParams.get("nonce") ?? ""
    const linkState = new URL(linkStart.data.authorizationUrl).searchParams.get("state") ?? ""
    const pending = await externalIdentityCallback({
      allowDevelopmentFallback: true,
      code: "link-code",
      database,
      realmId: realm.id,
      providerId: provider.id,
      providerPorts: ports,
      state: linkState,
      runtime: testkit.runtime,
    })
    expect(pending.success).toBe(true)
    if (!pending.success || pending.data.kind !== "link_confirmation") return
    expect(
      externalIdentityLinkComplete({
        database,
        input: { confirm: true, confirmationToken: pending.data.confirmationToken },
        realmId: realm.id,
        providerId: provider.id,
        session: login.data.session.session,
        userId: linker.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(true)
  })
})

test("generic OIDC rejects issuer mismatch and discovery outages with stable errors", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "oidc-mismatch.example.com")
    const mismatchKeys = oidcTestKeysCreate()
    const mismatchWorld = oidcStubWorldCreate({
      discovery: { issuer: "https://someone-else.example.com" },
      issuer: "https://oidc-mismatch-item13.example.com",
      keys: mismatchKeys,
    })
    const mismatchProvider = await createOidcProvider(database, realm.id, "https://oidc-mismatch-item13.example.com")
    const mismatchPorts = externalIdentityProviderPortCreate({ fetch: mismatchWorld.fetch })
    const mismatchStart = await externalIdentityStart({
      allowDevelopmentFallback: true,
      database,
      input: {},
      realmId: realm.id,
      providerId: mismatchProvider.id,
      providerPorts: mismatchPorts,
      runtime: testkit.runtime,
    })
    expect(mismatchStart.success).toBe(false)
    if (mismatchStart.success) return
    expect(mismatchStart.code).toBe("external-identities.invalid")

    const downProvider = await createOidcProvider(database, realm.id, "https://oidc-down-item13.example.com")
    const downWorld = oidcStubWorldCreate({
      discovery: null,
      issuer: "https://oidc-down-item13.example.com",
      keys: oidcTestKeysCreate(),
    })
    const downPorts = externalIdentityProviderPortCreate({ fetch: downWorld.fetch })
    const downStart = await externalIdentityStart({
      allowDevelopmentFallback: true,
      database,
      input: {},
      realmId: realm.id,
      providerId: downProvider.id,
      providerPorts: downPorts,
      runtime: testkit.runtime,
    })
    expect(downStart).toMatchObject({ code: "external-identities.read-failed", success: false })
  })
})

test("two generic OIDC providers coexist per org while built-ins stay single", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "oidc-multi.example.com")
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Multi IdP org" },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const organizationId = organization.data.organization.id
    const first = await createOidcProvider(database, realm.id, "https://idp-one-item13.example.com", {
      organizationId,
    })
    expect(first.issuer).toBe("https://idp-one-item13.example.com")
    const second = await createOidcProvider(database, realm.id, "https://idp-two-item13.example.com", {
      organizationId,
    })
    expect(second.id).not.toBe(first.id)
    expect(
      externalIdentityProviderCreate({
        allowDevelopmentFallback: true,
        context: realmSystemContextCreate(),
        database,
        input: {
          allowAccountCreation: true,
          clientId: "other",
          clientSecret: "other",
          displayName: "Dupe",
          issuer: "https://idp-one-item13.example.com",
          organizationId,
          redirectUri: "https://app.test/callback",
          type: "oidc",
        },
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "external-identities.already-exists", success: false })
    const google = externalIdentityProviderCreate({
      allowDevelopmentFallback: true,
      context: realmSystemContextCreate(),
      database,
      input: {
        allowAccountCreation: true,
        clientId: "google-id",
        clientSecret: "google-secret",
        displayName: "Google",
        organizationId,
        redirectUri: "https://app.test/callback",
        type: "google",
      },
      realmId: realm.id,
    })
    expect(google.success).toBe(true)
    expect(
      externalIdentityProviderCreate({
        allowDevelopmentFallback: true,
        context: realmSystemContextCreate(),
        database,
        input: {
          allowAccountCreation: true,
          clientId: "google-id-2",
          clientSecret: "google-secret-2",
          displayName: "Google 2",
          organizationId,
          redirectUri: "https://app.test/callback",
          type: "google",
        },
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "external-identities.already-exists", success: false })
  })
})

test("all four provider types auto-link on a verified email, microsoft included", async () => {
  const types: readonly ExternalIdentityProviderType[] = ["google", "github", "microsoft", "oidc"]
  for (const type of types) {
    await withDatabase(async (database, testkit) => {
      const realm = await createRealm(database, `autolink-${type}.example.com`)
      const email = `autolink-${type}@example.com`
      const user = await verifiedUserCreate(database, testkit, realm.id, email, `autolink-${type}`)
      const created =
        type === "oidc"
          ? await createOidcProvider(database, realm.id, `https://${type}-autolink-item13.example.com`)
          : (() => {
              const result = externalIdentityProviderCreate({
                allowDevelopmentFallback: true,
                context: realmSystemContextCreate(),
                database,
                input: {
                  allowAccountCreation: true,
                  clientId: "client-id",
                  clientSecret: "client-secret",
                  displayName: type,
                  redirectUri: "https://app.test/callback",
                  type,
                },
                realmId: realm.id,
              })
              expect(result.success).toBe(true)
              if (!result.success) throw new Error(result.errorMessage)
              return result.data.provider
            })()
      const ports = { [type]: autoLinkPortCreate(email, type) } as Parameters<
        typeof externalIdentityStart
      >[0]["providerPorts"]
      const started = await externalIdentityStart({
        allowDevelopmentFallback: true,
        database,
        input: {},
        realmId: realm.id,
        providerId: created.id,
        providerPorts: ports,
        runtime: testkit.runtime,
      })
      expect(started.success).toBe(true)
      if (!started.success) return
      const state = new URL(started.data.authorizationUrl).searchParams.get("state") ?? ""
      const callback = await externalIdentityCallback({
        allowDevelopmentFallback: true,
        code: "code",
        database,
        realmId: realm.id,
        providerId: created.id,
        providerPorts: ports,
        state,
        runtime: testkit.runtime,
      })
      expect(callback).toMatchObject({
        data: { authentication: { userId: user.id }, kind: "authenticated" },
        success: true,
      })
    })
  }
})

test("microsoft identities without a verified email do not auto-link", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "autolink-unverified.example.com")
    await verifiedUserCreate(database, testkit, realm.id, "unverified-link@example.com", "unverified-link")
    const created = externalIdentityProviderCreate({
      allowDevelopmentFallback: true,
      context: realmSystemContextCreate(),
      database,
      input: {
        allowAccountCreation: true,
        clientId: "client-id",
        clientSecret: "client-secret",
        displayName: "Microsoft",
        redirectUri: "https://app.test/callback",
        type: "microsoft",
      },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const ports = { microsoft: autoLinkPortCreate("unverified-link@example.com", "microsoft", false) }
    const started = await externalIdentityStart({
      allowDevelopmentFallback: true,
      database,
      input: {},
      realmId: realm.id,
      providerId: created.data.provider.id,
      providerPorts: ports,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    const state = new URL(started.data.authorizationUrl).searchParams.get("state") ?? ""
    const callback = await externalIdentityCallback({
      allowDevelopmentFallback: true,
      code: "code",
      database,
      realmId: realm.id,
      providerId: created.data.provider.id,
      providerPorts: ports,
      state,
      runtime: testkit.runtime,
    })
    expect(callback.success).toBe(false)
  })
})

test("linkStart is blocked when the organization disables external identities", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "link-policy.example.com")
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Link policy org" },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const organizationId = organization.data.organization.id
    const created = externalIdentityProviderCreate({
      allowDevelopmentFallback: true,
      context: realmSystemContextCreate(),
      database,
      input: {
        allowAccountCreation: true,
        clientId: "client-id",
        clientSecret: "client-secret",
        displayName: "Google",
        redirectUri: "https://app.test/callback",
        type: "google",
      },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const user = await verifiedUserCreate(database, testkit, realm.id, "policy-user@example.com", "policy-user")
    const login = passwordLogin({
      context: realmTenantContextCreate(realm.id, "anonymous"),
      database,
      input: { identifier: "policy-user", password: "Correct Horse 12" },
      realmId: realm.id,
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) return
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate(),
        database,
        input: { allowExternalIdentity: false },
        organizationId,
        realmId: realm.id,
      }).success,
    ).toBe(true)
    const ports = { google: autoLinkPortCreate("policy-user@example.com", "google") }
    const blocked = await externalIdentityLinkStart({
      allowDevelopmentFallback: true,
      database,
      input: { organizationId },
      realmId: realm.id,
      providerId: created.data.provider.id,
      providerPorts: ports,
      session: login.data.session.session,
      userId: user.id,
      runtime: testkit.runtime,
    })
    expect(blocked.success).toBe(false)
    if (blocked.success) return
    expect(blocked.code).toBe("external-identities.read-failed")
  })
})

test("provider secrets are stored encrypted and plaintext rows migrate on update", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "secret-encrypt.example.com")
    const created = externalIdentityProviderCreate({
      context: realmSystemContextCreate(),
      database,
      encryptionSecret: "item13-secret",
      input: {
        allowAccountCreation: true,
        clientId: "client-id",
        clientSecret: "super-plaintext-secret",
        displayName: "Google",
        redirectUri: "https://app.test/callback",
        type: "google",
      },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const stored = database.db
      .select({ clientSecret: externalIdentityProviderTable.clientSecret })
      .from(externalIdentityProviderTable)
      .where(eq(externalIdentityProviderTable.id, created.data.provider.id))
      .get()
    expect(stored?.clientSecret.startsWith("v1.")).toBe(true)
    expect(stored?.clientSecret.includes("super-plaintext-secret")).toBe(false)
    expect(
      externalIdentityProviderCreate({
        context: realmSystemContextCreate(),
        database,
        input: {
          allowAccountCreation: true,
          clientId: "other",
          clientSecret: "another-secret",
          displayName: "GitHub",
          redirectUri: "https://app.test/callback",
          type: "github",
        },
        realmId: realm.id,
      }).success,
    ).toBe(false)

    // Login still works against the encrypted row.
    const ports = { google: autoLinkPortCreate("encrypted-login@example.com", "google") }
    const started = await externalIdentityStart({
      database,
      encryptionSecret: "item13-secret",
      input: {},
      realmId: realm.id,
      providerId: created.data.provider.id,
      providerPorts: ports,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    const state = new URL(started.data.authorizationUrl).searchParams.get("state") ?? ""
    const callback = await externalIdentityCallback({
      database,
      encryptionSecret: "item13-secret",
      code: "code",
      realmId: realm.id,
      providerId: created.data.provider.id,
      providerPorts: ports,
      state,
      runtime: testkit.runtime,
    })
    expect(callback.success).toBe(true)

    // A legacy plaintext row keeps authenticating and is encrypted on next update.
    const legacy = externalIdentityRepositoryCreate(database.db).externalIdentityProviderCreate({
      allowAccountCreation: true,
      clientId: "legacy-id",
      clientSecret: "legacy-plaintext",
      createdAt: testkit.runtime.now(),
      displayName: "Legacy",
      enabled: true,
      id: "legacy-provider-id",
      issuer: null,
      organizationId: null,
      realmId: realm.id,
      redirectUri: "https://app.test/callback",
      scopes: JSON.stringify(["read:user", "user:email"]),
      type: "github",
      updatedAt: testkit.runtime.now(),
      version: 1,
    })
    expect(legacy.success).toBe(true)
    const legacyPorts = { github: autoLinkPortCreate("legacy-login@example.com", "github") }
    const legacyStart = await plaintextProviderLoginCheck(
      database,
      testkit,
      realm.id,
      "legacy-provider-id",
      legacyPorts,
    )
    expect(legacyStart).toBe(true)
    const migrated = externalIdentityProviderUpdate({
      context: realmSystemContextCreate(),
      database,
      encryptionSecret: "item13-secret",
      input: { displayName: "Legacy renamed" },
      providerId: "legacy-provider-id",
      realmId: realm.id,
    })
    expect(migrated.success).toBe(true)
    const migratedRow = database.db
      .select({ clientSecret: externalIdentityProviderTable.clientSecret })
      .from(externalIdentityProviderTable)
      .where(eq(externalIdentityProviderTable.id, "legacy-provider-id"))
      .get()
    expect(migratedRow?.clientSecret.startsWith("v1.")).toBe(true)
    expect(migratedRow?.clientSecret.includes("legacy-plaintext")).toBe(false)
  })
})

async function plaintextProviderLoginCheck(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  realmId: string,
  providerId: string,
  providerPorts: Parameters<typeof externalIdentityStart>[0]["providerPorts"],
): Promise<boolean> {
  const started = await externalIdentityStart({
    allowDevelopmentFallback: true,
    database,
    input: {},
    realmId,
    providerId,
    providerPorts,
    runtime: testkit.runtime,
  })
  if (!started.success) return false
  const state = new URL(started.data.authorizationUrl).searchParams.get("state") ?? ""
  const callback = await externalIdentityCallback({
    allowDevelopmentFallback: true,
    code: "code",
    database,
    realmId,
    providerId,
    providerPorts,
    state,
    runtime: testkit.runtime,
  })
  return callback.success
}
