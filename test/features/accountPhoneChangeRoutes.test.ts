import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { accountDemoUserFixture } from "../../src/features/account/ui/accountDemoUserFixture.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { whatsappOtpApiClientCreate } from "../../src/features/whatsappOtp/client/whatsappOtpApiClientCreate.js"
import type { WhatsappOtpAvailabilityPort } from "../../src/features/whatsappOtp/domain/whatsappOtpAvailabilityPort.js"
import { whatsappOtpServerAppCreate } from "../../src/features/whatsappOtp/server/whatsappOtpServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const available: WhatsappOtpAvailabilityPort = {
  whatsappOtpAvailabilityGet: () => ({ data: { available: true }, success: true }),
}

test("account phone-change routes require the authenticated same user and browser CSRF", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "account-phone-routes.example.com", name: "Account phone routes" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const user = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "phone-routes@example.com", phoneNumber: "+14155552671", profile: {}, userName: "phone-routes" },
      realmId: realm.data.realm.id,
    })
    expect(user.success).toBe(true)
    if (!user.success) return
    const activated = userLifecycleSet({
      context: realmSystemContextCreate(),
      database,
      input: { state: "active" },
      realmId: realm.data.realm.id,
      userId: user.data.user.id,
    })
    expect(activated.success).toBe(true)
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.data.realm.id,
      runtime: testkit.runtime,
      userId: user.data.user.id,
    })
    expect(session.success).toBe(true)
    if (!session.success) return
    const app = whatsappOtpServerAppCreate({
      availability: available,
      database,
      onDelivery: ({ code }) => {
        deliveryCode = code
      },
      publicOrigin: "https://account-phone-routes.example.com",
      rateLimitSecret: "account-phone-routes-secret",
    })
    const path = `/realms/${realm.data.realm.id}/me/phone-change/start`
    const url = `https://account-phone-routes.example.com${path}`
    const unauthenticated = await app.request(url, {
      body: JSON.stringify({ phoneNumber: "+14155552672" }),
      method: "POST",
    })
    expect(unauthenticated.status).toBe(401)

    const cookie = `session=${session.data.token}`
    const missingOrigin = await app.request(url, {
      body: JSON.stringify({ phoneNumber: "+14155552672" }),
      headers: { cookie, "content-type": "application/json" },
      method: "POST",
    })
    expect(missingOrigin.status).toBe(403)
    const csrf = sessionCsrfTokenCreate(testkit.runtime)
    const missingCsrf = await app.request(url, {
      body: JSON.stringify({ phoneNumber: "+14155552672" }),
      headers: { cookie, "content-type": "application/json", origin: "https://account-phone-routes.example.com" },
      method: "POST",
    })
    expect(missingCsrf.status).toBe(403)
    const browserHeaders = {
      cookie: `${cookie}; csrf=${csrf}`,
      origin: "https://account-phone-routes.example.com",
      "x-csrf-token": csrf,
    }
    const invalid = await app.request(url, {
      body: JSON.stringify({ phoneNumber: "+14155552672", unexpected: true }),
      headers: { ...browserHeaders, "content-type": "application/json" },
      method: "POST",
    })
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toMatchObject({ error: { code: "whatsapp-otp.invalid" } })

    const started = await app.request(url, {
      body: JSON.stringify({ phoneNumber: "+14155552672" }),
      headers: { ...browserHeaders, "content-type": "application/json" },
      method: "POST",
    })
    expect(started.status).toBe(200)
    const startedBody = (await started.json()) as { challengeId: string; accepted: true }
    expect(startedBody.accepted).toBe(true)
    expect(startedBody.challengeId).toBeString()

    const resend = await app.request(
      `https://account-phone-routes.example.com/realms/${realm.data.realm.id}/me/phone-change/resend`,
      {
        body: JSON.stringify({ challengeId: startedBody.challengeId, phoneNumber: "+14155552672" }),
        headers: { authorization: `Bearer ${session.data.token}`, "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(resend.status).toBe(200)
    expect(await resend.json()).toMatchObject({ accepted: true, challengeId: startedBody.challengeId })

    const verified = await app.request(
      `https://account-phone-routes.example.com/realms/${realm.data.realm.id}/me/phone-change/verify`,
      {
        body: JSON.stringify({ challengeId: startedBody.challengeId, code: deliveryCode, phoneNumber: "+14155552672" }),
        headers: { authorization: `Bearer ${session.data.token}`, "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(verified.status).toBe(200)
    expect(await verified.json()).toMatchObject({ user: { id: user.data.user.id, phoneNumber: "+14155552672" } })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 1 })
  })
})

