import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { externalIdentityProviderCreate } from "../../src/features/externalIdentities/actions/externalIdentityProviderCreate.js"
import { externalIdentityProviderUpdate } from "../../src/features/externalIdentities/actions/externalIdentityProviderUpdate.js"
import type { ExternalIdentityProviderPort } from "../../src/features/externalIdentities/domain/externalIdentityProviderPort.js"
import { externalIdentityServerAppCreate } from "../../src/features/externalIdentities/server/externalIdentityServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { sessionBrowserModeHeaderName } from "../../src/features/sessions/public/sessionBrowserModeHeaderName.js"
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
