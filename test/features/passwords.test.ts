import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { organizationLoginPolicySet } from "../../src/features/organizations/actions/organizationLoginPolicySet.js"
import { passwordChange } from "../../src/features/passwords/actions/passwordChange.js"
import { passwordCredentialReplace } from "../../src/features/passwords/actions/passwordCredentialReplace.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordPolicyGet } from "../../src/features/passwords/actions/passwordPolicyGet.js"
import { passwordPolicySet } from "../../src/features/passwords/actions/passwordPolicySet.js"
import { passwordRecoveryComplete } from "../../src/features/passwords/actions/passwordRecoveryComplete.js"
import { passwordRecoveryRequest } from "../../src/features/passwords/actions/passwordRecoveryRequest.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { passwordApiClientCreate } from "../../src/features/passwords/client/passwordApiClientCreate.js"
import { passwordEventTypes } from "../../src/features/passwords/events/passwordEventTypes.js"
import { passwordServerAppCreate } from "../../src/features/passwords/server/passwordServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmUpdate } from "../../src/features/realms/actions/realmUpdate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionPasswordCreate } from "../../src/features/sessions/actions/sessionPasswordCreate.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userEventTypes } from "../../src/features/users/events/userEventTypes.js"
import { userEmailRepositoryCreate } from "../../src/features/users/persistence/userEmailRepositoryCreate.js"
import { userRepositoryCreate } from "../../src/features/users/persistence/userRepositoryCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { Secret } from "../../src/platform/secrets/Secret.js"
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

test("password email verification replaces challenges without mutating state on failure", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-email-replacement.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    let firstToken = ""
    passwordRegister({
      context,
      database,
      input: registrationInput(),
      onVerificationToken: ({ token }) => {
        firstToken = token
      },
      realmId: realm.id,
    })
    const user = database.sqlite
      .query("SELECT id, email_verified_at, registration_verified_at, state FROM users")
      .get() as {
      email_verified_at: number | null
      id: string
      registration_verified_at: number | null
      state: string
    }
    const firstChallenge = database.sqlite
      .query("SELECT consumed_at, id FROM password_challenges WHERE user_id = ?")
      .get(user.id) as { consumed_at: number | null; id: string }
    let newestToken = ""
    const resent = passwordRegister({
      context,
      database,
      input: registrationInput(),
      onVerificationToken: ({ token }) => {
        newestToken = token
      },
      realmId: realm.id,
    })
    expect(resent).toEqual({ data: { accepted: true, verificationRequired: true }, success: true })
    expect(newestToken).toHaveLength(43)
    expect(newestToken).not.toBe(firstToken)

    const challengesAfterResend = database.sqlite
      .query("SELECT consumed_at, id FROM password_challenges WHERE user_id = ?")
      .all(user.id) as Array<{ consumed_at: number | null; id: string }>
    expect(challengesAfterResend).toHaveLength(2)
    expect(challengesAfterResend.find((challenge) => challenge.id === firstChallenge.id)?.consumed_at).not.toBeNull()
    const newestChallenge = challengesAfterResend.find((challenge) => challenge.id !== firstChallenge.id)
    expect(newestChallenge?.consumed_at).toBeNull()
    if (newestChallenge === undefined) throw new Error("The newest password verification challenge is missing.")
    expect(
      database.sqlite
        .query("SELECT email_verified_at, registration_verified_at, state FROM users WHERE id = ?")
        .get(user.id),
    ).toEqual({ email_verified_at: null, registration_verified_at: null, state: "initial" })

    const stateBeforeFailures = database.sqlite
      .query("SELECT email_verified_at, registration_verified_at, state FROM users WHERE id = ?")
      .get(user.id)
    const wrong = passwordEmailVerify({
      context,
      database,
      input: { token: "wrong-verification-token-which-is-long-enough" },
      realmId: realm.id,
    })
    expect(wrong.success).toBe(false)
    expect(
      database.sqlite
        .query("SELECT email_verified_at, registration_verified_at, state FROM users WHERE id = ?")
        .get(user.id),
    ).toEqual(stateBeforeFailures)
    expect(
      database.sqlite.query("SELECT consumed_at FROM password_challenges WHERE id = ?").get(newestChallenge?.id),
    ).toEqual({ consumed_at: null })

    expect(passwordEmailVerify({ context, database, input: { token: firstToken }, realmId: realm.id }).success).toBe(
      false,
    )
    expect(
      database.sqlite
        .query("SELECT email_verified_at, registration_verified_at, state FROM users WHERE id = ?")
        .get(user.id),
    ).toEqual(stateBeforeFailures)
    expect(
      database.sqlite.query("SELECT consumed_at FROM password_challenges WHERE id = ?").get(newestChallenge?.id),
    ).toEqual({ consumed_at: null })

    expect(passwordEmailVerify({ context, database, input: { token: newestToken }, realmId: realm.id }).success).toBe(
      true,
    )
    expect(passwordEmailVerify({ context, database, input: { token: newestToken }, realmId: realm.id }).success).toBe(
      false,
    )
  })
})

