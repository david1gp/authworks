import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { externalIdentityProviderCreate } from "../../src/features/externalIdentities/actions/externalIdentityProviderCreate.js"
import { externalIdentityProviderUpdate } from "../../src/features/externalIdentities/actions/externalIdentityProviderUpdate.js"
import type { ExternalIdentityProviderPort } from "../../src/features/externalIdentities/domain/externalIdentityProviderPort.js"
import { externalIdentityLinkBrowserResponseCreate } from "../../src/features/externalIdentities/server/externalIdentityLinkBrowserResponseCreate.js"
import { externalIdentityServerAppCreate } from "../../src/features/externalIdentities/server/externalIdentityServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { mfaChallengeComplete } from "../../src/features/mfa/actions/mfaChallengeComplete.js"
import { mfaPolicySet } from "../../src/features/mfa/actions/mfaPolicySet.js"
import { mfaTotpEnrollmentConfirm } from "../../src/features/mfa/actions/mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentStart } from "../../src/features/mfa/actions/mfaTotpEnrollmentStart.js"
import { mfaTotpCodeCreate } from "../../src/features/mfa/domain/mfaTotpCodeCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationLoginPolicySet } from "../../src/features/organizations/actions/organizationLoginPolicySet.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionBrowserModeHeaderName } from "../../src/features/sessions/public/sessionBrowserModeHeaderName.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userRepositoryCreate } from "../../src/features/users/persistence/userRepositoryCreate.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-external-browser-"))
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

function providerPort(providerType: "github" | "google" = "google"): ExternalIdentityProviderPort {
  return {
    authorizationUrlCreate(_configuration, input) {
      return resultCreate(`https://provider.example/authorize?state=${encodeURIComponent(input.state)}`)
    },
    callbackExchange(_configuration, input) {
      return Promise.resolve(
        resultCreate({
          displayName: "Browser external user",
          email: `${providerType}-external-browser@example.com`,
          emailVerified: true,
          externalSubject: `${providerType}-external-browser-subject`,
          ...(input.nonce === undefined ? {} : { nonce: input.nonce }),
          providerType,
          username: "external-browser",
        }),
      )
    },
  }
}

test("browser external callbacks issue only a cookie and resume opaque interaction state", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "external-browser.example.com", name: "External browser" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const provider = externalIdentityProviderCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowAccountCreation: true,
        clientId: "external-client",
        clientSecret: "external-secret",
        displayName: "Google",
        redirectUri: "https://external-browser.example.com/callback",
        type: "google",
      },
      realmId: realm.data.realm.id,
    })
    expect(provider.success).toBe(true)
    if (!provider.success) return
    const app = externalIdentityServerAppCreate({
      browserMode: true,
      database,
      providerPorts: { google: providerPort() },
      publicOrigin: "https://external-browser.example.com",
    })
    const interaction = "A".repeat(43)
    const start = await app.request(
      `https://external-browser.example.com/realms/${realm.data.realm.id}/external-identity/${provider.data.provider.id}/start`,
      {
        body: JSON.stringify({ interaction }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(start.status).toBe(200)
    const authorizationUrl = (await start.json()) as { authorizationUrl?: string }
    const state =
      new URL(authorizationUrl.authorizationUrl ?? "https://provider.example/").searchParams.get("state") ?? ""
    const callback = await app.request(
      `https://external-browser.example.com/realms/${realm.data.realm.id}/external-identity/${provider.data.provider.id}/callback?code=provider-code&state=${encodeURIComponent(state)}`,
      { headers: { [sessionBrowserModeHeaderName]: "true" } },
    )
    expect(callback.status).toBe(302)
    expect(callback.headers.get("location")).toBe(`/oauth2/authorize?interaction=${interaction}`)
    expect(callback.headers.get("set-cookie")).toContain("session=")
    expect(await callback.text()).toBe("")
  })
})

