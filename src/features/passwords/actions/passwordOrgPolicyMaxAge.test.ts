import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { organizationCreate } from "../../organizations/actions/organizationCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import { sessionPasswordCreate } from "../../sessions/actions/sessionPasswordCreate.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import type { PasswordPolicy } from "../public/passwordPolicySchema.js"
import { passwordEmailVerify } from "./passwordEmailVerify.js"
import { passwordLogin } from "./passwordLogin.js"
import { passwordOrgPolicyGet } from "./passwordOrgPolicyGet.js"
import { passwordOrgPolicySet } from "./passwordOrgPolicySet.js"
import { passwordPolicySet } from "./passwordPolicySet.js"
import { passwordRegister } from "./passwordRegister.js"

const dayMs = 24 * 60 * 60 * 1_000

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-password-org-policy-"))
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

function realmPolicy(overrides: Partial<PasswordPolicy> = {}): PasswordPolicy {
  return {
    lockoutDurationMs: 15 * 60 * 1_000,
    maximumAttempts: 5,
    minimumLength: 8,
    requireLowercase: false,
    requireNumber: false,
    requireSymbol: false,
    requireUppercase: false,
    ...overrides,
  }
}

async function realmSeed(database: StorageDatabase, domain: string) {
  const created = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

async function organizationSeed(database: StorageDatabase, realmId: string, name: string) {
  const created = organizationCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { name },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(JSON.stringify(created))
  return created.data.organization
}

async function userSeed(
  database: StorageDatabase,
  realmId: string,
  email: string,
  userName: string,
  password: string,
  organizationId?: string,
) {
  const anonymous = realmTenantContextCreate(realmId, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context: anonymous,
    database,
    input: {
      email,
      ...(organizationId === undefined ? {} : { organizationId }),
      password,
      profile: { displayName: userName },
      userName,
    },
    onVerificationToken: ({ token: verificationToken }) => {
      token = verificationToken
    },
    realmId,
  })
  expect(registered.success).toBe(true)
  if (!registered.success) throw new Error(JSON.stringify(registered))
  const verified = passwordEmailVerify({ context: anonymous, database, input: { token }, realmId })
  expect(verified.success).toBe(true)
  const user = passwordRepositoryCreate(database.db).passwordUserFindByIdentifier(realmId, userName)
  expect(user.success).toBe(true)
  if (!user.success || user.data === null) throw new Error("The seeded user was not found.")
  return user.data
}

function realmPolicySet(database: StorageDatabase, realmId: string, policy: PasswordPolicy) {
  const set = passwordPolicySet({
    context: realmSystemContextCreate("system"),
    database,
    input: policy,
    realmId,
  })
  expect(set.success).toBe(true)
  if (!set.success) throw new Error(JSON.stringify(set))
}

function orgPolicySet(database: StorageDatabase, realmId: string, organizationId: string, policy: PasswordPolicy) {
  const set = passwordOrgPolicySet({
    context: realmSystemContextCreate("system"),
    database,
    input: policy,
    organizationId,
    realmId,
  })
  expect(set.success).toBe(true)
  if (!set.success) throw new Error(JSON.stringify(set))
  return set.data.policy
}

test("a password older than maxAgeDays forces a change at login without a session", async () => {
  await withDatabase(async (database) => {
    const realm = await realmSeed(database, "max-age-expired.example.com")
    realmPolicySet(database, realm.id, realmPolicy({ maxAgeDays: 30 }))
    const user = await userSeed(database, realm.id, "ada@example.com", "ada", "Correct Horse 12")
    const backdated = database.runtime.now() - 31 * dayMs
    const updated = passwordRepositoryCreate(database.db).passwordCredentialUpdate(realm.id, user.id, {
      changedAt: backdated,
    })
    expect(updated.success).toBe(true)

    const loggedIn = passwordLogin({
      context: realmTenantContextCreate(realm.id, "anonymous"),
      database,
      input: { identifier: "ada", password: "Correct Horse 12" },
      realmId: realm.id,
    })
    expect(loggedIn.success).toBe(true)
    if (!loggedIn.success) throw new Error(loggedIn.errorMessage)
    expect(loggedIn.data.passwordChangeRequired).toBe(true)
    expect(loggedIn.data.session).toBeUndefined()
  })
})