test("password login is enumeration-resistant across identity and policy states", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-login-enumeration.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    const system = realmSystemContextCreate("system")

    const register = (userName: string, verified: boolean) => {
      let verificationToken = ""
      const registered = passwordRegister({
        context,
        database,
        input: registrationInput(`${userName}@example.com`, userName),
        onVerificationToken: ({ token }) => {
          verificationToken = token
        },
        realmId: realm.id,
      })
      expect(registered.success).toBe(true)
      if (verified) {
        expect(
          passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId: realm.id }).success,
        ).toBe(true)
      }
    }

    register("ada", true)
    register("unverified", false)
    register("inactive", true)
    register("locked", true)
    register("policy-denied", true)

    const users = database.sqlite
      .query("SELECT id, user_name FROM users WHERE realm_id = ? ORDER BY user_name")
      .all(realm.id) as Array<{ id: string; user_name: string }>
    const userIdGet = (userName: string) => users.find((user) => user.user_name === userName)?.id ?? ""
    expect(
      userLifecycleSet({
        context: system,
        database,
        input: { state: "inactive" },
        realmId: realm.id,
        userId: userIdGet("inactive"),
      }).success,
    ).toBe(true)
    expect(
      userLifecycleSet({
        context: system,
        database,
        input: { state: "locked" },
        realmId: realm.id,
        userId: userIdGet("locked"),
      }).success,
    ).toBe(true)

    const app = passwordServerAppCreate({ database })
    const request = (input: unknown) =>
      app.request(`https://passwords-login-enumeration.example.com/realms/${realm.id}/password/login`, {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    const responseContractRead = async (response: Response) => {
      const body = (await response.json()) as { error?: Record<string, unknown> } & Record<string, unknown>
      return {
        bodyKeys: Object.keys(body).sort(),
        code: body.error?.code,
        errorKeys: body.error === undefined ? [] : Object.keys(body.error).sort(),
        message: body.error?.message,
        status: response.status,
      }
    }

    const existing = await request({ identifier: "ada", password: "Correct Horse 12" })
    expect(await responseContractRead(existing)).toEqual({
      bodyKeys: ["authentication", "session"],
      code: undefined,
      errorKeys: [],
      message: undefined,
      status: 200,
    })

    const invalidIdentityInputs = [
      { identifier: "missing", password: "Correct Horse 12" },
      { identifier: " ", password: "Correct Horse 12" },
      { identifier: "unverified", password: "Correct Horse 12" },
      { identifier: "inactive", password: "Correct Horse 12" },
      { identifier: "locked", password: "Correct Horse 12" },
    ]
    const invalidIdentityContracts = []
    for (const input of invalidIdentityInputs) {
      invalidIdentityContracts.push(await responseContractRead(await request(input)))
    }
    expect(invalidIdentityContracts).toEqual(
      invalidIdentityInputs.map(() => ({
        bodyKeys: ["error"],
        code: "passwords.unauthorized",
        errorKeys: ["code", "message", "op", "requestId", "retryable", "status"],
        message: "The credentials are invalid.",
        status: 401,
      })),
    )

    expect(
      organizationLoginPolicySet({
        context: system,
        database,
        input: { allowPassword: false },
        realmId: realm.id,
      }).success,
    ).toBe(true)
    const policyDenied = await request({ identifier: "policy-denied", password: "Correct Horse 12" })
    expect(await responseContractRead(policyDenied)).toEqual({
      bodyKeys: ["error"],
      code: "passwords.unauthorized",
      errorKeys: ["code", "message", "op", "requestId", "retryable", "status"],
      message: "The credentials are invalid.",
      status: 401,
    })
  })
})

