import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { passwordWhatsappVerify } from "../../src/features/passwords/actions/passwordWhatsappVerify.js"
import { passwordApiClientCreate } from "../../src/features/passwords/client/passwordApiClientCreate.js"
import type { PasswordWhatsappAvailabilityPort } from "../../src/features/passwords/domain/passwordWhatsappAvailabilityPort.js"
import type { PasswordWhatsappDeliveryPort } from "../../src/features/passwords/domain/passwordWhatsappDeliveryPort.js"
import { passwordServerAppCreate } from "../../src/features/passwords/server/passwordServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionPasswordCreate } from "../../src/features/sessions/actions/sessionPasswordCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase, now: () => number) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-passwords-whatsapp-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data, () => testkit.runtime.now())
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function withDatabasePair<T>(operation: (first: StorageDatabase, second: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-passwords-whatsapp-pair-"))
  const testkit = platformTestkitCreate()
  const path = join(directory, "authworks.sqlite")
  const first = storageDatabaseOpen(path, testkit.runtime)
  expect(first.success).toBe(true)
  if (!first.success) throw new Error(first.errorMessage)
  const second = storageDatabaseOpen(path, testkit.runtime)
  expect(second.success).toBe(true)
  if (!second.success) {
    first.data.close()
    throw new Error(second.errorMessage)
  }
  try {
    return await operation(first.data, second.data)
  } finally {
    first.data.close()
    second.data.close()
    await rm(directory, { force: true, recursive: true })
  }
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

function whatsappRegistrationInput(
  email = "whatsapp@example.com",
  userName = email.split("@")[0] ?? "whatsapp",
  phoneNumber = " +14155552671 ",
) {
  return {
    email,
    password: "Correct Horse 12",
    phoneNumber,
    profile: { displayName: "WhatsApp User" },
    userName,
    verificationMethod: "whatsapp" as const,
  }
}

function passwordWhatsappAvailabilityAllowCreate(): PasswordWhatsappAvailabilityPort {
  return {
    whatsappOtpAvailabilityGet: () => ({ data: { available: true }, success: true }),
  }
}

test("WhatsApp registration keeps existing email, userName, and phone collisions indistinguishable", async () => {
  await withDatabase(async (database, nowGet) => {
    const realm = await createRealm(database, "passwords-whatsapp-enumeration.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    const systemContext = realmSystemContextCreate("system")

    expect(
      passwordRegister({
        context,
        database,
        input: {
          email: "existing-email@example.com",
          password: "Correct Horse 12",
          profile: { displayName: "Existing email" },
          userName: "existing-email-owner",
        },
        realmId: realm.id,
      }).success,
    ).toBe(true)
    expect(
      passwordRegister({
        context,
        database,
        input: {
          email: "existing-name@example.com",
          password: "Correct Horse 12",
          profile: { displayName: "Existing name" },
          userName: "existing-name-owner",
        },
        realmId: realm.id,
      }).success,
    ).toBe(true)
    expect(
      userCreate({
        context: systemContext,
        database,
        input: {
          email: "existing-phone@example.com",
          phoneNumber: " +14155552671 ",
          profile: { displayName: "Existing phone" },
          userName: "existing-phone-owner",
        },
        realmId: realm.id,
      }).success,
    ).toBe(true)

    let deliveries = 0
    const delivery: PasswordWhatsappDeliveryPort = {
      async sendText() {
        deliveries += 1
        return { data: undefined, success: true }
      },
    }
    const inputOptions = {
      rateLimitSecret: "test-secret",
      realmId: realm.id,
      whatsappAvailability: passwordWhatsappAvailabilityAllowCreate(),
      whatsappDelivery: delivery,
    } as const
    const cases = [
      {
        input: whatsappRegistrationInput("existing-email@example.com", "new-email-collision", "+14155552672"),
        clientIp: "198.51.100.20",
      },
      {
        input: whatsappRegistrationInput("new-name-collision@example.com", "existing-name-owner", "+14155552673"),
        clientIp: "198.51.100.21",
      },
      {
        input: whatsappRegistrationInput("new-phone-collision@example.com", "new-phone-collision", " +14155552671 "),
        clientIp: "198.51.100.22",
      },
      {
        input: whatsappRegistrationInput("new-whatsapp@example.com", "new-whatsapp", "+14155552674"),
        clientIp: "198.51.100.23",
      },
    ] as const

    const firstResults = cases.map(({ clientIp, input }) =>
      passwordRegister({
        ...inputOptions,
        clientIp,
        context,
        database,
        input,
      }),
    )
    const responseKeys = [
      "accepted",
      "challengeId",
      "expiresAt",
      "retryAt",
      "verificationMethod",
      "verificationRequired",
    ]
    for (const result of firstResults) {
      expect(result.success).toBe(true)
      if (!result.success) continue
      expect(Object.keys(result.data).sort()).toEqual(responseKeys.sort())
      expect(result.data).toMatchObject({
        accepted: true,
        expiresAt: nowGet() + 10 * 60_000,
        retryAt: nowGet() + 60_000,
        verificationMethod: "whatsapp",
        verificationRequired: true,
      })
      expect(result.data.challengeId).toEqual(expect.any(String))
    }

    for (const { clientIp, input } of cases) {
      const repeated = passwordRegister({
        ...inputOptions,
        clientIp,
        context,
        database,
        input,
      })
      expect(repeated.success).toBe(true)
      if (!repeated.success) continue
      expect(repeated.data).toMatchObject({
        accepted: true,
        verificationMethod: "whatsapp",
        verificationRequired: true,
      })
    }

    expect(deliveries).toBe(1)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 4 })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM password_registration_challenges").get()).toEqual({
      count: 5,
    })
    expect(
      database.sqlite
        .query("SELECT COUNT(*) AS count FROM events WHERE event_type = 'password.whatsapp_verification_requested'")
        .get(),
    ).toEqual({ count: 1 })
    expect(
      database.sqlite
        .query("SELECT COUNT(*) AS count FROM password_registration_challenges WHERE user_id IS NULL")
        .get(),
    ).toEqual({ count: 4 })
  })
})

