import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { passwordApiClientCreate } from "../../src/features/passwords/client/passwordApiClientCreate.js"
import type { PasswordWhatsappAvailabilityPort } from "../../src/features/passwords/domain/passwordWhatsappAvailabilityPort.js"
import type { PasswordWhatsappDeliveryPort } from "../../src/features/passwords/domain/passwordWhatsappDeliveryPort.js"
import { passwordServerAppCreate } from "../../src/features/passwords/server/passwordServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { whatsappOtpApiClientCreate } from "../../src/features/whatsappOtp/client/whatsappOtpApiClientCreate.js"
import type { WhatsappOtpAvailabilityPort } from "../../src/features/whatsappOtp/domain/whatsappOtpAvailabilityPort.js"
import { whatsappOtpServerAppCreate } from "../../src/features/whatsappOtp/server/whatsappOtpServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const rateLimitSecret = "task-10-api-cli-secret"
const cliRealmId = "018bcfe5-6800-7010-9010-101010101010"
const cliUserId = "018bcfe5-6800-7010-9010-202020202020"

test("API clients complete WhatsApp registration and OTP availability/start/resend/verify behavior", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "whatsapp-api-behavior.example.com")
    let registrationCode = ""
    const registrationDelivery: PasswordWhatsappDeliveryPort = {
      sendText: async ({ text }) => {
        registrationCode = text.match(/(\d{6})/)?.[1] ?? ""
        return { data: undefined, success: true }
      },
    }
    const passwordApp = passwordServerAppCreate({
      clientIpResolve: () => "198.51.100.201",
      database,
      rateLimitSecret,
      whatsappAvailability: allowPasswordWhatsappCreate(),
      whatsappDelivery: registrationDelivery,
    })
    const passwordRequests: Array<{ body: unknown; method: string; url: string }> = []
    const passwordClient = passwordApiClientCreate({
      baseUrl: "https://whatsapp-api-behavior.example.com",
      fetch: async (input, init) => {
        passwordRequests.push({
          body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
          method: init?.method ?? "GET",
          url: input.toString(),
        })
        return passwordApp.request(input.toString(), init)
      },
    })

    const registered = await passwordClient.passwordRegister(realm.id, {
      email: "api-whatsapp@example.com",
      password: "Correct Horse 12",
      phoneNumber: " +14155552671 ",
      profile: { displayName: "API WhatsApp" },
      userName: "api-whatsapp",
      verificationMethod: "whatsapp",
    })
    expect(registered).toMatchObject({
      data: { accepted: true, verificationMethod: "whatsapp", verificationRequired: true },
      success: true,
    })
    expect(passwordRequests[0]).toMatchObject({
      body: {
        email: "api-whatsapp@example.com",
        password: "Correct Horse 12",
        phoneNumber: " +14155552671 ",
        profile: { displayName: "API WhatsApp" },
        userName: "api-whatsapp",
        verificationMethod: "whatsapp",
      },
      method: "POST",
      url: `https://whatsapp-api-behavior.example.com/realms/${realm.id}/password/register`,
    })
    expect(registrationCode).toHaveLength(6)
    if (!registered.success || registered.data.challengeId === undefined) return

    const verifiedRegistration = await passwordClient.passwordWhatsappVerify(realm.id, {
      challengeId: registered.data.challengeId,
      code: registrationCode,
    })
    expect(verifiedRegistration).toMatchObject({
      data: { user: { emailVerified: false, phoneNumber: "+14155552671", state: "active" } },
      success: true,
    })

    let otpCode = ""
    const otpApp = whatsappOtpServerAppCreate({
      clientIpResolve: () => "198.51.100.202",
      database,
      onDelivery: ({ code }) => {
        otpCode = code
      },
      rateLimitSecret,
      availability: allowWhatsappOtpCreate(),
    })
    const otpRequests: Array<{ body: unknown; method: string; url: string }> = []
    const otpClient = whatsappOtpApiClientCreate({
      baseUrl: "https://whatsapp-api-behavior.example.com",
      fetch: async (input, init) => {
        otpRequests.push({
          body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
          method: init?.method ?? "GET",
          url: input.toString(),
        })
        return otpApp.request(input.toString(), init)
      },
    })

    expect(await otpClient.whatsappOtpAvailabilityGet(realm.id, "organization/api")).toEqual({
      data: { available: true },
      success: true,
    })
    const started = await otpClient.whatsappOtpStart(realm.id, { phoneNumber: "+14155552671" })
    expect(started).toMatchObject({ data: { accepted: true }, success: true })
    if (!started.success) return
    const firstCode = otpCode

    const resent = await otpClient.whatsappOtpResend(realm.id, { challengeId: started.data.challengeId })
    expect(resent).toMatchObject({ data: { accepted: true }, success: true })
    if (!resent.success) return
    expect(resent.data.challengeId).toBe(started.data.challengeId)
    expect(otpCode).toHaveLength(6)

    const verifiedOtp = await otpClient.whatsappOtpVerify(realm.id, {
      challengeId: started.data.challengeId,
      code: firstCode,
    })
    expect(verifiedOtp).toMatchObject({
      data: { authentication: { realmId: realm.id }, session: { session: { authenticationMethod: "whatsapp_otp" } } },
      success: true,
    })
    expect(firstCode).toHaveLength(6)
    expect(otpRequests.map((request) => request.method)).toEqual(["GET", "POST", "POST", "POST"])
    expect(otpRequests[0]?.url).toBe(
      `https://whatsapp-api-behavior.example.com/realms/${realm.id}/whatsapp-otp/availability?organizationId=organization%2Fapi`,
    )
    expect(otpRequests.slice(1).map((request) => request.body)).toEqual([
      { phoneNumber: "+14155552671" },
      { challengeId: started.data.challengeId },
      { challengeId: started.data.challengeId, code: firstCode },
    ])
    expect(otpRequests.slice(1).map((request) => request.url)).toEqual([
      `https://whatsapp-api-behavior.example.com/realms/${realm.id}/whatsapp-otp/start`,
      `https://whatsapp-api-behavior.example.com/realms/${realm.id}/whatsapp-otp/resend`,
      `https://whatsapp-api-behavior.example.com/realms/${realm.id}/whatsapp-otp/verify`,
    ])
  })
})

