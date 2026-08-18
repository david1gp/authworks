import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { passwordChange } from "../../src/features/passwords/actions/passwordChange.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordPolicySet } from "../../src/features/passwords/actions/passwordPolicySet.js"
import { passwordRecoveryComplete } from "../../src/features/passwords/actions/passwordRecoveryComplete.js"
import { passwordRecoveryRequest } from "../../src/features/passwords/actions/passwordRecoveryRequest.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { passwordApiClientCreate } from "../../src/features/passwords/client/passwordApiClientCreate.js"
import { passwordEventTypes } from "../../src/features/passwords/events/passwordEventTypes.js"
import { passwordServerAppCreate } from "../../src/features/passwords/server/passwordServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-passwords-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }
  try {
    return await operation(opened.data, testkit)
  } finally {
    opened.data.close()
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

function registrationInput(email = "ada@example.com", userName = "ada", password = "Correct Horse 12") {
  return {
    email,
    password,
    profile: { displayName: "Ada Lovelace" },
    userName,
  }
}

test("password registration, email verification, login, change, recovery, and lockout are complete", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "passwords.example.com")
    const anonymous = realmTenantContextCreate(realm.id, "anonymous")
    let verificationToken = ""
    const registered = passwordRegister({
      context: anonymous,
      database,
      input: registrationInput(),
      realmId: realm.id,
      onVerificationToken: ({ token }) => {
        verificationToken = token
      },
    })
    expect(registered).toEqual({ data: { accepted: true, verificationRequired: true }, success: true })
    expect(verificationToken).toHaveLength(43)
    expect(database.sqlite.query("SELECT hash FROM password_credentials").get()).not.toEqual({
      hash: "Correct Horse 12",
    })

    const beforeVerification = passwordLogin({
      context: anonymous,
      database,
      input: { identifier: "ada", password: "Correct Horse 12" },
      realmId: realm.id,
    })
    expect(beforeVerification).toEqual({
      code: "passwords.unauthorized",
      errorMessage: "The credentials are invalid.",
      op: "passwordLogin",
      success: false,
    })
    expect(
      passwordLogin({
        context: anonymous,
        database,
        input: { identifier: "unknown", password: "Correct Horse 12" },
        realmId: realm.id,
      }),
    ).toEqual(beforeVerification)
    const verified = passwordEmailVerify({
      context: anonymous,
      database,
      input: { token: verificationToken },
      realmId: realm.id,
    })
    expect(verified.success).toBe(true)
    if (!verified.success) return
    expect(verified.data.user.state).toBe("active")
    expect(
      passwordEmailVerify({
        context: anonymous,
        database,
        input: { token: verificationToken },
        realmId: realm.id,
      }).success,
    ).toBe(false)

    const loggedIn = passwordLogin({
      context: anonymous,
      database,
      input: { identifier: " ADA ", password: "Correct Horse 12" },
      realmId: realm.id,
    })
    expect(loggedIn.success).toBe(true)
    if (!loggedIn.success) return
    const userId = loggedIn.data.authentication.userId
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = passwordLogin({
        context: anonymous,
        database,
        input: { identifier: "ada", password: "wrong password" },
        realmId: realm.id,
      })
      expect(failed.success).toBe(false)
    }
    expect(
      passwordLogin({
        context: anonymous,
        database,
        input: { identifier: "ada", password: "Correct Horse 12" },
        realmId: realm.id,
      }).success,
    ).toBe(false)
    testkit.advance(15 * 60 * 1_000)
    expect(
      passwordLogin({
        context: anonymous,
        database,
        input: { identifier: "ada", password: "Correct Horse 12" },
        realmId: realm.id,
      }).success,
    ).toBe(true)

    const changed = passwordChange({
      context: anonymous,
      database,
      input: { currentPassword: "Correct Horse 12", newPassword: "New Correct Horse 12" },
      realmId: realm.id,
      userId,
    })
    expect(changed).toEqual({ data: { changed: true }, success: true })
    expect(
      passwordLogin({
        context: anonymous,
        database,
        input: { identifier: "ada", password: "Correct Horse 12" },
        realmId: realm.id,
      }).success,
    ).toBe(false)

    let recoveryToken = ""
    const recoveryRequested = passwordRecoveryRequest({
      context: anonymous,
      database,
      input: { email: "ADA@example.com" },
      realmId: realm.id,
      onRecoveryToken: ({ token }) => {
        recoveryToken = token
      },
    })
    expect(recoveryRequested).toEqual({ data: { accepted: true }, success: true })
    expect(
      passwordRecoveryRequest({
        context: anonymous,
        database,
        input: { email: "unknown@example.com" },
        realmId: realm.id,
      }),
    ).toEqual({ data: { accepted: true }, success: true })
    expect(recoveryToken).toHaveLength(43)
    expect(
      passwordRecoveryComplete({
        context: anonymous,
        database,
        input: { newPassword: "Recovered Horse 12", token: recoveryToken },
        realmId: realm.id,
      }),
    ).toEqual({ data: { changed: true }, success: true })
    expect(
      passwordRecoveryComplete({
        context: anonymous,
        database,
        input: { newPassword: "Recovered Horse 12", token: recoveryToken },
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      passwordLogin({
        context: anonymous,
        database,
        input: { identifier: "ada", password: "Recovered Horse 12" },
        realmId: realm.id,
      }).success,
    ).toBe(true)
    const passwordEvents = database.db
      .select()
      .from(storageEventTable)
      .all()
      .filter((event) => event.aggregateType === "password" && event.aggregateId === userId)
    expect(passwordEvents.map((event) => event.aggregateVersion)).toEqual(
      passwordEvents.map((_event, index) => index + 1),
    )
  })
})

