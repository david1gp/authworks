import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationLoginPolicySet } from "../../src/features/organizations/actions/organizationLoginPolicySet.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { userRepositoryCreate } from "../../src/features/users/persistence/userRepositoryCreate.js"
import { wahaHealthCandidateRepositoryCreate } from "../../src/features/waha/persistence/wahaHealthCandidateRepositoryCreate.js"
import { wahaHealthCandidateReaderCreate } from "../../src/features/waha/server/wahaHealthCandidateReaderCreate.js"
import type { WahaConfiguration } from "../../src/features/waha/server/wahaConfiguration.js"
import { wahaHealthRegistryCreate } from "../../src/features/waha/server/wahaHealthRegistryCreate.js"
import { whatsappOtpResend } from "../../src/features/whatsappOtp/actions/whatsappOtpResend.js"
import { whatsappOtpStart } from "../../src/features/whatsappOtp/actions/whatsappOtpStart.js"
import { whatsappOtpVerify } from "../../src/features/whatsappOtp/actions/whatsappOtpVerify.js"
import { whatsappOtpApiClientCreate } from "../../src/features/whatsappOtp/client/whatsappOtpApiClientCreate.js"
import type { WhatsappOtpAvailabilityPort } from "../../src/features/whatsappOtp/domain/whatsappOtpAvailabilityPort.js"
import { whatsappOtpAvailabilityCreate } from "../../src/features/whatsappOtp/server/whatsappOtpAvailabilityCreate.js"
import { whatsappOtpAvailabilityPredicate } from "../../src/features/whatsappOtp/domain/whatsappOtpAvailabilityPredicate.js"
import { whatsappOtpServerAppCreate } from "../../src/features/whatsappOtp/server/whatsappOtpServerAppCreate.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const configuration: WahaConfiguration = {
  endpoints: [{ client: { baseUrl: "https://waha.example.test" }, id: "primary" }],
  freshnessTtlMs: 60_000,
  refreshIntervalMs: 30_000,
}

test("WhatsApp availability predicate requires every input", () => {
  expect(whatsappOtpAvailabilityPredicate({ configured: true, freshHealthyCandidate: true, policyEnabled: true })).toBe(
    true,
  )
  for (const input of [
    { configured: false, freshHealthyCandidate: true, policyEnabled: true },
    { configured: true, freshHealthyCandidate: false, policyEnabled: true },
    { configured: true, freshHealthyCandidate: true, policyEnabled: false },
  ]) {
    expect(whatsappOtpAvailabilityPredicate(input)).toBe(false)
  }
})

test("WhatsApp availability requires configuration, policy, and a fresh configured candidate", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "whatsapp-availability.example.com")
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const reader = wahaHealthCandidateReaderCreate({ repository })
    const availability = whatsappOtpAvailabilityCreate({
      configuration,
      database,
      reader,
      runtime: testkit.runtime,
    })

    expect(
      whatsappOtpAvailabilityCreate({ database, reader, runtime: testkit.runtime }).whatsappOtpAvailabilityGet({
        realmId: realm.id,
      }),
    ).toEqual({ data: { available: false }, success: true })
    expect(availability.whatsappOtpAvailabilityGet({ realmId: realm.id })).toEqual({
      data: { available: false },
      success: true,
    })

    const now = testkit.runtime.now()
    expect(
      repository.wahaHealthCandidateCreate({
        checkedAt: now,
        createdAt: now,
        endpointId: "unconfigured",
        expiresAt: now + configuration.freshnessTtlMs,
        failureAt: null,
        failureCode: null,
        failureMessage: null,
        sessionName: "default",
        status: "healthy",
        updatedAt: now,
        version: 1,
      }),
    ).toMatchObject({ success: true })
    expect(availability.whatsappOtpAvailabilityGet({ realmId: realm.id })).toEqual({
      data: { available: false },
      success: true,
    })

    expect(
      repository.wahaHealthCandidateCreate({
        checkedAt: now,
        createdAt: now,
        endpointId: "primary",
        expiresAt: now,
        failureAt: null,
        failureCode: null,
        failureMessage: null,
        sessionName: "stale",
        status: "healthy",
        updatedAt: now,
        version: 1,
      }),
    ).toMatchObject({ success: true })
    expect(availability.whatsappOtpAvailabilityGet({ realmId: realm.id })).toEqual({
      data: { available: false },
      success: true,
    })

    expect(
      repository.wahaHealthCandidateCreate({
        checkedAt: now,
        createdAt: now,
        endpointId: "primary",
        expiresAt: now + configuration.freshnessTtlMs,
        failureAt: null,
        failureCode: null,
        failureMessage: null,
        sessionName: "working",
        status: "healthy",
        updatedAt: now,
        version: 1,
      }),
    ).toMatchObject({ success: true })
    expect(availability.whatsappOtpAvailabilityGet({ realmId: realm.id })).toEqual({
      data: { available: true },
      success: true,
    })
  })
})