test("API clients reject strict payloads before fetch and preserve exact rate-limit details", async () => {
  const requests: string[] = []
  const passwordClient = passwordApiClientCreate({
    baseUrl: "https://whatsapp-api-validation.example.com",
    fetch: async (input) => {
      requests.push(input.toString())
      return Response.json({})
    },
  })
  const otpClient = whatsappOtpApiClientCreate({
    baseUrl: "https://whatsapp-api-validation.example.com",
    fetch: async (input) => {
      requests.push(input.toString())
      return Response.json({})
    },
  })

  expect(
    await passwordClient.passwordRegister("realm", {
      email: "strict@example.com",
      password: "Correct Horse 12",
      profile: {},
      userName: "strict",
      unexpected: true,
    } as never),
  ).toMatchObject({ code: "passwords.invalid", errorMessage: "The registration request is invalid.", success: false })
  expect(
    await passwordClient.passwordWhatsappVerify("realm", {
      challengeId: "challenge",
      code: "123456",
      extra: true,
    } as never),
  ).toMatchObject({
    code: "passwords.invalid",
    errorMessage: "The WhatsApp verification code is invalid.",
    success: false,
  })
  expect(
    await otpClient.whatsappOtpStart("realm", { phoneNumber: "+14155552671", extra: true } as never),
  ).toMatchObject({
    code: "whatsapp-otp.invalid",
    errorMessage: "The WhatsApp OTP request is invalid.",
    success: false,
  })
  expect(await otpClient.whatsappOtpResend("realm", { challengeId: "" })).toMatchObject({
    code: "whatsapp-otp.invalid",
    success: false,
  })
  expect(await otpClient.whatsappOtpVerify("realm", { challengeId: "challenge", code: "12345" })).toMatchObject({
    code: "whatsapp-otp.invalid",
    errorMessage: "The WhatsApp OTP code is invalid.",
    success: false,
  })
  expect(requests).toEqual([])

  const rateLimited = await whatsappOtpApiClientCreate({
    baseUrl: "https://whatsapp-api-validation.example.com",
    fetch: async () =>
      Response.json(
        {
          error: {
            code: "rate_limited",
            details: { retryAfterSeconds: 23 },
            message: "Too many requests.",
            requestId: "validation-request",
            retryable: true,
            status: 429,
          },
        },
        { headers: { "retry-after": "23" }, status: 429 },
      ),
  }).whatsappOtpStart("realm", { phoneNumber: "+14155552671" })
  expect(rateLimited).toMatchObject({ code: "platform.rate-limited", statusCode: 429, success: false })
  if (!rateLimited.success) {
    expect(JSON.parse(rateLimited.errorData ?? "{}")).toMatchObject({
      requestId: "validation-request",
      retryAfter: "23",
      retryable: true,
      status: 429,
    })
  }
})

