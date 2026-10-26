import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { passkeyApiClientCreate } from "../../src/features/passkeys/client/passkeyApiClientCreate.js"
import { passkeyServerAppCreate } from "../../src/features/passkeys/server/passkeyServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const rpId = "example.com"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-passkeys-mfa-login-"))
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

test("passkeyMfaLoginStart sends the challenge token to the MFA login start route", async () => {
  const seen: { body: unknown; method?: string; url: string }[] = []
  const token = "a".repeat(43)
  const client = passkeyApiClientCreate({
    baseUrl: "https://server.test",
    fetch: (async (input, init) => {
      seen.push({ body: (init?.body as string | undefined) ?? null, method: init?.method, url: input.toString() })
      return Response.json({
        options: { challenge: "c", rpId, timeout: 60_000, userVerification: "preferred" },
        token,
      })
    }) as typeof fetch,
  })
  const started = await client.passkeyMfaLoginStart("realm-1", token)
  expect(started.success).toBe(true)
  if (!started.success) return
  expect(seen).toHaveLength(1)
  expect(seen[0]?.url).toBe("https://server.test/realms/realm-1/passkeys/mfa/login/start")
  expect(seen[0]?.method).toBe("POST")
  expect(seen[0]?.body).toBe(JSON.stringify({ token }))
  expect(started.data).toEqual({
    options: { challenge: "c", rpId, timeout: 60_000, userVerification: "preferred" },
    token,
  })
})

test("passkeyMfaLoginComplete sends the ceremony response to the MFA login complete route", async () => {
  const seen: { body: unknown; method?: string; url: string }[] = []
  const token = "b".repeat(43)
  const client = passkeyApiClientCreate({
    baseUrl: "https://server.test",
    fetch: (async (input, init) => {
      seen.push({ body: (init?.body as string | undefined) ?? null, method: init?.method, url: input.toString() })
      return Response.json({ authentication: { authenticatedAt: 1, realmId: "realm-1", userId: "user-1" } })
    }) as typeof fetch,
  })
  const input = {
    response: {
      clientExtensionResults: {},
      id: "credentialId",
      rawId: "credentialId",
      response: {
        authenticatorData: "YXV0aA",
        clientDataJSON: "Y2xpZW50",
        signature: "c2ln",
      },
      type: "public-key" as const,
    },
    token,
  }
  const completed = await client.passkeyMfaLoginComplete("realm-1", input)
  expect(completed.success).toBe(true)
  if (!completed.success) return
  expect(seen).toHaveLength(1)
  expect(seen[0]?.url).toBe("https://server.test/realms/realm-1/passkeys/mfa/login/complete")
  expect(seen[0]?.method).toBe("POST")
  expect(seen[0]?.body).toBe(JSON.stringify(input))
  expect(completed.data.authentication).toMatchObject({ realmId: "realm-1", userId: "user-1" })
})

test("passkey MFA login clients validate input and surface server rejections", async () => {
  await withDatabase(async (database) => {
    const created = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "passkeys-mfa-login.example.com", name: "mfa login" },
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const app = passkeyServerAppCreate({ database, origins: ["https://example.com"], rpId, rpName: "Test RP" })
    const client = passkeyApiClientCreate({
      baseUrl: "https://passkeys-mfa-login.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
    })
    expect((await client.passkeyMfaLoginStart(created.data.realm.id, "")).success).toBe(false)
    const rejected = await client.passkeyMfaLoginStart(created.data.realm.id, "c".repeat(43))
    expect(rejected.success).toBe(false)
    if (rejected.success) return
    expect(rejected.code).toBe("mfa.invalid")
  })
})