test("duplicate WhatsApp registration reuses one HMAC-keyed decoy across IPs during cooldown", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-whatsapp-decoy.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    const existing = userCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: {
        email: "decoy-existing@example.com",
        phoneNumber: "+14155552671",
        profile: { displayName: "Existing" },
        userName: "decoy-existing",
      },
      realmId: realm.id,
    })
    expect(existing.success).toBe(true)
    const beforeEvents = (database.sqlite.query("SELECT COUNT(*) AS count FROM events").get() as { count: number })
      .count
    let deliveries = 0
    const input = whatsappRegistrationInput("decoy-existing@example.com", "new-name", "+14155552671")
    const register = (clientIp: string) =>
      passwordRegister({
        clientIp,
        context,
        database,
        input,
        rateLimitSecret: "test-secret",
        realmId: realm.id,
        whatsappAvailability: passwordWhatsappAvailabilityAllowCreate(),
        whatsappDelivery: {
          sendText: async () => {
            deliveries += 1
            return { data: undefined, success: true as const }
          },
        },
      })

    const responses = [
      register("198.51.100.30"),
      register("198.51.100.31"),
      register("198.51.100.32"),
      register("198.51.100.33"),
      register("198.51.100.34"),
    ]
    expect(responses.every((response) => response.success)).toBe(true)
    expect(responses[1]).toEqual(responses[0])
    expect(responses[4]).toEqual(responses[0])
    expect(register("198.51.100.35")).toMatchObject({ code: "passwords.rate-limited", success: false })
    expect(deliveries).toBe(0)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 1 })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: beforeEvents })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM password_registration_challenges").get()).toEqual({
      count: 1,
    })
    const challenge = database.sqlite
      .query("SELECT identity_hash, user_id, code_hash FROM password_registration_challenges")
      .get() as { code_hash: string; identity_hash: string; user_id: string | null }
    expect(challenge.user_id).toBeNull()
    expect(challenge.identity_hash).toEqual(expect.any(String))
    expect(challenge.identity_hash).not.toContain("decoy-existing@example.com")
    expect(challenge.identity_hash).not.toContain("+14155552671")
    expect(challenge.code_hash).not.toContain("123456")
  })
})

