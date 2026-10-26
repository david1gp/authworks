import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { organizationCreate } from "../../organizations/actions/organizationCreate.js"
import { organizationLoginPolicySet } from "../../organizations/actions/organizationLoginPolicySet.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import { passwordChange } from "./passwordChange.js"
import { passwordEmailVerify } from "./passwordEmailVerify.js"
import { passwordRegister } from "./passwordRegister.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-password-change-"))
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

async function userSeed(database: StorageDatabase, realmId: string, email: string, userName: string) {
  const anonymous = realmTenantContextCreate(realmId, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context: anonymous,
    database,
    input: {
      email,
      organizationId: undefined,
      password: "Correct Horse 12",
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
  if (!verified.success) throw new Error(JSON.stringify(verified))
  return verified.data.user
}

test("a password change in a password-disabled organization is rejected without touching the credential", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "password-change-disabled.example.com", name: "disabled" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) throw new Error(realm.errorMessage)
    const realmId = realm.data.realm.id
    const organization = await organizationSeed(database, realmId, "No Passwords")
    const user = await userSeed(database, realmId, "disabled@example.com", "disabled-user")
    const disabled = organizationLoginPolicySet({
      context: realmSystemContextCreate("system"),
      database,
      input: { allowPassword: false },
      organizationId: organization.id,
      realmId,
    })
    expect(disabled.success).toBe(true)
    const before = passwordRepositoryCreate(database.db).passwordCredentialGet(realmId, user.id)
    expect(before.success).toBe(true)
    if (!before.success || before.data === null) throw new Error("The seeded credential was not found.")

    const changed = passwordChange({
      context: realmTenantContextCreate(realmId, "anonymous"),
      database,
      input: { currentPassword: "Correct Horse 12", newPassword: "Another Horse 34" },
      organizationId: organization.id,
      realmId,
      userId: user.id,
    })
    expect(changed).toMatchObject({ code: "passwords.forbidden", success: false })

    const after = passwordRepositoryCreate(database.db).passwordCredentialGet(realmId, user.id)
    expect(after.success).toBe(true)
    if (!after.success || after.data === null) throw new Error("The credential was unexpectedly removed.")
    expect(after.data.hash).toBe(before.data.hash)
    expect(after.data.version).toBe(before.data.version)
  })
})

test("a password change in a password-enabled organization succeeds", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "password-change-enabled.example.com", name: "enabled" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) throw new Error(realm.errorMessage)
    const realmId = realm.data.realm.id
    const organization = await organizationSeed(database, realmId, "Passwords Allowed")
    const user = await userSeed(database, realmId, "enabled@example.com", "enabled-user")
    const allowed = organizationLoginPolicySet({
      context: realmSystemContextCreate("system"),
      database,
      input: { allowPassword: true },
      organizationId: organization.id,
      realmId,
    })
    expect(allowed.success).toBe(true)

    const changed = passwordChange({
      context: realmTenantContextCreate(realmId, "anonymous"),
      database,
      input: { currentPassword: "Correct Horse 12", newPassword: "Another Horse 34" },
      organizationId: organization.id,
      realmId,
      userId: user.id,
    })
    expect(changed).toMatchObject({ data: { changed: true }, success: true })
  })
})