test("CLI executes WhatsApp registration and OTP commands and reports strict errors and 429s", async () => {
  const requests: Array<{ body: unknown; method: string; path: string }> = []
  let rateLimitedPath: string | undefined
  const server = Bun.serve({
    fetch: async (request) => {
      const url = new URL(request.url)
      const text = request.method === "GET" ? "" : await request.text()
      const body = text === "" ? undefined : JSON.parse(text)
      requests.push({ body, method: request.method, path: url.pathname })
      if (url.pathname === rateLimitedPath)
        return Response.json(
          {
            error: {
              code: "rate_limited",
              message: "Too many requests.",
              requestId: "cli-rate-limit",
              retryable: true,
              status: 429,
            },
          },
          { headers: { "retry-after": "60" }, status: 429 },
        )
      if (url.pathname.endsWith("/whatsapp-otp/availability")) return Response.json({ available: true })
      if (url.pathname.endsWith("/password/register"))
        return Response.json({
          accepted: true,
          challengeId: "cli-registration-challenge",
          expiresAt: 1_700_000_600_000,
          retryAt: 1_700_000_060_000,
          verificationMethod: "whatsapp",
          verificationRequired: true,
        })
      if (url.pathname.endsWith("/password/verify-whatsapp")) return Response.json({ user: cliUser() })
      if (url.pathname.endsWith("/whatsapp-otp/start"))
        return Response.json({
          accepted: true,
          challengeId: "cli-otp-challenge",
          expiresAt: 1_700_000_600_000,
          retryAt: 1_700_000_060_000,
        })
      if (url.pathname.endsWith("/whatsapp-otp/resend"))
        return Response.json({
          accepted: true,
          challengeId: "cli-otp-resend",
          expiresAt: 1_700_000_600_000,
          retryAt: 1_700_000_060_000,
        })
      if (url.pathname.endsWith("/whatsapp-otp/verify"))
        return Response.json({
          authentication: { authenticatedAt: 1_700_000_000_000, realmId: cliRealmId, userId: cliUserId },
        })
      return new Response("not found", { status: 404 })
    },
    port: 0,
  })

  try {
    const serverUrl = server.url.toString()
    const register = await cliRun(
      serverUrl,
      "passwords",
      "register",
      "--realm-id",
      cliRealmId,
      "--email",
      "cli@example.com",
      "--password",
      "Correct Horse 12",
      "--user-name",
      "cli",
      "--phone-number",
      "+14155552671",
      "--verification-method",
      "whatsapp",
    )
    expect(register).toMatchObject({ exitCode: 0, stderr: "" })
    expect(JSON.parse(register.stdout)).toMatchObject({ challengeId: "cli-registration-challenge" })

    const verifyRegistration = await cliRun(
      serverUrl,
      "passwords",
      "verify-whatsapp",
      "--realm-id",
      cliRealmId,
      "--challenge-id",
      "cli-registration-challenge",
      "--code",
      "123456",
    )
    expect(verifyRegistration).toMatchObject({ exitCode: 0, stderr: "" })
    expect(JSON.parse(verifyRegistration.stdout)).toMatchObject({ user: { phoneNumber: "+14155552671" } })

    const availability = await cliRun(
      serverUrl,
      "whatsapp-otp",
      "availability",
      "--realm-id",
      cliRealmId,
      "--organization-id",
      "organization-cli",
    )
    expect(availability).toMatchObject({ exitCode: 0, stderr: "" })
    expect(JSON.parse(availability.stdout)).toEqual({ available: true })
    const start = await cliRun(
      serverUrl,
      "whatsapp-otp",
      "start",
      "--realm-id",
      cliRealmId,
      "--phone-number",
      "+14155552671",
    )
    expect(start).toMatchObject({ exitCode: 0, stderr: "" })
    const resend = await cliRun(
      serverUrl,
      "whatsapp-otp",
      "resend",
      "--realm-id",
      cliRealmId,
      "--challenge-id",
      "cli-otp-challenge",
    )
    expect(resend).toMatchObject({ exitCode: 0, stderr: "" })
    const verify = await cliRun(
      serverUrl,
      "whatsapp-otp",
      "verify",
      "--realm-id",
      cliRealmId,
      "--challenge-id",
      "cli-otp-resend",
      "--code",
      "123456",
    )
    expect(verify).toMatchObject({ exitCode: 0, stderr: "" })
    expect(JSON.parse(verify.stdout)).toMatchObject({ authentication: { realmId: cliRealmId } })
    expect(requests.find((request) => request.path.endsWith("/password/register"))?.body).toEqual({
      email: "cli@example.com",
      password: "Correct Horse 12",
      phoneNumber: "+14155552671",
      profile: {},
      userName: "cli",
      verificationMethod: "whatsapp",
    })
    expect(requests.find((request) => request.path.endsWith("/password/verify-whatsapp"))?.body).toEqual({
      challengeId: "cli-registration-challenge",
      code: "123456",
    })
    expect(requests.find((request) => request.path.endsWith("/whatsapp-otp/start"))?.body).toEqual({
      phoneNumber: "+14155552671",
    })
    expect(requests.find((request) => request.path.endsWith("/whatsapp-otp/resend"))?.body).toEqual({
      challengeId: "cli-otp-challenge",
    })
    expect(requests.find((request) => request.path.endsWith("/whatsapp-otp/verify"))?.body).toEqual({
      challengeId: "cli-otp-resend",
      code: "123456",
    })

    const requestCountBeforeValidation = requests.length
    const invalidRegistration = await cliRun(
      serverUrl,
      "passwords",
      "register",
      "--realm-id",
      cliRealmId,
      "--email",
      "invalid@example.com",
      "--password",
      "Correct Horse 12",
      "--user-name",
      "invalid",
      "--verification-method",
      "whatsapp",
    )
    expect(invalidRegistration).toEqual({ exitCode: 1, stderr: "The registration request is invalid.\n", stdout: "" })
    expect(requests).toHaveLength(requestCountBeforeValidation)
    const invalidOtp = await cliRun(
      serverUrl,
      "whatsapp-otp",
      "start",
      "--realm-id",
      cliRealmId,
      "--phone-number",
      "12",
    )
    expect(invalidOtp).toEqual({ exitCode: 1, stderr: "The WhatsApp OTP request is invalid.\n", stdout: "" })
    expect(requests).toHaveLength(requestCountBeforeValidation)

    const missingChallenge = await cliRun(serverUrl, "whatsapp-otp", "resend", "--realm-id", cliRealmId)
    expect(missingChallenge.exitCode).not.toBe(0)
    expect(missingChallenge.stderr).toBe("Expected input for flag --challenge-id\n")
    expect(missingChallenge.stdout).toBe("")
    expect(requests).toHaveLength(requestCountBeforeValidation)

    rateLimitedPath = `/realms/${cliRealmId}/whatsapp-otp/start`
    const limited = await cliRun(
      serverUrl,
      "whatsapp-otp",
      "start",
      "--realm-id",
      cliRealmId,
      "--phone-number",
      "+14155552671",
    )
    expect(limited).toEqual({ exitCode: 1, stderr: "Too many requests.\n", stdout: "" })
    expect(requests.at(-1)).toMatchObject({ method: "POST", path: rateLimitedPath })
  } finally {
    server.stop(true)
  }
})