test("concurrent new WhatsApp registration losers return the persisted decoy response", async () => {
  await withDatabasePair(async (first, second) => {
    const realm = await createRealm(first, "passwords-whatsapp-concurrent-registration.example.com")
    const input = whatsappRegistrationInput("concurrent-registration@example.com", "concurrent-registration")
    let deliveries = 0
    const register = (database: StorageDatabase, clientIp: string) =>
      passwordRegister({
        clientIp,
        context: realmTenantContextCreate(realm.id, "anonymous"),
        database,
        input,
        rateLimitSecret: "test-secret",
        realmId: realm.id,
        whatsappAvailability: passwordWhatsappAvailabilityAllowCreate(),
        whatsappDelivery: {
          sendText: async () => {
            deliveries += 1
            return { data: undefined, success: true as const }
          },
        },
      })
    const results = await Promise.all([
      Promise.resolve().then(() => register(first, "198.51.100.60")),
      Promise.resolve().then(() => register(second, "198.51.100.61")),
    ])

    expect(results.every((result) => result.success)).toBe(true)
    expect(deliveries).toBe(1)
    expect(first.sqlite.query("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 1 })
    expect(first.sqlite.query("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: 4 })
    expect(first.sqlite.query("SELECT COUNT(*) AS count FROM password_registration_challenges").get()).toEqual({
      count: 2,
    })
    expect(
      first.sqlite.query("SELECT COUNT(*) AS count FROM password_registration_challenges WHERE user_id IS NULL").get(),
    ).toEqual({ count: 1 })
  })
})

test("WhatsApp registration stores only a hashed challenge, delivers after commit, and verifies phone state", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-whatsapp-action.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    const whatsappAvailability = passwordWhatsappAvailabilityAllowCreate()
    let code = ""
    let deliverySawCommittedRows = false
    const delivery: PasswordWhatsappDeliveryPort = {
      async sendText(input) {
        code = input.text.match(/(\d{6})/)?.[1] ?? ""
        deliverySawCommittedRows =
          (database.sqlite.query("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count === 1 &&
          (
            database.sqlite.query("SELECT COUNT(*) AS count FROM password_registration_challenges").get() as {
              count: number
            }
          ).count === 1
        return { data: undefined, success: true }
      },
    }
    const registered = passwordRegister({
      clientIp: "198.51.100.10",
      context,
      database,
      input: whatsappRegistrationInput(),
      rateLimitSecret: "test-secret",
      realmId: realm.id,
      whatsappAvailability,
      whatsappDelivery: delivery,
    })
    expect(registered).toMatchObject({
      data: {
        accepted: true,
        verificationMethod: "whatsapp",
        verificationRequired: true,
      },
      success: true,
    })
    expect(deliverySawCommittedRows).toBe(true)
    expect(code).toHaveLength(6)
    const challenge = database.sqlite
      .query("SELECT code_hash, attempts, cooldown_until, expires_at FROM password_registration_challenges")
      .get() as {
      attempts: number
      code_hash: string
      cooldown_until: number
      expires_at: number
    }
    expect(challenge.code_hash).not.toContain(code)
    expect(challenge.attempts).toBe(0)
    expect(challenge.cooldown_until).toBe(database.runtime.now() + 60_000)
    expect(challenge.expires_at).toBe(database.runtime.now() + 10 * 60_000)

    if (!registered.success || registered.data.challengeId === undefined) return
    const missingSecret = passwordWhatsappVerify({
      clientIp: "198.51.100.10",
      context,
      database,
      input: { challengeId: registered.data.challengeId, code },
      realmId: realm.id,
    })
    expect(missingSecret).toMatchObject({
      code: "platform.configuration-invalid",
      errorMessage: "WhatsApp registration rate limiting requires AUTHWORKS_SYSTEM_SECRET.",
      success: false,
    })
    const verified = passwordWhatsappVerify({
      clientIp: "198.51.100.10",
      context,
      database,
      input: { challengeId: registered.data.challengeId, code },
      rateLimitSecret: "test-secret",
      realmId: realm.id,
    })
    expect(verified).toMatchObject({
      data: { user: { emailVerified: false, phoneNumber: "+14155552671", state: "active" } },
      success: true,
    })
    expect(
      database.sqlite
        .query(
          "SELECT phone_number_verified_at, registration_verified_at, registration_verification_method, email_verified_at, version FROM users",
        )
        .get(),
    ).toMatchObject({
      email_verified_at: null,
      registration_verification_method: "whatsapp",
      version: 3,
    })
    const user = database.sqlite.query("SELECT id FROM users WHERE realm_id = ?").get(realm.id) as { id: string }
    const userEvents = database.sqlite
      .query(
        "SELECT aggregate_version FROM events WHERE aggregate_type = 'user' AND aggregate_id = ? ORDER BY position",
      )
      .all(user.id) as Array<{ aggregate_version: number }>
    expect(userEvents.map((event) => event.aggregate_version)).toEqual([1, 2, 3])
    const loggedIn = passwordLogin({
      context,
      database,
      input: { identifier: "whatsapp", password: "Correct Horse 12" },
      realmId: realm.id,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(loggedIn.success).toBe(true)
    if (loggedIn.success) expect(loggedIn.data.session?.session.authenticationMethod).toBe("password")
  })
})

test("WhatsApp registration fails closed without a server rate-limit secret", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-whatsapp-missing-secret.example.com")
    const registered = passwordRegister({
      clientIp: "198.51.100.13",
      context: realmTenantContextCreate(realm.id, "anonymous"),
      database,
      input: whatsappRegistrationInput(),
      realmId: realm.id,
      whatsappAvailability: passwordWhatsappAvailabilityAllowCreate(),
      whatsappDelivery: { sendText: async () => ({ data: undefined, success: true }) },
    })
    expect(registered).toMatchObject({
      code: "platform.configuration-invalid",
      errorMessage: "WhatsApp registration rate limiting requires AUTHWORKS_SYSTEM_SECRET.",
      success: false,
    })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 0 })
  })
})