test("a fresh password passes login while maxAgeDays is set", async () => {
  await withDatabase(async (database) => {
    const realm = await realmSeed(database, "max-age-fresh.example.com")
    realmPolicySet(database, realm.id, realmPolicy({ maxAgeDays: 30 }))
    await userSeed(database, realm.id, "grace@example.com", "grace", "Correct Horse 12")

    const loggedIn = passwordLogin({
      context: realmTenantContextCreate(realm.id, "anonymous"),
      database,
      input: { identifier: "grace", password: "Correct Horse 12" },
      realmId: realm.id,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(loggedIn.success).toBe(true)
    if (!loggedIn.success) throw new Error(loggedIn.errorMessage)
    expect(loggedIn.data.passwordChangeRequired).toBeUndefined()
    expect(loggedIn.data.session).toBeDefined()
  })
})

test("passwords never expire when maxAgeDays is unset", async () => {
  await withDatabase(async (database) => {
    const realm = await realmSeed(database, "max-age-unset.example.com")
    realmPolicySet(database, realm.id, realmPolicy({ maxAgeDays: null }))
    const user = await userSeed(database, realm.id, "alan@example.com", "alan", "Correct Horse 12")
    const backdated = database.runtime.now() - 400 * dayMs
    const updated = passwordRepositoryCreate(database.db).passwordCredentialUpdate(realm.id, user.id, {
      changedAt: backdated,
    })
    expect(updated.success).toBe(true)

    const loggedIn = passwordLogin({
      context: realmTenantContextCreate(realm.id, "anonymous"),
      database,
      input: { identifier: "alan", password: "Correct Horse 12" },
      realmId: realm.id,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(loggedIn.success).toBe(true)
    if (!loggedIn.success) throw new Error(loggedIn.errorMessage)
    expect(loggedIn.data.passwordChangeRequired).toBeUndefined()
    expect(loggedIn.data.session).toBeDefined()
  })
})

test("a stricter organization minimum length blocks registration while the realm allows it", async () => {
  await withDatabase(async (database) => {
    const realm = await realmSeed(database, "org-min-length.example.com")
    realmPolicySet(database, realm.id, realmPolicy({ minimumLength: 8 }))
    const organization = await organizationSeed(database, realm.id, "Strict")
    orgPolicySet(database, realm.id, organization.id, realmPolicy({ minimumLength: 20 }))

    const anonymous = realmTenantContextCreate(realm.id, "anonymous")
    const blocked = passwordRegister({
      context: anonymous,
      database,
      input: {
        email: "strict@example.com",
        organizationId: organization.id,
        password: "Twelve Chars1",
        profile: { displayName: "Strict" },
        userName: "strict",
      },
      realmId: realm.id,
    })
    expect(blocked.success).toBe(false)

    const allowed = passwordRegister({
      context: anonymous,
      database,
      input: {
        email: "lenient@example.com",
        password: "Twelve Chars1",
        profile: { displayName: "Lenient" },
        userName: "lenient",
      },
      realmId: realm.id,
    })
    expect(allowed.success).toBe(true)
  })
})

test("organization lockout overrides are honored at login", async () => {
  await withDatabase(async (database) => {
    const realm = await realmSeed(database, "org-lockout.example.com")
    realmPolicySet(database, realm.id, realmPolicy({ lockoutDurationMs: 60_000, maximumAttempts: 5 }))
    const organization = await organizationSeed(database, realm.id, "Lockout")
    orgPolicySet(database, realm.id, organization.id, realmPolicy({ lockoutDurationMs: 60_000, maximumAttempts: 2 }))
    await userSeed(database, realm.id, "org@example.com", "orguser", "Correct Horse 12", organization.id)
    await userSeed(database, realm.id, "realm@example.com", "realmuser", "Correct Horse 12")

    const context = realmTenantContextCreate(realm.id, "anonymous")
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const failed = passwordLogin({
        context,
        database,
        input: { identifier: "orguser", organizationId: organization.id, password: "Wrong Password 1" },
        realmId: realm.id,
      })
      expect(failed.success).toBe(false)
    }
    const locked = passwordLogin({
      context,
      database,
      input: { identifier: "orguser", organizationId: organization.id, password: "Correct Horse 12" },
      realmId: realm.id,
    })
    expect(locked.success).toBe(false)

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const failed = passwordLogin({
        context,
        database,
        input: { identifier: "realmuser", password: "Wrong Password 1" },
        realmId: realm.id,
      })
      expect(failed.success).toBe(false)
    }
    const realmLogin = passwordLogin({
      context,
      database,
      input: { identifier: "realmuser", password: "Correct Horse 12" },
      realmId: realm.id,
    })
    expect(realmLogin.success).toBe(true)
  })
})

test("organization overrides do not leak across organizations", async () => {
  await withDatabase(async (database) => {
    const realm = await realmSeed(database, "org-isolation.example.com")
    realmPolicySet(database, realm.id, realmPolicy({ minimumLength: 8 }))
    const first = await organizationSeed(database, realm.id, "First")
    const second = await organizationSeed(database, realm.id, "Second")
    orgPolicySet(database, realm.id, first.id, realmPolicy({ minimumLength: 20 }))

    const system = realmSystemContextCreate("system")
    const firstPolicy = passwordOrgPolicyGet({
      context: system,
      database,
      organizationId: first.id,
      realmId: realm.id,
    })
    expect(firstPolicy.success).toBe(true)
    if (!firstPolicy.success) throw new Error(firstPolicy.errorMessage)
    expect(firstPolicy.data.policy.minimumLength).toBe(20)

    const secondPolicy = passwordOrgPolicyGet({
      context: system,
      database,
      organizationId: second.id,
      realmId: realm.id,
    })
    expect(secondPolicy.success).toBe(true)
    if (!secondPolicy.success) throw new Error(secondPolicy.errorMessage)
    expect(secondPolicy.data.policy.minimumLength).toBe(8)

    const events = database.db
      .select()
      .from(storageEventTable)
      .where(eq(storageEventTable.eventType, "password.policy_changed"))
      .all()
    expect(events.length).toBeGreaterThan(0)
    for (const event of events) {
      const payload = event.payload as Record<string, unknown>
      expect(payload).not.toHaveProperty("hash")
      expect(payload).not.toHaveProperty("password")
      expect(payload).not.toHaveProperty("token")
    }
  })
})