test("password recovery is enumeration-resistant across identity and policy states", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-recovery-enumeration.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    const system = realmSystemContextCreate("system")

    const register = (userName: string, verified: boolean) => {
      let verificationToken = ""
      const registered = passwordRegister({
        context,
        database,
        input: registrationInput(`${userName}@example.com`, userName),
        onVerificationToken: ({ token }) => {
          verificationToken = token
        },
        realmId: realm.id,
      })
      expect(registered.success).toBe(true)
      if (verified) {
        expect(
          passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId: realm.id }).success,
        ).toBe(true)
      }
    }

    register("existing", true)
    register("unverified", false)
    register("inactive", true)
    register("locked", true)
    register("policy-denied", true)

    const users = database.sqlite
      .query("SELECT id, user_name FROM users WHERE realm_id = ? ORDER BY user_name")
      .all(realm.id) as Array<{ id: string; user_name: string }>
    const userIdGet = (userName: string) => users.find((user) => user.user_name === userName)?.id ?? ""
    expect(
      userLifecycleSet({
        context: system,
        database,
        input: { state: "inactive" },
        realmId: realm.id,
        userId: userIdGet("inactive"),
      }).success,
    ).toBe(true)
    expect(
      userLifecycleSet({
        context: system,
        database,
        input: { state: "locked" },
        realmId: realm.id,
        userId: userIdGet("locked"),
      }).success,
    ).toBe(true)

    const app = passwordServerAppCreate({ database })
    const request = (input: unknown) =>
      app.request(`https://passwords-recovery-enumeration.example.com/realms/${realm.id}/password/recovery/request`, {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    const responseContractRead = async (response: Response) => {
      const body = (await response.json()) as {
        accepted?: unknown
        error?: Record<string, unknown>
      } & Record<string, unknown>
      return {
        accepted: body.accepted,
        bodyKeys: Object.keys(body).sort(),
        code: body.error?.code,
        errorKeys: body.error === undefined ? [] : Object.keys(body.error).sort(),
        message: body.error?.message,
        status: response.status,
      }
    }

    const contracts = []
    for (const input of [
      { email: "existing@example.com" },
      { email: "missing@example.com" },
      { email: "not-an-email" },
      { email: "unverified@example.com" },
      { email: "inactive@example.com" },
      { email: "locked@example.com" },
    ]) {
      contracts.push(await responseContractRead(await request(input)))
    }
    expect(contracts).toEqual(
      contracts.map(() => ({
        accepted: true,
        bodyKeys: ["accepted"],
        code: undefined,
        errorKeys: [],
        message: undefined,
        status: 200,
      })),
    )

    expect(
      organizationLoginPolicySet({
        context: system,
        database,
        input: { allowPasswordRecovery: false },
        realmId: realm.id,
      }).success,
    ).toBe(true)
    const policyDenied = await request({ email: "policy-denied@example.com" })
    expect(await responseContractRead(policyDenied)).toEqual({
      accepted: true,
      bodyKeys: ["accepted"],
      code: undefined,
      errorKeys: [],
      message: undefined,
      status: 200,
    })
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

test("verified secondary email addresses support password login and recovery without changing the primary projection", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createRealm(database, "passwords-secondary-alpha.example.com")
    const beta = await createRealm(database, "passwords-secondary-beta.example.com")
    const alphaContext = realmTenantContextCreate(alpha.id, "anonymous")
    const betaContext = realmTenantContextCreate(beta.id, "anonymous")
    let verificationToken = ""
    expect(
      passwordRegister({
        context: alphaContext,
        database,
        input: registrationInput("primary@example.com", "secondary-user"),
        onVerificationToken: ({ token }) => {
          verificationToken = token
        },
        realmId: alpha.id,
      }).success,
    ).toBe(true)
    expect(
      passwordEmailVerify({ context: alphaContext, database, input: { token: verificationToken }, realmId: alpha.id })
        .success,
    ).toBe(true)
    const user = database.sqlite.query("SELECT id FROM users WHERE realm_id = ?").get(alpha.id) as { id: string }
    const emails = userEmailRepositoryCreate(database.db)
    const pending = emails.userEmailCreate({
      createdAt: testkit.runtime.now(),
      email: "pending@example.com",
      id: "pending-secondary",
      isPrimary: false,
      realmId: alpha.id,
      updatedAt: testkit.runtime.now(),
      userId: user.id,
      verifiedAt: null,
      version: 1,
    })
    expect(pending.success).toBe(true)
    const secondary = emails.userEmailCreate({
      createdAt: testkit.runtime.now(),
      email: "secondary@example.com",
      id: "verified-secondary",
      isPrimary: false,
      realmId: alpha.id,
      updatedAt: testkit.runtime.now(),
      userId: user.id,
      verifiedAt: testkit.runtime.now(),
      version: 1,
    })
    expect(secondary.success).toBe(true)
    if (!secondary.success) return

    expect(
      passwordLogin({
        context: alphaContext,
        database,
        input: { identifier: "secondary@example.com", password: "Correct Horse 12" },
        realmId: alpha.id,
      }).success,
    ).toBe(true)
    expect(
      passwordLogin({
        context: alphaContext,
        database,
        input: { identifier: "pending@example.com", password: "Correct Horse 12" },
        realmId: alpha.id,
      }).success,
    ).toBe(false)
    expect(
      passwordLogin({
        context: betaContext,
        database,
        input: { identifier: "secondary@example.com", password: "Correct Horse 12" },
        realmId: beta.id,
      }).success,
    ).toBe(false)

    const deliveries: Array<{ email: string; token: string }> = []
    expect(
      passwordRecoveryRequest({
        context: alphaContext,
        database,
        input: { email: "secondary@example.com" },
        onRecoveryToken: ({ email, token }) => {
          deliveries.push({ email, token })
        },
        realmId: alpha.id,
      }),
    ).toEqual({ data: { accepted: true }, success: true })
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]?.email).toBe("secondary@example.com")
    expect(
      passwordRecoveryRequest({
        context: alphaContext,
        database,
        input: { email: "pending@example.com" },
        onRecoveryToken: () => {
          throw new Error("unverified addresses must not receive recovery")
        },
        realmId: alpha.id,
      }),
    ).toEqual({ data: { accepted: true }, success: true })
    expect(
      passwordRecoveryRequest({
        context: betaContext,
        database,
        input: { email: "secondary@example.com" },
        onRecoveryToken: () => {
          throw new Error("cross-realm addresses must not receive recovery")
        },
        realmId: beta.id,
      }),
    ).toEqual({ data: { accepted: true }, success: true })
    expect(
      passwordRecoveryComplete({
        context: alphaContext,
        database,
        input: { newPassword: "Secondary Recovery 12", token: deliveries[0]?.token ?? "" },
        realmId: alpha.id,
      }),
    ).toEqual({ data: { changed: true }, success: true })

    expect(emails.userEmailDelete(alpha.id, user.id, secondary.data.id)).toMatchObject({
      data: { email: "secondary@example.com" },
      success: true,
    })
    expect(
      passwordLogin({
        context: alphaContext,
        database,
        input: { identifier: "secondary@example.com", password: "Secondary Recovery 12" },
        realmId: alpha.id,
      }).success,
    ).toBe(false)
    expect(
      passwordRecoveryRequest({
        context: alphaContext,
        database,
        input: { email: "secondary@example.com" },
        onRecoveryToken: () => {
          throw new Error("removed addresses must not receive recovery")
        },
        realmId: alpha.id,
      }),
    ).toEqual({ data: { accepted: true }, success: true })
    expect(database.sqlite.query("SELECT email FROM users WHERE id = ?").get(user.id)).toEqual({
      email: "primary@example.com",
    })
  })
})