async function cliRun(
  server: string,
  ...arguments_: string[]
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  const child = Bun.spawn(["bun", "src/outputs/cli.ts", ...arguments_, "--server", server], {
    env: { ...process.env, AUTHWORKS_URL: undefined },
    stderr: "pipe",
    stdout: "pipe",
  })
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ])
  return { exitCode, stderr, stdout }
}

function cliUser() {
  return {
    createdAt: 1_700_000_000_000,
    email: "cli@example.com",
    emailVerified: false,
    id: cliUserId,
    phoneNumber: "+14155552671",
    phoneNumberVerifiedAt: 1_700_000_000_000,
    realmId: cliRealmId,
    profile: {},
    registrationVerifiedAt: 1_700_000_000_000,
    registrationVerificationMethod: "whatsapp",
    state: "active",
    updatedAt: 1_700_000_000_000,
    userName: "cli",
    verificationState: "verified",
  }
}

function allowPasswordWhatsappCreate(): PasswordWhatsappAvailabilityPort {
  return { whatsappOtpAvailabilityGet: () => ({ data: { available: true }, success: true }) }
}

function allowWhatsappOtpCreate(): WhatsappOtpAvailabilityPort {
  return { whatsappOtpAvailabilityGet: () => ({ data: { available: true }, success: true }) }
}

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-whatsapp-task10-api-cli-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}