test("WhatsApp registration route and client return rate limits with Retry-After", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-whatsapp-route.example.com")
    let verificationCode = ""
    const delivery: PasswordWhatsappDeliveryPort = {
      async sendText(input) {
        verificationCode = input.text.match(/(\d{6})/)?.[1] ?? ""
        return { data: undefined, success: true }
      },
    }
    const app = passwordServerAppCreate({
      clientIpResolve: () => "198.51.100.11",
      database,
      rateLimitSecret: "test-secret",
      whatsappAvailability: passwordWhatsappAvailabilityAllowCreate(),
      whatsappDelivery: delivery,
    })
    const client = passwordApiClientCreate({
      baseUrl: "https://passwords-whatsapp-route.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
    })
    const first = await client.passwordRegister(realm.id, whatsappRegistrationInput())
    expect(first.success).toBe(true)
    if (!first.success || first.data.challengeId === undefined) return
    const registerRequest = (email: string) =>
      app.request(`https://passwords-whatsapp-route.example.com/realms/${realm.id}/password/register`, {
        body: JSON.stringify(whatsappRegistrationInput(email)),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    for (const email of ["second@example.com", "third@example.com", "fourth@example.com", "fifth@example.com"]) {
      const accepted = await registerRequest(email)
      expect(accepted.status).toBe(200)
      expect(await accepted.json()).toMatchObject({ accepted: true })
    }
    const throttledResponse = await registerRequest("sixth@example.com")
    expect(throttledResponse.status).toBe(429)
    expect(Number(throttledResponse.headers.get("retry-after"))).toBeGreaterThan(0)
    expect(await throttledResponse.json()).toMatchObject({ error: { code: "rate_limited", status: 429 } })

    const invalidCode = verificationCode === "000000" ? "111111" : "000000"
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const invalid = await client.passwordWhatsappVerify(realm.id, {
        challengeId: first.data.challengeId,
        code: invalidCode,
      })
      expect(invalid).toMatchObject({ code: "passwords.invalid", statusCode: 400, success: false })
    }
    const verifyThrottledResponse = await app.request(
      `https://passwords-whatsapp-route.example.com/realms/${realm.id}/password/verify-whatsapp`,
      {
        body: JSON.stringify({ challengeId: first.data.challengeId, code: invalidCode }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(verifyThrottledResponse.status).toBe(429)
    expect(Number(verifyThrottledResponse.headers.get("retry-after"))).toBeGreaterThan(0)
    expect(await verifyThrottledResponse.json()).toMatchObject({ error: { code: "rate_limited", status: 429 } })

    const verifyClientResult = await client.passwordWhatsappVerify(realm.id, {
      challengeId: first.data.challengeId,
      code: invalidCode,
    })
    expect(verifyClientResult).toMatchObject({ code: "platform.rate-limited", statusCode: 429, success: false })
  })
})

test("WhatsApp registration verification consumes five invalid attempts", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-whatsapp-attempts.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    const whatsappAvailability = passwordWhatsappAvailabilityAllowCreate()
    let challengeId = ""
    let code = ""
    const registered = passwordRegister({
      clientIp: "198.51.100.12",
      context,
      database,
      input: whatsappRegistrationInput(),
      rateLimitSecret: "test-secret",
      realmId: realm.id,
      whatsappAvailability,
      whatsappDelivery: {
        async sendText(input) {
          code = input.text.match(/(\d{6})/)?.[1] ?? ""
          return { data: undefined, success: true }
        },
      },
    })
    expect(registered.success).toBe(true)
    if (!registered.success || registered.data.challengeId === undefined) return
    challengeId = registered.data.challengeId
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        passwordWhatsappVerify({
          clientIp: `198.51.100.${20 + attempt}`,
          context,
          database,
          input: { challengeId, code: code === "000000" ? "111111" : "000000" },
          rateLimitSecret: "test-secret",
          realmId: realm.id,
        }).success,
      ).toBe(false)
    }
    database.runtime.now()
    expect(
      database.sqlite.query("SELECT attempts, consumed_at FROM password_registration_challenges").get(),
    ).toMatchObject({
      attempts: 5,
    })
  })
})

