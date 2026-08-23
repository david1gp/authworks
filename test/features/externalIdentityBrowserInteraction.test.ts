import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { externalIdentityProviderCreate } from "../../src/features/externalIdentities/actions/externalIdentityProviderCreate.js"
import type { ExternalIdentityProviderPort } from "../../src/features/externalIdentities/domain/externalIdentityProviderPort.js"
import { externalIdentityServerAppCreate } from "../../src/features/externalIdentities/server/externalIdentityServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { sessionBrowserModeHeaderName } from "../../src/features/sessions/public/sessionBrowserModeHeaderName.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-external-browser-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

function providerPort(): ExternalIdentityProviderPort {
  return {
    authorizationUrlCreate(_configuration, input) {
      return resultCreate(`https://provider.example/authorize?state=${encodeURIComponent(input.state)}`)
    },
    callbackExchange(_configuration, input) {
      return Promise.resolve(
        resultCreate({
          displayName: "Browser external user",
          email: "external-browser@example.com",
          emailVerified: true,
          externalSubject: "external-browser-subject",
          ...(input.nonce === undefined ? {} : { nonce: input.nonce }),
          providerType: "google" as const,
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