test("verified email-form identifiers take precedence over colliding usernames", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "passwords-identifier-priority.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    let firstToken = ""
    const firstRegistered = passwordRegister({
      context,
      database,
      input: registrationInput("first@example.com", "verified-email@example.com", "First Password 12"),
      onVerificationToken: ({ token }) => {
        firstToken = token
      },
      realmId: realm.id,
    })
    expect(firstRegistered.success).toBe(true)
    const firstVerified = passwordEmailVerify({
      context,
      database,
      input: { token: firstToken },
      realmId: realm.id,
    })
    expect(firstVerified.success).toBe(true)
    if (!firstVerified.success) return

    let secondToken = ""
    const secondRegistered = passwordRegister({
      context,
      database,
      input: registrationInput("second@example.com", "second-user", "Second Password 12"),
      onVerificationToken: ({ token }) => {
        secondToken = token
      },
      realmId: realm.id,
    })
    expect(secondRegistered.success).toBe(true)
    const secondVerified = passwordEmailVerify({
      context,
      database,
      input: { token: secondToken },
      realmId: realm.id,
    })
    expect(secondVerified.success).toBe(true)
    if (!secondVerified.success) return

    database.sqlite.exec("DROP TRIGGER user_emails_verified_user_name_collision_insert")
    try {
      database.sqlite
        .query(
          "INSERT INTO user_emails (created_at, email, id, is_primary, realm_id, updated_at, user_id, verified_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          testkit.runtime.now(),
          "verified-email@example.com",
          "identifier-priority-secondary",
          0,
          realm.id,
          testkit.runtime.now(),
          secondVerified.data.user.id,
          testkit.runtime.now(),
          1,
        )
    } finally {
      database.sqlite.exec(
        "CREATE TRIGGER user_emails_verified_user_name_collision_insert BEFORE INSERT ON user_emails WHEN NEW.verified_at IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE users.realm_id = NEW.realm_id AND users.id <> NEW.user_id AND lower(trim(users.user_name)) = lower(trim(NEW.email))) BEGIN SELECT RAISE(ABORT, 'users username/email identifier collision'); END",
      )
    }
    const emailLogin = passwordLogin({
      context,
      database,
      input: { identifier: "verified-email@example.com", password: "Second Password 12" },
      realmId: realm.id,
    })
    expect(emailLogin).toMatchObject({
      data: { authentication: { userId: secondVerified.data.user.id } },
      success: true,
    })
    expect(
      passwordLogin({
        context,
        database,
        input: { identifier: "second-user", password: "Second Password 12" },
        realmId: realm.id,
      }),
    ).toMatchObject({ data: { authentication: { userId: secondVerified.data.user.id } }, success: true })
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
    expect(deliveries).toBe(2)
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

test("password policy boundaries apply to registration, change, recovery, and replacement", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "passwords-policy-boundaries.example.com")
    const system = realmSystemContextCreate("system")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    const policy = {
      lockoutDurationMs: 60_000,
      maximumAttempts: 5,
      minimumLength: 12,
      requireLowercase: false,
      requireNumber: false,
      requireSymbol: false,
      requireUppercase: false,
    }

    for (const input of [
      { ...policy, minimumLength: 0 },
      { ...policy, minimumLength: 73 },
      { ...policy, maximumAttempts: 0 },
      { ...policy, maximumAttempts: 101 },
      { ...policy, lockoutDurationMs: 999 },
      { ...policy, lockoutDurationMs: 31_536_000_001 },
    ]) {
      expect(passwordPolicySet({ context: system, database, input, realmId: realm.id })).toMatchObject({
        code: "passwords.invalid",
        success: false,
      })
    }
    expect(
      passwordPolicySet({
        context: system,
        database,
        input: { ...policy, lockoutDurationMs: 1_000, maximumAttempts: 1, minimumLength: 1 },
        realmId: realm.id,
      }).success,
    ).toBe(true)
    expect(
      passwordPolicySet({
        context: system,
        database,
        input: { ...policy, lockoutDurationMs: 31_536_000_000, maximumAttempts: 100, minimumLength: 72 },
        realmId: realm.id,
      }).success,
    ).toBe(true)
    expect(passwordPolicySet({ context: system, database, input: policy, realmId: realm.id }).success).toBe(true)

    const tooShort = passwordRegister({
      context,
      database,
      input: registrationInput("too-short@example.com", "too-short", "p".repeat(11)),
      realmId: realm.id,
    })
    expect(tooShort).toMatchObject({ code: "passwords.invalid", success: false })

    let verificationToken = ""
    expect(
      passwordRegister({
        context,
        database,
        input: registrationInput("boundary-policy@example.com", "boundary-policy", "p".repeat(12)),
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

    expect(
      passwordPolicySet({ context: system, database, input: { ...policy, minimumLength: 13 }, realmId: realm.id })
        .success,
    ).toBe(true)
    expect(
      passwordChange({
        context,
        database,
        input: { currentPassword: "p".repeat(12), newPassword: "p".repeat(12) },
        realmId: realm.id,
        userId: user.id,
      }),
    ).toMatchObject({ code: "passwords.invalid", success: false })
    expect(
      passwordChange({
        context,
        database,
        input: { currentPassword: "p".repeat(12), newPassword: "p".repeat(13) },
        realmId: realm.id,
        userId: user.id,
      }).success,
    ).toBe(true)

    expect(
      passwordPolicySet({ context: system, database, input: { ...policy, minimumLength: 14 }, realmId: realm.id })
        .success,
    ).toBe(true)
    let recoveryToken = ""
    expect(
      passwordRecoveryRequest({
        context,
        database,
        input: { email: "boundary-policy@example.com" },
        onRecoveryToken: ({ token }) => {
          recoveryToken = token
        },
        realmId: realm.id,
      }).success,
    ).toBe(true)
    expect(
      passwordRecoveryComplete({
        context,
        database,
        input: { newPassword: "p".repeat(13), token: recoveryToken },
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "passwords.policy-rejected", success: false })
    expect(
      passwordRecoveryComplete({
        context,
        database,
        input: { newPassword: "p".repeat(14), token: recoveryToken },
        realmId: realm.id,
      }).success,
    ).toBe(true)

    expect(
      passwordPolicySet({ context: system, database, input: { ...policy, minimumLength: 15 }, realmId: realm.id })
        .success,
    ).toBe(true)
    expect(
      passwordCredentialReplace({
        context: system,
        database,
        password: new Secret("p".repeat(14)),
        realmId: realm.id,
        userId: user.id,
      }),
    ).toMatchObject({ code: "passwords.invalid", success: false })
    expect(
      passwordCredentialReplace({
        context: system,
        database,
        password: new Secret("p".repeat(15)),
        realmId: realm.id,
        userId: user.id,
      }).success,
    ).toBe(true)
  })
})

test("forced password changes restrict login, expire recovery challenges, clear state, and gate sessions", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "passwords-forced-change.example.com")
    const system = realmSystemContextCreate("system")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    let verificationToken = ""
    const registration = passwordRegister({
      context,
      database,
      input: registrationInput("forced-user@example.com", "forced-user", "Temporary Password 12"),
      onVerificationToken: ({ token }) => {
        verificationToken = token
      },
      realmId: realm.id,
    })
    expect(registration.success).toBe(true)
    expect(
      passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId: realm.id }).success,
    ).toBe(true)
    const user = database.sqlite.query("SELECT id FROM users WHERE email = ?").get("forced-user@example.com") as {
      id: string
    }
    expect(
      database.sqlite.query("SELECT password_change_required FROM password_credentials WHERE user_id = ?").get(user.id),
    ).toEqual({
      password_change_required: 0,
    })

    expect(
      passwordCredentialReplace({
        context: system,
        database,
        password: new Secret("Temporary Password 12"),
        passwordChangeRequired: true,
        realmId: realm.id,
        userId: user.id,
      }),
    ).toEqual({ data: { changed: true }, success: true })
    expect(
      database.sqlite.query("SELECT password_change_required FROM password_credentials WHERE user_id = ?").get(user.id),
    ).toEqual({
      password_change_required: 1,
    })

    const restricted = passwordLogin({
      context,
      database,
      input: { identifier: "forced-user", password: "Temporary Password 12" },
      realmId: realm.id,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(restricted).toMatchObject({
      data: { authentication: { userId: user.id }, passwordChangeRequired: true },
      success: true,
    })
    if (restricted.success) expect(restricted.data.session).toBeUndefined()
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 0 })

    expect(
      passwordChange({
        context,
        database,
        input: { currentPassword: "Temporary Password 12", newPassword: "Changed Password 12" },
        realmId: realm.id,
        userId: user.id,
      }),
    ).toEqual({ data: { changed: true }, success: true })
    expect(
      database.sqlite.query("SELECT password_change_required FROM password_credentials WHERE user_id = ?").get(user.id),
    ).toEqual({
      password_change_required: 0,
    })
    const changedLogin = passwordLogin({
      context,
      database,
      input: { identifier: "forced-user", password: "Changed Password 12" },
      realmId: realm.id,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(changedLogin.success).toBe(true)
    if (changedLogin.success) expect(changedLogin.data.session?.token).toHaveLength(43)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 1 })

    expect(
      passwordCredentialReplace({
        context: system,
        database,
        password: new Secret("Changed Password 12"),
        passwordChangeRequired: true,
        realmId: realm.id,
        userId: user.id,
      }).success,
    ).toBe(true)
    let expiredRecoveryToken = ""
    expect(
      passwordRecoveryRequest({
        context,
        database,
        input: { email: "forced-user@example.com" },
        onRecoveryToken: ({ token }) => {
          expiredRecoveryToken = token
        },
        realmId: realm.id,
      }).success,
    ).toBe(true)
    testkit.advance(60 * 60 * 1_000)
    expect(
      passwordRecoveryComplete({
        context,
        database,
        input: { newPassword: "Expired Recovery 12", token: expiredRecoveryToken },
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "passwords.invalid", success: false })
    expect(
      database.sqlite.query("SELECT password_change_required FROM password_credentials WHERE user_id = ?").get(user.id),
    ).toEqual({
      password_change_required: 1,
    })
    expect(
      database.sqlite
        .query("SELECT consumed_at FROM password_challenges WHERE realm_id = ? AND user_id = ? AND kind = 'recovery'")
        .get(realm.id, user.id),
    ).toEqual({ consumed_at: null })

    let recoveryToken = ""
    expect(
      passwordRecoveryRequest({
        context,
        database,
        input: { email: "forced-user@example.com" },
        onRecoveryToken: ({ token }) => {
          recoveryToken = token
        },
        realmId: realm.id,
      }).success,
    ).toBe(true)
    expect(
      passwordRecoveryComplete({
        context,
        database,
        input: { newPassword: "Recovered Password 12", token: recoveryToken },
        realmId: realm.id,
      }).success,
    ).toBe(true)
    expect(
      database.sqlite.query("SELECT password_change_required FROM password_credentials WHERE user_id = ?").get(user.id),
    ).toEqual({
      password_change_required: 0,
    })

    expect(
      passwordCredentialReplace({
        context: system,
        database,
        password: new Secret("Recovered Password 12"),
        passwordChangeRequired: true,
        realmId: realm.id,
        userId: user.id,
      }).success,
    ).toBe(true)
    expect(
      passwordCredentialReplace({
        context: system,
        database,
        password: new Secret("Recovered Password 12"),
        passwordChangeRequired: false,
        realmId: realm.id,
        userId: user.id,
      }).success,
    ).toBe(true)
    expect(
      database.sqlite.query("SELECT password_change_required FROM password_credentials WHERE user_id = ?").get(user.id),
    ).toEqual({
      password_change_required: 0,
    })
  })
})