test("WhatsApp availability ignores a persisted recipient session after sender filtering refreshes", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "whatsapp-availability-sender-filter.example.com")
    const endpointConfiguration: WahaConfiguration = {
      ...configuration,
      endpoints: [{ ...configuration.endpoints[0]!, senderSessions: ["sender"] }],
    }
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const now = testkit.runtime.now()
    expect(
      repository.wahaHealthCandidateCreate({
        checkedAt: now,
        createdAt: now,
        endpointId: "primary",
        expiresAt: now + endpointConfiguration.freshnessTtlMs,
        failureAt: null,
        failureCode: null,
        failureMessage: null,
        sessionName: "recipient",
        status: "healthy",
        updatedAt: now,
        version: 1,
      }),
    ).toMatchObject({ success: true })
    const registry = wahaHealthRegistryCreate({
      configuration: endpointConfiguration,
      healthPort: {
        check: async () => resultCreate({ sessions: [{ name: "recipient", status: "WORKING" }], status: "ok" }),
      },
      repository,
      runtime: testkit.runtime,
    })
    expect(await registry.refresh()).toMatchObject({ success: true })

    const availability = whatsappOtpAvailabilityCreate({
      configuration: endpointConfiguration,
      database,
      reader: wahaHealthCandidateReaderCreate({ repository }),
      runtime: testkit.runtime,
    })
    expect(availability.whatsappOtpAvailabilityGet({ realmId: realm.id })).toEqual({
      data: { available: false },
      success: true,
    })
  })
})

test("WhatsApp availability follows realm and organization policy without exposing internals", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "whatsapp-availability-policy.example.com")
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Availability policy organization" },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const reader = wahaHealthCandidateReaderCreate({ repository })
    const now = testkit.runtime.now()
    expect(
      repository.wahaHealthCandidateCreate({
        checkedAt: now,
        createdAt: now,
        endpointId: "primary",
        expiresAt: now + 60_000,
        failureAt: null,
        failureCode: null,
        failureMessage: null,
        sessionName: "working",
        status: "healthy",
        updatedAt: now,
        version: 1,
      }),
    ).toMatchObject({ success: true })
    const availability = whatsappOtpAvailabilityCreate({
      configuration,
      database,
      reader,
      runtime: testkit.runtime,
    })
    const app = whatsappOtpServerAppCreate({ database, availability })
    const url = `https://whatsapp-availability-policy.example.com/realms/${realm.id}/whatsapp-otp/availability`

    const enabled = await app.request(`${url}?organizationId=${organization.data.organization.id}`)
    expect(enabled.status).toBe(200)
    expect(await enabled.json()).toEqual({ available: true })

    const disabled = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowWhatsappOtp: false },
      organizationId: organization.data.organization.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(disabled.success).toBe(true)
    const unavailable = await app.request(`${url}?organizationId=${organization.data.organization.id}`)
    expect(unavailable.status).toBe(200)
    const body = await unavailable.json()
    expect(body).toEqual({ available: false })
    expect(Object.keys(body as object)).toEqual(["available"])
  })
})