test("direct browser callbacks redirect into the UI instead of rendering raw JSON", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "external-direct.example.com", name: "External direct" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const provider = externalIdentityProviderCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowAccountCreation: true,
        clientId: "external-client",
        clientSecret: "external-secret",
        displayName: "Google",
        redirectUri: "https://external-direct.example.com/idps/callback",
        type: "google",
      },
      realmId: realm.data.realm.id,
    })
    expect(provider.success).toBe(true)
    if (!provider.success) return
    const github = externalIdentityProviderCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowAccountCreation: true,
        clientId: "github-client",
        clientSecret: "github-secret",
        displayName: "GitHub",
        redirectUri: "https://external-direct.example.com/idps/callback",
        type: "github",
      },
      realmId: realm.data.realm.id,
    })
    expect(github.success).toBe(true)
    if (!github.success) return
    const app = externalIdentityServerAppCreate({
      browserMode: true,
      database,
      providerPorts: { github: providerPort("github"), google: providerPort() },
      publicOrigin: "https://external-direct.example.com",
    })
    for (const current of [provider.data.provider, github.data.provider]) {
      const start = await app.request(
        `https://external-direct.example.com/realms/${realm.data.realm.id}/external-identity/${current.id}/start`,
        {
          body: JSON.stringify({}),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      )
      expect(start.status).toBe(200)
      const authorizationUrl = (await start.json()) as { authorizationUrl?: string }
      const state =
        new URL(authorizationUrl.authorizationUrl ?? "https://provider.example/").searchParams.get("state") ?? ""
      const callback = await app.request(
        `https://external-direct.example.com/idps/callback?code=provider-code&state=${encodeURIComponent(state)}`,
        { headers: { accept: "text/html" } },
      )
      expect(callback.status).toBe(302)
      expect(callback.headers.get("location")).toBe("/account")
      expect(callback.headers.get("set-cookie")).toContain("session=")
      expect(await callback.text()).toBe("")
    }

    const replayStart = await app.request(
      `https://external-direct.example.com/realms/${realm.data.realm.id}/external-identity/${provider.data.provider.id}/start`,
      {
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(replayStart.status).toBe(200)
    const replayAuthorizationUrl = (await replayStart.json()) as { authorizationUrl?: string }
    const replayState =
      new URL(replayAuthorizationUrl.authorizationUrl ?? "https://provider.example/").searchParams.get("state") ?? ""
    const replayConsumed = await app.request(
      `https://external-direct.example.com/idps/callback?code=provider-code&state=${encodeURIComponent(replayState)}`,
      { headers: { accept: "text/html" } },
    )
    expect(replayConsumed.status).toBe(302)
    const replay = await app.request(
      `https://external-direct.example.com/idps/callback?code=provider-code&state=${encodeURIComponent(replayState)}`,
      { headers: { accept: "text/html" } },
    )
    expect(replay.status).toBe(302)
    expect(replay.headers.get("location")).toBe(`/login/idp/${encodeURIComponent(provider.data.provider.id)}/failure`)
  })
})

test("browser link callbacks return a same-origin opener message without a token URL redirect", async () => {
  const response = externalIdentityLinkBrowserResponseCreate({
    callback: {
      confirmationToken: "confirmation-token",
      expiresAt: 600,
      kind: "link_confirmation",
      messageNonce: "message-nonce",
      providerId: "provider-google",
    },
    targetOrigin: "https://account.example.test/ignored-path",
  })

  expect(response.status).toBe(200)
  expect(response.headers.get("content-security-policy")).toContain("default-src 'none'")
  expect(response.headers.get("referrer-policy")).toBe("no-referrer")
  const body = await response.text()
  expect(body).toContain("https://account.example.test")
  expect(body).toContain("confirmation-token")
  expect(body).not.toContain("location.href")
})

test("browser link callbacks reject a misconfigured target origin without disclosing the confirmation token", async () => {
  for (const targetOrigin of ["not-an-origin", "*"]) {
    const response = externalIdentityLinkBrowserResponseCreate({
      callback: {
        confirmationToken: "confirmation-token",
        expiresAt: 600,
        kind: "link_confirmation",
        messageNonce: "message-nonce",
        providerId: "provider-google",
      },
      targetOrigin,
    })

    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain("confirmation-token")
  }
})