test("account phone-change browser client sends typed mutations and maps HTTP errors", async () => {
  const requests: Array<{ body?: unknown; init?: RequestInit; url: string }> = []
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString()
    requests.push({ body: init?.body === undefined ? undefined : JSON.parse(String(init.body)), init, url })
    if (url.endsWith("/sessions/csrf"))
      return Response.json({ csrfToken: "csrf-token-for-browser-client-123456789012345678901" })
    if (url.endsWith("/phone-change/verify")) return Response.json({ user: accountDemoUserFixture })
    return Response.json({
      accepted: true,
      challengeId: "phone-change-client-challenge",
      expiresAt: 1_700_000_600_000,
      retryAt: 1_700_000_060_000,
    })
  }
  const client = whatsappOtpApiClientCreate({ baseUrl: "https://account-client.example.com", fetch })

  expect((await client.whatsappOtpPhoneChangeStart("realm/client", { phoneNumber: "+14155552672" })).success).toBe(true)
  expect(
    (
      await client.whatsappOtpPhoneChangeResend("realm/client", {
        challengeId: "phone-change-client-challenge",
        phoneNumber: "+14155552672",
      })
    ).success,
  ).toBe(true)
  expect(
    (
      await client.whatsappOtpPhoneChangeVerify("realm/client", {
        challengeId: "phone-change-client-challenge",
        code: "123456",
        phoneNumber: "+14155552672",
      })
    ).success,
  ).toBe(true)

  const mutations = requests.filter((request) => !request.url.endsWith("/sessions/csrf"))
  expect(requests.filter((request) => request.url.endsWith("/sessions/csrf"))).toHaveLength(3)
  expect(mutations.map((request) => request.url)).toEqual([
    "https://account-client.example.com/realms/realm%2Fclient/me/phone-change/start",
    "https://account-client.example.com/realms/realm%2Fclient/me/phone-change/resend",
    "https://account-client.example.com/realms/realm%2Fclient/me/phone-change/verify",
  ])
  expect(mutations.map((request) => request.body)).toEqual([
    { phoneNumber: "+14155552672" },
    { challengeId: "phone-change-client-challenge", phoneNumber: "+14155552672" },
    { challengeId: "phone-change-client-challenge", code: "123456", phoneNumber: "+14155552672" },
  ])
  for (const mutation of mutations) {
    expect(new Headers(mutation.init?.headers).get("x-csrf-token")).toBe(
      "csrf-token-for-browser-client-123456789012345678901",
    )
    expect(new Headers(mutation.init?.headers).get("x-authworks-browser-mode")).toBe("true")
    expect(mutation.init?.credentials).toBe("include")
  }

  let fetched = false
  const invalidClient = whatsappOtpApiClientCreate({
    baseUrl: "https://account-client.example.com",
    fetch: async () => {
      fetched = true
      return Response.json({})
    },
  })
  expect(
    await invalidClient.whatsappOtpPhoneChangeVerify("realm", {
      challengeId: "challenge",
      code: "12345",
      phoneNumber: "+14155552672",
    }),
  ).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
  expect(fetched).toBe(false)

  const mapped = await whatsappOtpApiClientCreate({
    baseUrl: "https://account-client.example.com",
    fetch: async (input) =>
      input.toString().endsWith("/sessions/csrf")
        ? Response.json({ csrfToken: "csrf-token-for-browser-client-123456789012345678901" })
        : Response.json(
            {
              error: {
                code: "whatsapp-otp.unavailable",
                message: "WhatsApp is unavailable.",
                requestId: "phone-change-client-error",
                retryable: true,
                status: 503,
              },
            },
            { status: 503 },
          ),
  }).whatsappOtpPhoneChangeStart("realm", { phoneNumber: "+14155552672" })
  expect(mapped).toMatchObject({ code: "whatsapp-otp.unavailable", statusCode: 503, success: false })
})

let deliveryCode = ""

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-account-phone-routes-"))
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
