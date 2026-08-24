import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
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
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { userEventTypes } from "../../src/features/users/events/userEventTypes.js"
import { userRepositoryCreate } from "../../src/features/users/persistence/userRepositoryCreate.js"
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

test("unverified password registration cannot log in", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-unverified-login.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    expect(passwordRegister({ context, database, input: registrationInput(), realmId: realm.id }).success).toBe(true)
    expect(
      passwordLogin({
        context,
        database,
        input: { identifier: "ada", password: "Correct Horse 12" },
        realmId: realm.id,
      }).success,
    ).toBe(false)
  })
})

test("password login rejects incomplete, mismatched, and invalid registration verification states", async () => {
  const states = [
    {
      name: "email-only",
      emailVerifiedAt: 1_700_000_000_000,
      phoneNumber: null,
      phoneNumberVerifiedAt: null,
      registrationVerifiedAt: null,
      registrationVerificationMethod: null,
    },
    {
      name: "timestamp-only",
      emailVerifiedAt: null,
      phoneNumber: null,
      phoneNumberVerifiedAt: null,
      registrationVerifiedAt: 1_700_000_000_000,
      registrationVerificationMethod: null,
    },
    {
      name: "method-only",
      emailVerifiedAt: null,
      phoneNumber: null,
      phoneNumberVerifiedAt: null,
      registrationVerifiedAt: null,
      registrationVerificationMethod: "email",
    },
    {
      name: "channel-mismatch",
      emailVerifiedAt: 1_700_000_000_000,
      phoneNumber: null,
      phoneNumberVerifiedAt: null,
      registrationVerifiedAt: 1_700_000_000_000,
      registrationVerificationMethod: "whatsapp",
    },
    {
      name: "invalid-method",
      emailVerifiedAt: null,
      phoneNumber: null,
      phoneNumberVerifiedAt: null,
      registrationVerifiedAt: 1_700_000_000_000,
      registrationVerificationMethod: "sms",
    },
  ] as const

  for (const state of states) {
    await withDatabase(async (database) => {
      const realm = await createRealm(database, `passwords-invalid-registration-${state.name}.example.com`)
      const context = realmTenantContextCreate(realm.id, "anonymous")
      let verificationToken = ""
      expect(
        passwordRegister({
          context,
          database,
          input: registrationInput(),
          onVerificationToken: ({ token }) => {
            verificationToken = token
          },
          realmId: realm.id,
        }).success,
      ).toBe(true)
      expect(
        passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId: realm.id }).success,
      ).toBe(true)
      const user = database.sqlite.query("SELECT id FROM users WHERE realm_id = ?").get(realm.id) as { id: string }

      // Exercise malformed rows without going through repository invariants.
      const invalidMethod = state.registrationVerificationMethod === "sms"
      if (invalidMethod) database.sqlite.exec("PRAGMA ignore_check_constraints = ON")
      try {
        database.sqlite
          .query(
            "UPDATE users SET email_verified_at = ?, phone_number = ?, phone_number_verified_at = ?, registration_verified_at = ?, registration_verification_method = ? WHERE id = ?",
          )
          .run(
            state.emailVerifiedAt,
            state.phoneNumber,
            state.phoneNumberVerifiedAt,
            state.registrationVerifiedAt,
            state.registrationVerificationMethod,
            user.id,
          )
      } finally {
        if (invalidMethod) database.sqlite.exec("PRAGMA ignore_check_constraints = OFF")
      }

      expect(
        passwordLogin({
          context,
          database,
          input: { identifier: "ada", password: "Correct Horse 12" },
          realmId: realm.id,
        }).success,
      ).toBe(false)
    })
  }
})