test("password identifiers and tokens stay tenant scoped and registration resists enumeration", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "passwords-alpha.example.com")
    const beta = await createRealm(database, "passwords-beta.example.com")
    const alphaContext = realmTenantContextCreate(alpha.id, "anonymous")
    const betaContext = realmTenantContextCreate(beta.id, "anonymous")
    let token = ""
    expect(
      passwordRegister({
        context: alphaContext,
        database,
        input: registrationInput(),
        realmId: alpha.id,
        onVerificationToken: (delivery) => {
          token = delivery.token
        },
      }).success,
    ).toBe(true)
    const duplicate = passwordRegister({
      context: alphaContext,
      database,
      input: registrationInput(),
      realmId: alpha.id,
    })
    expect(duplicate).toEqual({ data: { accepted: true, verificationRequired: true }, success: true })
    expect(passwordEmailVerify({ context: betaContext, database, input: { token }, realmId: beta.id }).success).toBe(
      false,
    )
    expect(
      passwordLogin({
        context: betaContext,
        database,
        input: { identifier: "ada@example.com", password: "Correct Horse 12" },
        realmId: beta.id,
      }).success,
    ).toBe(false)
    expect(
      passwordRecoveryRequest({
        context: alphaContext,
        database,
        input: { email: "missing@example.com" },
        realmId: alpha.id,
      }),
    ).toEqual({ data: { accepted: true }, success: true })
    expect(
      passwordRecoveryRequest({
        context: betaContext,
        database,
        input: { email: "ada@example.com" },
        realmId: beta.id,
      }),
    ).toEqual({ data: { accepted: true }, success: true })
  })
})

test("password registration treats normalized duplicate identifiers as accepted without delivery", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-duplicates.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    let deliveries = 0
    const registered = passwordRegister({
      context,
      database,
      input: registrationInput(),
      realmId: realm.id,
      onVerificationToken: () => {
        deliveries += 1
      },
    })
    expect(registered.success).toBe(true)

    expect(
      passwordRegister({
        context,
        database,
        input: registrationInput(" ADA@example.com ", "different-user"),
        realmId: realm.id,
        onVerificationToken: () => {
          deliveries += 1
        },
      }),
    ).toEqual({ data: { accepted: true, verificationRequired: true }, success: true })
    expect(
      passwordRegister({
        context,
        database,
        input: registrationInput("different@example.com", " ADA "),
        realmId: realm.id,
        onVerificationToken: () => {
          deliveries += 1
        },
      }),
    ).toEqual({ data: { accepted: true, verificationRequired: true }, success: true })
    expect(deliveries).toBe(1)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 1 })
  })
})

test("password policy enforces each required character class at the exact length boundary", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-complexity.example.com")
    const system = realmSystemContextCreate("system")
    expect(
      passwordPolicySet({
        context: system,
        database,
        input: {
          lockoutDurationMs: 60_000,
          maximumAttempts: 5,
          minimumLength: 12,
          requireLowercase: true,
          requireNumber: true,
          requireSymbol: true,
          requireUppercase: true,
        },
        realmId: realm.id,
      }).success,
    ).toBe(true)

    const invalidPasswords = ["UPPERCASE12!", "lowercase12!", "Lowercase!!?", "Lowercase12A"]
    for (const [index, password] of invalidPasswords.entries()) {
      expect(
        passwordRegister({
          context: system,
          database,
          input: registrationInput(`invalid-${index}@example.com`, `invalid-${index}`, password),
          realmId: realm.id,
        }).success,
      ).toBe(false)
    }
    expect(
      passwordRegister({
        context: system,
        database,
        input: registrationInput("boundary@example.com", "boundary", "Lowercase12!"),
        realmId: realm.id,
      }).success,
    ).toBe(true)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 1 })
  })
})