test("inactive realms return passwords.not-active for registration and policy APIs", async () => {
  await withDatabase(async (database) => {
    const domain = "passwords-inactive.example.com"
    const realm = await createRealm(database, domain)
    const system = realmSystemContextCreate("system")
    const tenant = realmTenantContextCreate(realm.id, "anonymous")
    const policyInput = {
      lockoutDurationMs: 60_000,
      maximumAttempts: 5,
      minimumLength: 12,
      requireLowercase: false,
      requireNumber: false,
      requireSymbol: false,
      requireUppercase: false,
    }
    const inactive = realmUpdate({ context: system, database, input: { status: "disabled" }, realmId: realm.id })
    expect(inactive.success).toBe(true)

    expect(
      passwordRegister({ context: tenant, database, input: registrationInput(), realmId: realm.id }),
    ).toMatchObject({ code: "passwords.not-active", success: false })
    expect(passwordPolicyGet({ context: tenant, database, realmId: realm.id })).toMatchObject({
      code: "passwords.not-active",
      success: false,
    })
    expect(passwordPolicySet({ context: system, database, input: policyInput, realmId: realm.id })).toMatchObject({
      code: "passwords.not-active",
      success: false,
    })

    const app = passwordServerAppCreate({ database, systemSecret: "inactive-realm-system-secret" })
    const registerResponse = await app.request(`https://${domain}/realms/${realm.id}/password/register`, {
      body: JSON.stringify(registrationInput()),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    expect(registerResponse.status).toBe(409)
    expect(await registerResponse.json()).toMatchObject({ error: { code: "passwords.not-active", status: 409 } })

    const policyGetResponse = await app.request(`https://${domain}/realms/${realm.id}/password-policy`)
    expect(policyGetResponse.status).toBe(409)
    expect(await policyGetResponse.json()).toMatchObject({ error: { code: "passwords.not-active", status: 409 } })

    const policySetResponse = await app.request(`https://${domain}/system/realms/${realm.id}/password-policy`, {
      body: JSON.stringify(policyInput),
      headers: {
        authorization: "Bearer inactive-realm-system-secret",
        "content-type": "application/json",
      },
      method: "PATCH",
    })
    expect(policySetResponse.status).toBe(409)
    expect(await policySetResponse.json()).toMatchObject({ error: { code: "passwords.not-active", status: 409 } })
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

test("password recovery distinguishes policy rejection from invalid tokens without consuming a valid token", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "passwords-recovery-policy.example.com")
    const system = realmSystemContextCreate("system")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    expect(
      passwordPolicySet({
        context: system,
        database,
        input: {
          lockoutDurationMs: 60_000,
          maximumAttempts: 5,
          minimumLength: 14,
          requireLowercase: false,
          requireNumber: false,
          requireSymbol: false,
          requireUppercase: false,
        },
        realmId: realm.id,
      }).success,
    ).toBe(true)

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

    let recoveryToken = ""
    expect(
      passwordRecoveryRequest({
        context,
        database,
        input: { email: "ada@example.com" },
        realmId: realm.id,
        onRecoveryToken: ({ token }) => {
          recoveryToken = token
        },
      }).success,
    ).toBe(true)
    expect(
      passwordRecoveryComplete({
        context,
        database,
        input: { newPassword: "short", token: recoveryToken },
        realmId: realm.id,
      }),
    ).toMatchObject({
      code: "passwords.policy-rejected",
      errorMessage: "The password does not meet the password policy.",
      success: false,
    })
    expect(
      passwordRecoveryComplete({
        context,
        database,
        input: { newPassword: "Recovered Horse 12", token: recoveryToken },
        realmId: realm.id,
      }),
    ).toEqual({ data: { changed: true }, success: true })
    expect(
      passwordRecoveryComplete({
        context,
        database,
        input: { newPassword: "short", token: recoveryToken },
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "passwords.invalid", success: false })

    expect(
      passwordRecoveryComplete({
        context,
        database,
        input: { newPassword: "short", token: "x".repeat(43) },
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "passwords.invalid", success: false })

    let expiredToken = ""
    expect(
      passwordRecoveryRequest({
        context,
        database,
        input: { email: "ada@example.com" },
        realmId: realm.id,
        onRecoveryToken: ({ token }) => {
          expiredToken = token
        },
      }).success,
    ).toBe(true)
    testkit.advance(60 * 60 * 1_000)
    expect(
      passwordRecoveryComplete({
        context,
        database,
        input: { newPassword: "short", token: expiredToken },
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "passwords.invalid", success: false })
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