test("password email verification emits email and registration user events in order", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-email-events.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    let verificationToken = ""
    const registered = passwordRegister({
      context,
      database,
      input: registrationInput(),
      realmId: realm.id,
      onVerificationToken: ({ token }) => {
        verificationToken = token
      },
    })
    expect(registered.success).toBe(true)
    expect(
      passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId: realm.id }).success,
    ).toBe(true)

    const events = database.sqlite
      .query(
        "SELECT aggregate_version, command_index, event_type, payload FROM events WHERE aggregate_type = 'user' ORDER BY aggregate_version",
      )
      .all() as Array<{ aggregate_version: number; command_index: number; event_type: string; payload: string }>
    expect(events.map((event) => event.event_type)).toEqual([
      userEventTypes.created,
      userEventTypes.emailVerificationChanged,
      userEventTypes.registrationVerificationChanged,
      userEventTypes.stateChanged,
    ])
    expect(events.map((event) => event.aggregate_version)).toEqual([1, 2, 3, 4])
    expect(events.map((event) => event.command_index)).toEqual([0, 0, 1, 2])
    expect(JSON.parse(events[1]?.payload ?? "{}")).toEqual({ state: "verified" })
    expect(JSON.parse(events[2]?.payload ?? "{}")).toEqual({
      registrationVerificationMethod: "email",
      state: "verified",
    })
  })
})