test("password recovery invalidates the previous token and remains one-time", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "passwords-recovery.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    let verificationToken = ""
    expect(
      passwordRegister({
        context,
        database,
        input: registrationInput(),
        realmId: realm.id,
        onVerificationToken: ({ token }) => {
          verificationToken = token
        },
      }).success,
    ).toBe(true)
    expect(
      passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId: realm.id }).success,
    ).toBe(true)

    let firstToken = ""
    let secondToken = ""
    expect(
      passwordRecoveryRequest({
        context,
        database,
        input: { email: "ada@example.com" },
        realmId: realm.id,
        onRecoveryToken: ({ token }) => {
          firstToken = token
        },
      }).success,
    ).toBe(true)
    testkit.advance(1)
    expect(
      passwordRecoveryRequest({
        context,
        database,
        input: { email: "ada@example.com" },
        realmId: realm.id,
        onRecoveryToken: ({ token }) => {
          secondToken = token
        },
      }).success,
    ).toBe(true)
    expect(firstToken).not.toBe(secondToken)
    expect(
      passwordRecoveryComplete({
        context,
        database,
        input: { newPassword: "First Recovery 12", token: firstToken },
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      passwordRecoveryComplete({
        context,
        database,
        input: { newPassword: "Second Recovery 12", token: secondToken },
        realmId: realm.id,
      }),
    ).toEqual({ data: { changed: true }, success: true })
  })
})

test("password changes and policy events are atomic and audit safe", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-events.example.com")
    const system = realmSystemContextCreate("system")
    const policy = passwordPolicySet({
      context: system,
      database,
      input: {
        lockoutDurationMs: 60_000,
        maximumAttempts: 2,
        minimumLength: 14,
        requireLowercase: true,
        requireNumber: true,
        requireSymbol: false,
        requireUppercase: true,
      },
      realmId: realm.id,
    })
    expect(policy.success).toBe(true)
    expect(
      passwordRegister({
        context: system,
        database,
        input: registrationInput("safe@example.com", "safe", "TooShort12"),
        realmId: realm.id,
      }).success,
    ).toBe(false)
    database.sqlite.run(
      "CREATE TRIGGER reject_password_events BEFORE INSERT ON events WHEN NEW.aggregate_type = 'password' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const before = database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()
    const rejected = passwordRegister({
      context: system,
      database,
      input: registrationInput("rollback@example.com", "rollback", "Valid Password 12"),
      realmId: realm.id,
    })
    expect(rejected.success).toBe(false)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()).toEqual(before)
    database.sqlite.run("DROP TRIGGER reject_password_events")
    const events = database.db.select().from(storageEventTable).all()
    expect(events.map((event) => event.eventType)).toContain("password.policy_changed")
    expect(events.some((event) => event.eventType === passwordEventTypes.credentialChanged)).toBe(false)
    expect(JSON.stringify(events)).not.toContain("Valid Password 12")
    expect(JSON.stringify(events)).not.toContain("rollback@example.com")
  })
})

test("password server and client expose generic public contracts", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-api.example.com")
    const app = passwordServerAppCreate({ database, systemSecret: "system-secret" })
    const client = passwordApiClientCreate({
      baseUrl: "https://passwords-api.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
    })
    const registered = await client.passwordRegister(realm.id, registrationInput())
    expect(registered).toEqual({ data: { accepted: true, verificationRequired: true }, success: true })
    const invalid = await client.passwordLogin(realm.id, { identifier: "ada", password: "wrong" })
    expect(invalid.success).toBe(false)
    const policy = await client.passwordPolicyGet(realm.id)
    expect(policy).toEqual({
      data: {
        policy: {
          lockoutDurationMs: 900000,
          maximumAttempts: 5,
          minimumLength: 12,
          requireLowercase: false,
          requireNumber: false,
          requireSymbol: false,
          requireUppercase: false,
        },
      },
      success: true,
    })
    if (!policy.success) return
    const unauthorized = await passwordApiClientCreate({
      baseUrl: "https://passwords-api.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "bad",
    }).passwordPolicySet(
      realm.id,
      policy.data?.policy ?? {
        lockoutDurationMs: 900000,
        maximumAttempts: 5,
        minimumLength: 12,
        requireLowercase: false,
        requireNumber: false,
        requireSymbol: false,
        requireUppercase: false,
      },
    )
    expect(unauthorized.success).toBe(false)
  })
})

test("password CLI exposes authentication commands without opening SQLite", async () => {
  const helpProcess = Bun.spawn(["bun", "src/outputs/cli.ts", "passwords", "--help"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const helpOutput = await new Response(helpProcess.stdout).text()
  expect(await helpProcess.exited).toBe(0)
  expect(helpOutput).toContain("Password authentication")
})