test("WhatsApp mutations use the same unavailable result before persistence", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "whatsapp-availability-mutations.example.com")
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const reader = wahaHealthCandidateReaderCreate({ repository })
    const availability = whatsappOtpAvailabilityCreate({
      configuration,
      database,
      reader,
      runtime: testkit.runtime,
    })
    const context = realmTenantContextCreate(realm.id, "anonymous")
    const bypassedStart = whatsappOtpStart({
      context,
      database,
      input: { phoneNumber: "+14155552671" },
      realmId: realm.id,
      runtime: testkit.runtime,
    } as unknown as Parameters<typeof whatsappOtpStart>[0])
    expect(bypassedStart).toMatchObject({ code: "whatsapp-otp.unavailable", success: false })

    const bypassedRegistration = passwordRegister({
      context,
      database,
      input: {
        email: "whatsapp-availability-bypass@example.com",
        password: "Correct Horse 12",
        phoneNumber: "+14155552671",
        profile: { displayName: "WhatsApp availability bypass" },
        userName: "whatsapp-availability-bypass",
        verificationMethod: "whatsapp",
      },
      realmId: realm.id,
      runtime: testkit.runtime,
    } as unknown as Parameters<typeof passwordRegister>[0])
    expect(bypassedRegistration).toMatchObject({ code: "passwords.whatsapp-unavailable", success: false })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 0 })

    const started = whatsappOtpStart({
      availability,
      context,
      database,
      input: { phoneNumber: "+14155552671" },
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(started).toMatchObject({ code: "whatsapp-otp.unavailable", success: false })

    const registered = passwordRegister({
      context,
      database,
      input: {
        email: "whatsapp-availability-registration@example.com",
        password: "Correct Horse 12",
        phoneNumber: "+14155552671",
        profile: { displayName: "WhatsApp availability" },
        userName: "whatsapp-availability-registration",
        verificationMethod: "whatsapp",
      },
      realmId: realm.id,
      runtime: testkit.runtime,
      whatsappAvailability: availability,
    })
    expect(registered).toMatchObject({ code: "passwords.whatsapp-unavailable", success: false })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 0 })
  })
})