test("authenticated link callbacks use the browser response after server-side state, nonce, and PKCE validation", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "external-link-browser.example.com", name: "External link browser" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const provider = externalIdentityProviderCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowAccountCreation: true,
        clientId: "external-client",
        clientSecret: "external-secret",
        displayName: "Google",
        redirectUri: `https://external-link-browser.example.com/realms/${realm.data.realm.id}/external-identity/callback`,
        scopes: ["openid", "email"],
        type: "google",
      },
      realmId: realm.data.realm.id,
    })
    expect(provider.success).toBe(true)
    if (!provider.success) return
    const user = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        email: "link-browser@example.com",
        profile: { displayName: "Link browser" },
        userName: "link-browser",
      },
      realmId: realm.data.realm.id,
    })
    expect(user.success).toBe(true)
    if (!user.success) return
    expect(
      userRepositoryCreate(database.db).userUpdate(realm.data.realm.id, user.data.user.id, {
        emailVerifiedAt: database.runtime.now(),
        registrationVerificationMethod: "email",
        registrationVerifiedAt: database.runtime.now(),
        state: "active",
        updatedAt: database.runtime.now(),
      }).success,
    ).toBe(true)
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.data.realm.id,
      userId: user.data.user.id,
    })
    expect(session.success).toBe(true)
    if (!session.success) return
    let authorizationInput:
      | {
          readonly nonce?: string
          readonly pkceChallenge: string
          readonly scopes: readonly string[]
          readonly state: string
        }
      | undefined
    let callbackInput: { readonly nonce?: string; readonly pkceVerifier: string } | undefined
    const linkingProviderPort: ExternalIdentityProviderPort = {
      authorizationUrlCreate(configuration, input) {
        authorizationInput = { ...input, scopes: configuration.scopes }
        return resultCreate(`https://provider.example/authorize?state=${encodeURIComponent(input.state)}`)
      },
      callbackExchange(_configuration, input) {
        callbackInput = input
        return Promise.resolve(
          resultCreate({
            displayName: "Browser linked user",
            email: "linked@example.com",
            emailVerified: true,
            externalSubject: "linked-subject",
            nonce: input.nonce,
            providerType: "google",
          }),
        )
      },
    }
    const app = externalIdentityServerAppCreate({
      accountUiOrigin: "https://account.example.com",
      browserMode: true,
      database,
      providerPorts: { google: linkingProviderPort },
      publicOrigin: "https://api.example.com",
    })
    const start = await app.request(
      `https://external-link-browser.example.com/realms/${realm.data.realm.id}/me/external-identities/${provider.data.provider.id}/link/start`,
      {
        body: "{}",
        headers: { authorization: `Bearer ${session.data.token}`, "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(start.status).toBe(200)
    const startBody = (await start.json()) as {
      authorizationUrl: string
      callbackOrigin?: string
      messageNonce?: string
    }
    const state = new URL(startBody.authorizationUrl).searchParams.get("state") ?? undefined
    expect(state).toBeString()
    expect(startBody.callbackOrigin).toBe("https://account.example.com")
    expect(startBody.messageNonce).toBeString()
    expect(authorizationInput?.scopes).toEqual(["openid", "email"])
    expect(authorizationInput?.pkceChallenge).toBeString()
    expect(authorizationInput?.nonce).toBeString()
    expect(authorizationInput?.state).toBe(state)
    const callback = await app.request(
      `https://external-link-browser.example.com/realms/${realm.data.realm.id}/external-identity/${provider.data.provider.id}/callback?code=provider-code&state=${encodeURIComponent(state ?? "")}`,
      { headers: { accept: "text/html" } },
    )
    expect(callback.status).toBe(200)
    expect(callback.headers.get("content-type")).toContain("text/html")
    const callbackBody = await callback.text()
    expect(callbackBody).toContain("confirmationToken")
    expect(callbackBody).toContain("https://account.example.com")
    expect(callbackInput?.pkceVerifier).toBeString()
    expect(callbackInput?.nonce).toBe(authorizationInput?.nonce)

    const missingAccountUiOriginApp = externalIdentityServerAppCreate({
      browserMode: true,
      database,
      providerPorts: { google: linkingProviderPort },
      publicOrigin: "https://api.example.com",
    })
    const missingAccountUiOrigin = await missingAccountUiOriginApp.request(
      `https://external-link-browser.example.com/realms/${realm.data.realm.id}/me/external-identities/${provider.data.provider.id}/link/start`,
      {
        body: "{}",
        headers: { authorization: `Bearer ${session.data.token}`, "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(missingAccountUiOrigin.status).toBe(400)
    expect(await missingAccountUiOrigin.text()).not.toContain("https://api.example.com")
  })
})

test("shared external callback resolves Google and GitHub transactions without weakening callback checks", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "shared-callback.example.com", name: "Shared callback" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const sharedRedirectUri = "https://shared-callback.example.com/idps/callback"
    const createProvider = async (type: "github" | "google") => {
      const provider = externalIdentityProviderCreate({
        context: realmSystemContextCreate(),
        database,
        input: {
          allowAccountCreation: true,
          clientId: `${type}-client`,
          clientSecret: `${type}-secret`,
          displayName: type,
          redirectUri: sharedRedirectUri,
          type,
        },
        realmId: realm.data.realm.id,
      })
      expect(provider.success).toBe(true)
      if (!provider.success) throw new Error(provider.errorMessage)
      return provider.data.provider
    }
    const google = await createProvider("google")
    const github = await createProvider("github")
    const app = externalIdentityServerAppCreate({
      database,
      providerPorts: { github: providerPort("github"), google: providerPort("google") },
    })
    const start = async (providerId: string) => {
      const response = await app.request(
        `https://shared-callback.example.com/realms/${realm.data.realm.id}/external-identity/${providerId}/start`,
        { body: JSON.stringify({}), headers: { "content-type": "application/json" }, method: "POST" },
      )
      expect(response.status).toBe(200)
      const body = (await response.json()) as { authorizationUrl: string }
      return new URL(body.authorizationUrl).searchParams.get("state") ?? ""
    }
    const callback = async (state: string) =>
      app.request(`${sharedRedirectUri}?code=provider-code&state=${encodeURIComponent(state)}`)

    for (const provider of [google, github]) {
      const state = await start(provider.id)
      const response = await callback(state)
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ kind: "authenticated" })
    }

    const invalidState = await callback("invalid-state")
    expect(invalidState.status).toBe(400)
    expect(await invalidState.json()).toMatchObject({ error: { code: "external-identities.invalid" } })

    const mismatchedState = await start(google.id)
    const mismatched = await app.request(
      `https://shared-callback.example.com/realms/${realm.data.realm.id}/external-identity/${github.id}/callback?code=provider-code&state=${encodeURIComponent(mismatchedState)}`,
    )
    expect(mismatched.status).toBe(400)
    expect(await mismatched.json()).toMatchObject({ error: { code: "external-identities.invalid" } })

    const tamperedState = await start(google.id)
    const updated = externalIdentityProviderUpdate({
      context: realmSystemContextCreate(),
      database,
      input: { redirectUri: "https://different.example.com/idps/callback" },
      providerId: google.id,
      realmId: realm.data.realm.id,
    })
    expect(updated.success).toBe(true)
    const tampered = await callback(tamperedState)
    expect(tampered.status).toBe(400)
    expect(await tampered.json()).toMatchObject({ error: { code: "external-identities.invalid" } })

    const expiredState = await start(github.id)
    testkit.advance(10 * 60 * 1_000)
    const expired = await callback(expiredState)
    expect(expired.status).toBe(400)
    expect(await expired.json()).toMatchObject({ error: { code: "external-identities.invalid" } })

    const replayState = await start(github.id)
    const first = await callback(replayState)
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ kind: "authenticated" })
    const replay = await callback(replayState)
    expect(replay.status).toBe(400)
    expect(await replay.json()).toMatchObject({ error: { code: "external-identities.invalid" } })
  })
})