test("password CLI exposes WhatsApp registration and verification flags", async () => {
  const registerProcess = Bun.spawn(["bun", "src/outputs/cli.ts", "passwords", "register", "--help"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const registerHelp = await new Response(registerProcess.stdout).text()
  expect(await registerProcess.exited).toBe(0)
  expect(registerHelp).toContain("--verification-method email|whatsapp")
  expect(registerHelp).toContain("--phone-number")

  const verifyProcess = Bun.spawn(["bun", "src/outputs/cli.ts", "passwords", "verify-whatsapp", "--help"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const verifyHelp = await new Response(verifyProcess.stdout).text()
  expect(await verifyProcess.exited).toBe(0)
  expect(verifyHelp).toContain("--challenge-id")
  expect(verifyHelp).toContain("--code")

  const invalidProcess = Bun.spawn(
    [
      "bun",
      "src/outputs/cli.ts",
      "passwords",
      "register",
      "--email",
      "invalid-method@example.com",
      "--password",
      "Correct Horse 12",
      "--user-name",
      "invalid-method",
      "--verification-method",
      "sms",
    ],
    { stderr: "pipe", stdout: "pipe" },
  )
  const invalidStderr = await new Response(invalidProcess.stderr).text()
  expect(await invalidProcess.exited).not.toBe(0)
  expect(invalidStderr).toContain('Failed to parse "sms"')
  expect(invalidStderr).toContain("email|whatsapp")
})
