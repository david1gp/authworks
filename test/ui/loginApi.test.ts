import { describe, expect, test } from "bun:test"
import { loginApiCreate } from "../../src/features/login/ui/loginApiCreate.js"
import { sessionBrowserModeHeaderName } from "../../src/features/sessions/public/sessionBrowserModeHeaderName.js"

const realmId = "018f0000-0000-7000-8000-000000000001"
const baseUrl = "https://auth.example"

type RecordedRequest = { init?: RequestInit; url: string }

function loginApiFixtureCreate(responder: (url: string) => unknown) {
  const requests: RecordedRequest[] = []
  const api = loginApiCreate({
    baseUrl,
    fetch: async (input, init) => {
      const url = String(input)
      requests.push({ init, url })
      if (url.endsWith("/sessions/csrf")) return Response.json({ csrfToken: "csrf-fixture" })
      return Response.json(responder(url))
    },
  })
  return { api, requests }
}

describe("hosted login browser API", () => {
  test("primary password authentication posts in cookie mode without a bearer token", async () => {
    const { api, requests } = loginApiFixtureCreate(() => ({
      authentication: { authenticatedAt: 1, realmId, userId: "user-1" },
    }))

    const result = await api.passwordLogin(realmId, "alex@acme.example", "correct horse", "org-1")

    expect(result.success).toBe(true)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe(`${baseUrl}/realms/${realmId}/password/login`)
    expect(requests[0]?.init?.credentials).toBe("include")
    const headers = new Headers(requests[0]?.init?.headers)
    expect(headers.get("authorization")).toBeNull()
    expect(headers.get(sessionBrowserModeHeaderName)).toBe("true")
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      identifier: "alex@acme.example",
      organizationId: "org-1",
      password: "correct horse",
    })
  })

  test("the login response never exposes a session token to the browser", async () => {
    const { api } = loginApiFixtureCreate(() => ({
      authentication: { authenticatedAt: 1, realmId, userId: "user-1" },
    }))

    const result = await api.passwordLogin(realmId, "alex@acme.example", "correct horse")

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.session).toBeUndefined()
    expect(JSON.stringify(result.data)).not.toContain("token")
  })

  test("an MFA challenge is surfaced instead of a session", async () => {
    const { api } = loginApiFixtureCreate(() => ({
      authentication: { authenticatedAt: 1, realmId, userId: "user-1" },
      challenge: {
        challenge: { expiresAt: 2, id: "challenge-1", purpose: "login", requiredAssurance: "multi_factor" },
        token: "t".repeat(43),
      },
    }))

    const result = await api.passwordLogin(realmId, "alex@acme.example", "correct horse")

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.challenge?.challenge.id).toBe("challenge-1")
  })

  test("session-bound operations exchange a CSRF token before mutating", async () => {
    const { api, requests } = loginApiFixtureCreate(() => ({ revoked: true }))

    const result = await api.logout(realmId)

    expect(result.success).toBe(true)
    expect(requests.map((request) => request.url)).toEqual([
      `${baseUrl}/realms/${realmId}/sessions/csrf`,
      `${baseUrl}/realms/${realmId}/sessions/logout`,
    ])
    expect(new Headers(requests[1]?.init?.headers).get("x-csrf-token")).toBe("csrf-fixture")
    expect(requests[1]?.init?.credentials).toBe("include")
  })

  test("recent account resume delegates to the CSRF-protected session client", async () => {
    const { api, requests } = loginApiFixtureCreate(() => ({
      session: {
        assurance: "authenticated",
        authenticationMethod: "password",
        createdAt: 1,
        current: true,
        device: {},
        expiresAt: 2,
        id: "session-alex",
        lastUsedAt: 1,
        realmId,
        revokedAt: null,
        subjectId: "user-1",
        subjectType: "user",
        userId: "user-1",
      },
    }))

    const result = await api.recentResume(realmId, "session-alex", "org-1")

    expect(result.success).toBe(true)
    expect(requests.map((request) => request.url)).toEqual([
      `${baseUrl}/realms/${realmId}/sessions/csrf`,
      `${baseUrl}/realms/${realmId}/sessions/recent/resume`,
    ])
    const resumeRequest = requests[1]
    expect(resumeRequest?.init?.credentials).toBe("include")
    const headers = new Headers(resumeRequest?.init?.headers)
    expect(headers.get("authorization")).toBeNull()
    expect(headers.get("x-csrf-token")).toBe("csrf-fixture")
    expect(headers.get(sessionBrowserModeHeaderName)).toBe("true")
    expect(JSON.parse(String(resumeRequest?.init?.body))).toEqual({
      organizationId: "org-1",
      sessionId: "session-alex",
    })
  })

  test("a failed CSRF exchange stops the mutation", async () => {
    let requestCount = 0
    const api = loginApiCreate({
      baseUrl,
      fetch: async () => {
        requestCount += 1
        return Response.json({ error: { code: "sessions.unauthorized", message: "no" } }, { status: 401 })
      },
    })

    const result = await api.logout(realmId)

    expect(result.success).toBe(false)
    expect(requestCount).toBe(1)
  })

  test("realm discovery is requested at runtime rather than from a fixed realm identifier", async () => {
    const { api, requests } = loginApiFixtureCreate(() => ({ found: false }))

    await api.discover("acme.example")

    expect(requests[0]?.url).toBe(`${baseUrl}/organization-discovery?domain=acme.example`)
    expect(requests[0]?.url).not.toContain(realmId)
  })

  test("recovery, registration, verification, and email code paths are realm-scoped", async () => {
    const paths: string[] = []
    const api = loginApiCreate({
      baseUrl,
      fetch: async (input) => {
        paths.push(new URL(String(input)).pathname)
        return Response.json({ accepted: true })
      },
    })

    await api.recoveryRequest(realmId, "alex@acme.example")
    await api.emailOtpStart(realmId, "alex@acme.example")

    expect(paths).toEqual([`/realms/${realmId}/password/recovery/request`, `/realms/${realmId}/email-otp/start`])
  })

  test("WhatsApp availability and OTP paths use the typed client contracts", async () => {
    const { api, requests } = loginApiFixtureCreate((url) => {
      if (url.endsWith("/whatsapp-otp/availability?organizationId=org-1")) return { available: true }
      if (url.endsWith("/whatsapp-otp/start"))
        return { accepted: true, challengeId: "wa-challenge", expiresAt: 10, retryAt: 5 }
      if (url.endsWith("/whatsapp-otp/resend"))
        return { accepted: true, challengeId: "wa-challenge-2", expiresAt: 20, retryAt: 15 }
      return { authentication: { authenticatedAt: 1, realmId, userId: "user-1" } }
    })

    const availability = await api.whatsappOtpAvailabilityGet(realmId, "org-1")
    const started = await api.whatsappOtpStart(realmId, "+15551234567", "org-1")
    const resent = await api.whatsappOtpResend(realmId, "wa-challenge", "org-1")
    const verified = await api.whatsappOtpVerify(realmId, "wa-challenge-2", "123456", "org-1")

    expect(availability).toEqual({ data: { available: true }, success: true })
    expect(started.success).toBe(true)
    expect(resent.success).toBe(true)
    expect(verified.success).toBe(true)
    if (!verified.success) return
    expect(verified.data.session).toBeUndefined()
    expect(JSON.stringify(verified.data)).not.toContain("token")
    expect(requests.map((request) => request.url)).toEqual([
      `${baseUrl}/realms/${realmId}/whatsapp-otp/availability?organizationId=org-1`,
      `${baseUrl}/realms/${realmId}/whatsapp-otp/start`,
      `${baseUrl}/realms/${realmId}/whatsapp-otp/resend`,
      `${baseUrl}/realms/${realmId}/whatsapp-otp/verify`,
    ])
    for (const request of requests.slice(1)) {
      expect(request.init?.credentials).toBe("include")
      const headers = new Headers(request.init?.headers)
      expect(headers.get(sessionBrowserModeHeaderName)).toBe("true")
      expect(headers.get("authorization")).toBeNull()
    }
    expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({
      organizationId: "org-1",
      phoneNumber: "+15551234567",
    })
    expect(JSON.parse(String(requests[2]?.init?.body))).toEqual({
      challengeId: "wa-challenge",
      organizationId: "org-1",
    })
    expect(JSON.parse(String(requests[3]?.init?.body))).toEqual({
      challengeId: "wa-challenge-2",
      code: "123456",
      organizationId: "org-1",
    })
  })

  test("preserves WhatsApp resend retry metadata and Retry-After for login state", async () => {
    const api = loginApiCreate({
      baseUrl,
      fetch: async () =>
        Response.json(
          {
            error: {
              code: "rate_limited",
              details: { retryAfterSeconds: 19 },
              message: "Too many requests.",
              requestId: "wa-resend-request",
              retryable: true,
              status: 429,
            },
          },
          { headers: { "retry-after": "19" }, status: 429 },
        ),
    })

    const result = await api.whatsappOtpResend(realmId, "wa-challenge", "org-1")

    expect(result).toMatchObject({ code: "platform.rate-limited", statusCode: 429, success: false })
    if (!result.success) {
      expect(JSON.parse(result.errorData ?? "{}")).toMatchObject({
        retryAfter: "19",
        retryAfterSeconds: 19,
        status: 429,
      })
    }
  })
})