test("WhatsApp resend and verify fail closed before challenge mutation when unavailable", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedPhoneUser(database)
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "WhatsApp availability mutation organization" },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return

    let delivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpStart({
      availability: whatsappOtpAvailabilityAllowCreate(),
      context,
      database,
      input: { organizationId: organization.data.organization.id, phoneNumber: "+491701234567" },
      onDelivery: (value) => {
        delivery = { challengeId: value.challengeId, code: value.code }
      },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    expect(delivery).toBeDefined()
    if (!started.success || delivery === undefined) return
    const delivered = delivery

    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const reader = wahaHealthCandidateReaderCreate({ repository })
    const noConfiguration = whatsappOtpAvailabilityCreate({ database, reader, runtime: testkit.runtime })
    const configuredNoCandidate = whatsappOtpAvailabilityCreate({
      configuration,
      database,
      reader,
      runtime: testkit.runtime,
    })
    const now = testkit.runtime.now()
    const staleCandidate = repository.wahaHealthCandidateCreate({
      checkedAt: now,
      createdAt: now,
      endpointId: "primary",
      expiresAt: now,
      failureAt: null,
      failureCode: null,
      failureMessage: null,
      sessionName: "stale",
      status: "healthy",
      updatedAt: now,
      version: 1,
    })
    expect(staleCandidate.success).toBe(true)
    const configuredStale = whatsappOtpAvailabilityCreate({
      configuration,
      database,
      reader,
      runtime: testkit.runtime,
    })
    const before = database.sqlite
      .query("SELECT * FROM whatsapp_otp_challenges WHERE id = ?")
      .get(delivered.challengeId)
    const sessionsBefore = database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()
    const unavailablePorts = [noConfiguration, configuredNoCandidate, configuredStale]

    for (const availability of unavailablePorts) {
      const resend = whatsappOtpResend({
        availability,
        context,
        database,
        input: { challengeId: delivered.challengeId, organizationId: organization.data.organization.id },
        realmId: realm.id,
        runtime: testkit.runtime,
      })
      const verify = whatsappOtpVerify({
        availability,
        context,
        database,
        input: {
          challengeId: delivered.challengeId,
          code: delivered.code,
          organizationId: organization.data.organization.id,
        },
        realmId: realm.id,
        runtime: testkit.runtime,
      })
      expect(resend).toMatchObject({ code: "whatsapp-otp.unavailable", success: false })
      expect(verify).toMatchObject({ code: "whatsapp-otp.unavailable", success: false })
      expect(
        database.sqlite.query("SELECT * FROM whatsapp_otp_challenges WHERE id = ?").get(delivered.challengeId),
      ).toEqual(before)
    }

    const routeRequest = (app: ReturnType<typeof whatsappOtpServerAppCreate>, path: "resend" | "verify") =>
      app.request(`https://whatsapp-availability-mutations.example.com/realms/${realm.id}/whatsapp-otp/${path}`, {
        body: JSON.stringify(
          path === "verify"
            ? {
                challengeId: delivered.challengeId,
                code: delivered.code,
                organizationId: organization.data.organization.id,
              }
            : { challengeId: delivered.challengeId, organizationId: organization.data.organization.id },
        ),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    for (const availability of unavailablePorts) {
      const app = whatsappOtpServerAppCreate({ availability, database })
      const resend = await routeRequest(app, "resend")
      const verify = await routeRequest(app, "verify")
      expect(resend.status).toBe(503)
      expect(verify.status).toBe(503)
      expect(await resend.json()).toMatchObject({ error: { code: "whatsapp-otp.unavailable" } })
      expect(await verify.json()).toMatchObject({ error: { code: "whatsapp-otp.unavailable" } })
    }

    const missingAvailabilityResend = whatsappOtpResend({
      context,
      database,
      input: { challengeId: delivered.challengeId, organizationId: organization.data.organization.id },
      realmId: realm.id,
      runtime: testkit.runtime,
    } as unknown as Parameters<typeof whatsappOtpResend>[0])
    const missingAvailabilityVerify = whatsappOtpVerify({
      context,
      database,
      input: {
        challengeId: delivered.challengeId,
        code: delivered.code,
        organizationId: organization.data.organization.id,
      },
      realmId: realm.id,
      runtime: testkit.runtime,
    } as unknown as Parameters<typeof whatsappOtpVerify>[0])
    expect(missingAvailabilityResend).toMatchObject({ code: "whatsapp-otp.unavailable", success: false })
    expect(missingAvailabilityVerify).toMatchObject({ code: "whatsapp-otp.unavailable", success: false })

    const workingCandidate = repository.wahaHealthCandidateCreate({
      checkedAt: now,
      createdAt: now,
      endpointId: "primary",
      expiresAt: now + configuration.freshnessTtlMs,
      failureAt: null,
      failureCode: null,
      failureMessage: null,
      sessionName: "working",
      status: "healthy",
      updatedAt: now,
      version: 1,
    })
    expect(workingCandidate.success).toBe(true)
    const disabled = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowWhatsappOtp: false },
      organizationId: organization.data.organization.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(disabled.success).toBe(true)
    const policyDisabledAvailability = whatsappOtpAvailabilityCreate({
      configuration,
      database,
      reader,
      runtime: testkit.runtime,
    })
    const policyDisabledResend = whatsappOtpResend({
      availability: policyDisabledAvailability,
      context,
      database,
      input: { challengeId: delivered.challengeId, organizationId: organization.data.organization.id },
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    const policyDisabledVerify = whatsappOtpVerify({
      availability: policyDisabledAvailability,
      context,
      database,
      input: {
        challengeId: delivered.challengeId,
        code: delivered.code,
        organizationId: organization.data.organization.id,
      },
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(policyDisabledResend).toMatchObject({ code: "whatsapp-otp.conflict", success: false })
    expect(policyDisabledVerify).toMatchObject({ code: "whatsapp-otp.conflict", success: false })
    expect(
      database.sqlite.query("SELECT * FROM whatsapp_otp_challenges WHERE id = ?").get(delivered.challengeId),
    ).toEqual(before)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual(sessionsBefore)

    const policyDisabledApp = whatsappOtpServerAppCreate({ availability: policyDisabledAvailability, database })
    const policyDisabledRouteResend = await routeRequest(policyDisabledApp, "resend")
    const policyDisabledRouteVerify = await routeRequest(policyDisabledApp, "verify")
    expect(policyDisabledRouteResend.status).toBe(409)
    expect(policyDisabledRouteVerify.status).toBe(409)
    expect(await policyDisabledRouteResend.json()).toMatchObject({ error: { code: "whatsapp-otp.conflict" } })
    expect(await policyDisabledRouteVerify.json()).toMatchObject({ error: { code: "whatsapp-otp.conflict" } })
  })
})

test("WhatsApp availability is exposed through the client and CLI surfaces", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "whatsapp-availability-client.example.com")
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const reader = wahaHealthCandidateReaderCreate({ repository })
    const availability = whatsappOtpAvailabilityCreate({
      database,
      reader,
      runtime: testkit.runtime,
    })
    const app = whatsappOtpServerAppCreate({ availability, database })
    const requests: string[] = []
    const client = whatsappOtpApiClientCreate({
      baseUrl: "https://whatsapp-availability-client.example.com",
      fetch: async (input, init) => {
        requests.push(input.toString())
        return app.request(input.toString(), init)
      },
    })
    const result = await client.whatsappOtpAvailabilityGet(realm.id, "organization/id")
    expect(result).toEqual({ data: { available: false }, success: true })
    expect(requests[0]).toContain("/whatsapp-otp/availability?organizationId=organization%2Fid")
  })

  const child = Bun.spawn(["bun", "src/outputs/cli.ts", "whatsapp-otp", "availability", "--help"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ])
  expect(exitCode).toBe(0)
  expect(stderr).toBe("")
  expect(stdout).toContain("--organization-id")
})