test("password email verification preserves established WhatsApp registration state", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-email-whatsapp-origin.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    let verificationToken = ""
    const registered = passwordRegister({
      context,
      database,
      input: registrationInput(),
      realmId: realm.id,
      onVerificationToken: ({ token }) => {
        verificationToken = token
      },
    })
    expect(registered.success).toBe(true)
    const user = database.sqlite.query("SELECT id FROM users WHERE realm_id = ?").get(realm.id) as { id: string }
    const registrationVerifiedAt = database.runtime.now()
    const whatsappVerified = userRepositoryCreate(database.db).userUpdate(realm.id, user.id, {
      phoneNumber: "+14155552671",
      phoneNumberVerifiedAt: registrationVerifiedAt,
      registrationVerifiedAt,
      registrationVerificationMethod: "whatsapp",
      version: 2,
    })
    expect(whatsappVerified.success).toBe(true)

    const verified = passwordEmailVerify({
      context,
      database,
      input: { token: verificationToken },
      realmId: realm.id,
    })
    expect(verified.success).toBe(true)
    if (!verified.success) return
    expect(verified.data.user).toMatchObject({
      emailVerified: true,
      registrationVerifiedAt,
      registrationVerificationMethod: "whatsapp",
      verificationState: "verified",
    })

    const events = database.sqlite
      .query(
        "SELECT aggregate_version, event_type FROM events WHERE aggregate_type = 'user' AND aggregate_id = ? ORDER BY aggregate_version",
      )
      .all(user.id) as Array<{ aggregate_version: number; event_type: string }>
    expect(events.map((event) => event.event_type)).toEqual([
      userEventTypes.created,
      userEventTypes.emailVerificationChanged,
      userEventTypes.stateChanged,
    ])
    expect(events.map((event) => event.aggregate_version)).toEqual([1, 3, 4])
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
    let verificationToken = ""
    const app = passwordServerAppCreate({
      browserMode: true,
      database,
      onVerificationToken: ({ token }) => {
        verificationToken = token
      },
      systemSecret: "system-secret",
    })
    const client = passwordApiClientCreate({
      baseUrl: "https://passwords-api.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
    })
    const registered = await client.passwordRegister(realm.id, registrationInput())
    expect(registered).toEqual({ data: { accepted: true, verificationRequired: true }, success: true })
    expect(
      passwordEmailVerify({
        context: realmTenantContextCreate(realm.id, "anonymous"),
        database,
        input: { token: verificationToken },
        realmId: realm.id,
      }).success,
    ).toBe(true)
    const loggedIn = await client.passwordLogin(realm.id, {
      identifier: "ada",
      password: "Correct Horse 12",
    })
    expect(loggedIn.success).toBe(true)
    if (!loggedIn.success) return
    expect(loggedIn.data.session?.token).toHaveLength(43)
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

test("authenticated password self-service changes are subject-bound and enumeration-safe", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createRealm(database, "passwords-self-service.example.com")
    const beta = await createRealm(database, "passwords-other.example.com")
    const context = realmTenantContextCreate(alpha.id, "anonymous")
    let verificationToken = ""
    expect(
      passwordRegister({
        context,
        database,
        input: registrationInput("self-service@example.com", "self-service"),
        onVerificationToken: ({ token }) => {
          verificationToken = token
        },
        realmId: alpha.id,
      }).success,
    ).toBe(true)
    expect(
      passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId: alpha.id }).success,
    ).toBe(true)
    const loggedIn = passwordLogin({
      context,
      database,
      input: { identifier: "self-service", password: "Correct Horse 12" },
      realmId: alpha.id,
    })
    expect(loggedIn.success).toBe(true)
    if (!loggedIn.success) return
    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: alpha.id,
      runtime: testkit.runtime,
      userId: loggedIn.data.authentication.userId,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return

    const publicOrigin = "https://passwords-self-service.example.com"
    const app = passwordServerAppCreate({ database, publicOrigin })
    const client = passwordApiClientCreate({
      baseUrl: publicOrigin,
      fetch: async (input, init) => app.request(input.toString(), init),
      token: issued.data.token,
    })
    const changed = await client.passwordMeChange(alpha.id, {
      currentPassword: "Correct Horse 12",
      newPassword: "New Correct Horse 12",
    })
    expect(changed).toEqual({ data: { changed: true }, success: true })

    const wrongCurrent = await client.passwordMeChange(alpha.id, {
      currentPassword: "Correct Horse 12",
      newPassword: "Wrong Current Horse 12",
    })
    expect(wrongCurrent).toMatchObject({ code: "passwords.unauthorized", statusCode: 401, success: false })
    expect(JSON.stringify(wrongCurrent)).not.toContain("Correct Horse 12")

    const crossRealm = await app.request(`https://passwords-other.example.com/realms/${beta.id}/me/password`, {
      body: JSON.stringify({ currentPassword: "New Correct Horse 12", newPassword: "Cross Realm Horse 12" }),
      headers: { authorization: `Bearer ${issued.data.token}`, "content-type": "application/json" },
      method: "POST",
    })
    expect(crossRealm.status).toBe(401)
    expect(await crossRealm.text()).not.toContain("Cross Realm Horse 12")

    const csrf = sessionCsrfTokenCreate(testkit.runtime)
    const cookie = `session=${issued.data.token}; csrf=${csrf}`
    const missingOrigin = await app.request(
      `https://passwords-self-service.example.com/realms/${alpha.id}/me/password`,
      {
        body: JSON.stringify({ currentPassword: "New Correct Horse 12", newPassword: "Cookie Horse 12" }),
        headers: { cookie, "content-type": "application/json", "x-csrf-token": csrf },
        method: "POST",
      },
    )
    expect(missingOrigin.status).toBe(403)

    const cookieChanged = await app.request(
      `https://passwords-self-service.example.com/realms/${alpha.id}/me/password`,
      {
        body: JSON.stringify({ currentPassword: "New Correct Horse 12", newPassword: "Cookie Horse 12" }),
        headers: { cookie, "content-type": "application/json", origin: publicOrigin, "x-csrf-token": csrf },
        method: "POST",
      },
    )
    expect(cookieChanged.status).toBe(200)
    expect(await cookieChanged.json()).toEqual({ changed: true })

    database.sqlite
      .query("DELETE FROM password_credentials WHERE realm_id = ? AND user_id = ?")
      .run(alpha.id, loggedIn.data.authentication.userId)
    const missingCredential = await client.passwordMeChange(alpha.id, {
      currentPassword: "Cookie Horse 12",
      newPassword: "Missing Credential Horse 12",
    })
    expect(missingCredential).toMatchObject({ code: "passwords.unauthorized", statusCode: 401, success: false })
    expect(JSON.stringify(missingCredential)).not.toContain("Missing Credential Horse 12")
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