async function createActiveUserWithTotp(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  realmId: string,
  email: string,
  userName: string,
) {
  const user = userCreate({
    context: realmSystemContextCreate(),
    database,
    input: { email, profile: { displayName: userName }, userName },
    realmId,
  })
  expect(user.success).toBe(true)
  if (!user.success) throw new Error(user.errorMessage)
  expect(
    userRepositoryCreate(database.db).userUpdate(realmId, user.data.user.id, {
      emailVerifiedAt: database.runtime.now(),
      registrationVerificationMethod: "email",
      registrationVerifiedAt: database.runtime.now(),
      state: "active",
      updatedAt: database.runtime.now(),
    }).success,
  ).toBe(true)
  const enrolled = mfaTotpEnrollmentStart({
    database,
    encryptionSecret: "mfa-test-secret",
    realmId,
    runtime: testkit.runtime,
    userId: user.data.user.id,
  })
  expect(enrolled.success).toBe(true)
  if (!enrolled.success) throw new Error(enrolled.errorMessage)
  const code = mfaTotpCodeCreate(enrolled.data.secret, Math.floor(testkit.runtime.now() / 30_000))
  expect(code.success).toBe(true)
  if (!code.success) throw new Error(code.errorMessage)
  const confirmed = mfaTotpEnrollmentConfirm({
    database,
    encryptionSecret: "mfa-test-secret",
    input: { code: code.data, enrollmentId: enrolled.data.enrollment.id },
    realmId,
    runtime: testkit.runtime,
    userId: user.data.user.id,
  })
  expect(confirmed.success).toBe(true)
  if (!confirmed.success) throw new Error(confirmed.errorMessage)
  return { secret: enrolled.data.secret, userId: user.data.user.id }
}