test("server composition keeps availability false in email-only mode", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-whatsapp-availability-composition-"))
  const path = join(directory, "authworks.sqlite")
  const seeded = storageDatabaseOpen(path)
  expect(seeded.success).toBe(true)
  if (!seeded.success) return
  const realm = await createRealm(seeded.data, "whatsapp-availability-composition.example.com")
  seeded.data.close()

  const created = serverApplicationCreate({ databasePath: path })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  try {
    const response = await created.data.request(
      `https://whatsapp-availability-composition.example.com/realms/${realm.id}/whatsapp-otp/availability`,
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ available: false })
  } finally {
    created.data.stop()
    await rm(directory, { force: true, recursive: true })
  }
})

test("server composition keeps injected WhatsApp delivery fail-closed without WAHA configuration", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-whatsapp-delivery-only-composition-"))
  const path = join(directory, "authworks.sqlite")
  const seeded = storageDatabaseOpen(path)
  expect(seeded.success).toBe(true)
  if (!seeded.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const realm = await createRealm(seeded.data, "whatsapp-delivery-only-composition.example.com")
  seeded.data.close()

  const created = serverApplicationCreate({
    databasePath: path,
    whatsappDelivery: { sendText: async () => ({ data: undefined, success: true }) },
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }

  try {
    const availability = await created.data.request(
      `https://whatsapp-delivery-only-composition.example.com/realms/${realm.id}/whatsapp-otp/availability`,
    )
    expect(availability.status).toBe(200)
    expect(await availability.json()).toEqual({ available: false })

    const start = await created.data.request(
      `https://whatsapp-delivery-only-composition.example.com/realms/${realm.id}/whatsapp-otp/start`,
      {
        body: JSON.stringify({ phoneNumber: "+14155552671" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(start.status).toBe(503)
    expect(await start.json()).toMatchObject({ error: { code: "whatsapp-otp.unavailable" } })
  } finally {
    created.data.stop()
    await rm(directory, { force: true, recursive: true })
  }
})

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-whatsapp-availability-"))
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

async function createVerifiedPhoneUser(database: StorageDatabase) {
  const realm = await createRealm(database, "whatsapp-availability-mutations.example.com")
  const context = realmTenantContextCreate(realm.id, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: "whatsapp-availability-mutations-user@example.com",
      password: "Correct Horse 12",
      profile: { displayName: "WhatsApp availability mutations" },
      userName: "whatsapp-availability-mutations-user",
    },
    realmId: realm.id,
    onVerificationToken: (value) => {
      token = value.token
    },
  })
  expect(registered.success).toBe(true)
  if (!registered.success) throw new Error(registered.errorMessage)
  const verified = passwordEmailVerify({ context, database, input: { token }, realmId: realm.id })
  expect(verified.success).toBe(true)
  if (!verified.success) throw new Error(verified.errorMessage)
  const user = userRepositoryCreate(database.db).userGet(realm.id, verified.data.user.id)
  expect(user.success).toBe(true)
  if (!user.success || user.data === null) throw new Error("The WhatsApp availability user was not created")
  const now = database.runtime.now()
  const updated = userRepositoryCreate(database.db).userUpdate(realm.id, user.data.id, {
    phoneNumber: "+491701234567",
    phoneNumberVerifiedAt: now,
    updatedAt: now,
    version: user.data.version + 1,
  })
  expect(updated.success).toBe(true)
  return { context, realm }
}

function whatsappOtpAvailabilityAllowCreate(): WhatsappOtpAvailabilityPort {
  return {
    whatsappOtpAvailabilityGet: () => ({ data: { available: true }, success: true }),
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