function mfaChallengePort(email: string): ExternalIdentityProviderPort {
  return {
    authorizationUrlCreate(_configuration, input) {
      return resultCreate(`https://provider.example/authorize?state=${encodeURIComponent(input.state)}`)
    },
    callbackExchange(_configuration, input) {
      return Promise.resolve(
        resultCreate({
          displayName: "MFA external user",
          email,
          emailVerified: true,
          externalSubject: `mfa-external-subject-${email}`,
          ...(input.nonce === undefined ? {} : { nonce: input.nonce }),
          providerType: "google" as const,
          username: "mfa-external",
        }),
      )
    },
  }
}

test("direct browser callbacks thread an org-forced MFA challenge through the login redirect", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "external-mfa-direct.example.com", name: "External MFA direct" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "MFA organization" },
      realmId: realm.data.realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate(),
        database,
        input: { requiredMfa: true },
        organizationId: organization.data.organization.id,
        realmId: realm.data.realm.id,
      }).success,
    ).toBe(true)
    const email = "mfa-direct-user@example.com"
    const enrolled = await createActiveUserWithTotp(database, testkit, realm.data.realm.id, email, "mfa-direct")
    // The enrollment confirmation consumed the current TOTP step, so move to the next step before
    // completing the login challenge. Without this the same code would be rejected as a replay.
    testkit.advance(30_000)
    const provider = externalIdentityProviderCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowAccountCreation: true,
        clientId: "external-client",
        clientSecret: "external-secret",
        displayName: "Google",
        organizationId: organization.data.organization.id,
        redirectUri: "https://external-mfa-direct.example.com/idps/callback",
        type: "google",
      },
      realmId: realm.data.realm.id,
    })
    expect(provider.success).toBe(true)
    if (!provider.success) return
    const app = externalIdentityServerAppCreate({
      browserMode: true,
      database,
      providerPorts: { google: mfaChallengePort(email) },
      publicOrigin: "https://external-mfa-direct.example.com",
    })
    const start = await app.request(
      `https://external-mfa-direct.example.com/realms/${realm.data.realm.id}/external-identity/${provider.data.provider.id}/start`,
      {
        body: JSON.stringify({ organizationId: organization.data.organization.id }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(start.status).toBe(200)
    const authorizationUrl = (await start.json()) as { authorizationUrl?: string }
    const state =
      new URL(authorizationUrl.authorizationUrl ?? "https://provider.example/").searchParams.get("state") ?? ""
    const callback = await app.request(
      `https://external-mfa-direct.example.com/idps/callback?code=provider-code&state=${encodeURIComponent(state)}`,
      { headers: { accept: "text/html" } },
    )
    expect(callback.status).toBe(302)
    const location = callback.headers.get("location") ?? ""
    expect(location.startsWith("/login/mfa?mfa_challenge=")).toBe(true)
    expect(callback.headers.get("set-cookie")).toBeNull()
    expect(await callback.text()).toBe("")
    const challengeToken = new URL(location, "https://external-mfa-direct.example.com").searchParams.get(
      "mfa_challenge",
    )
    expect(challengeToken).toBeString()
    const code = mfaTotpCodeCreate(enrolled.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(code.success).toBe(true)
    if (!code.success || challengeToken === null) return
    const completed = mfaChallengeComplete({
      database,
      encryptionSecret: "mfa-test-secret",
      input: { code: code.data, token: challengeToken },
      realmId: realm.data.realm.id,
      runtime: testkit.runtime,
    })
    expect(completed.success).toBe(true)
    if (!completed.success) return
    expect(completed.data.session?.session.assurance).toBe("multi_factor")
    expect(completed.data.authentication.userId).toBe(enrolled.userId)
  })
})

test("interaction browser callbacks keep the MFA challenge alongside the OIDC resume state", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "external-mfa-interaction.example.com", name: "External MFA interaction" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    expect(
      mfaPolicySet({
        context: realmSystemContextCreate("system"),
        database,
        input: { lockoutDurationMs: 900_000, maxAttempts: 5, mode: "required", totpWindow: 1 },
        realmId: realm.data.realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(true)
    const email = "mfa-interaction-user@example.com"
    const enrolled = await createActiveUserWithTotp(database, testkit, realm.data.realm.id, email, "mfa-interaction")
    // The enrollment confirmation consumed the current TOTP step, so move to the next step before
    // completing the login challenge. Without this the same code would be rejected as a replay.
    testkit.advance(30_000)
    const provider = externalIdentityProviderCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowAccountCreation: true,
        clientId: "external-client",
        clientSecret: "external-secret",
        displayName: "Google",
        redirectUri: "https://external-mfa-interaction.example.com/callback",
        type: "google",
      },
      realmId: realm.data.realm.id,
    })
    expect(provider.success).toBe(true)
    if (!provider.success) return
    const app = externalIdentityServerAppCreate({
      browserMode: true,
      database,
      providerPorts: { google: mfaChallengePort(email) },
      publicOrigin: "https://external-mfa-interaction.example.com",
    })
    const interaction = "B".repeat(43)
    const start = await app.request(
      `https://external-mfa-interaction.example.com/realms/${realm.data.realm.id}/external-identity/${provider.data.provider.id}/start`,
      {
        body: JSON.stringify({ interaction }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(start.status).toBe(200)
    const authorizationUrl = (await start.json()) as { authorizationUrl?: string }
    const state =
      new URL(authorizationUrl.authorizationUrl ?? "https://provider.example/").searchParams.get("state") ?? ""
    const callback = await app.request(
      `https://external-mfa-interaction.example.com/realms/${realm.data.realm.id}/external-identity/${provider.data.provider.id}/callback?code=provider-code&state=${encodeURIComponent(state)}`,
      { headers: { [sessionBrowserModeHeaderName]: "true" } },
    )
    expect(callback.status).toBe(302)
    const location = callback.headers.get("location") ?? ""
    const redirect = new URL(location, "https://external-mfa-interaction.example.com")
    expect(redirect.pathname).toBe("/login/mfa")
    expect(redirect.searchParams.get("interaction")).toBe(interaction)
    expect(redirect.searchParams.get("return_to")).toBe(`/oauth2/authorize?interaction=${interaction}`)
    const challengeToken = redirect.searchParams.get("mfa_challenge")
    expect(challengeToken).toBeString()
    expect(callback.headers.get("set-cookie")).toBeNull()
    expect(await callback.text()).toBe("")
    const code = mfaTotpCodeCreate(enrolled.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(code.success).toBe(true)
    if (!code.success || challengeToken === null) return
    const completed = mfaChallengeComplete({
      database,
      encryptionSecret: "mfa-test-secret",
      input: { code: code.data, token: challengeToken },
      realmId: realm.data.realm.id,
      runtime: testkit.runtime,
    })
    expect(completed.success).toBe(true)
    if (!completed.success) return
    expect(completed.data.session?.session.assurance).toBe("multi_factor")
    expect(completed.data.authentication.userId).toBe(enrolled.userId)
  })
})
