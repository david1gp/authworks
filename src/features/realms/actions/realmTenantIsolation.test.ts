import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { passwordEmailVerify } from "../../passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../passwords/actions/passwordRegister.js"
import { sessionAuthenticate } from "../../sessions/actions/sessionAuthenticate.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import { sessionPasswordCreate } from "../../sessions/actions/sessionPasswordCreate.js"
import { realmSystemContextCreate } from "../domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../domain/realmTenantContextCreate.js"
import { realmCreate } from "./realmCreate.js"
import { realmGet } from "./realmGet.js"
import { realmTenantContextResolve } from "./realmTenantContextResolve.js"
import { realmUpdate } from "./realmUpdate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-realm-tenant-isolation-"))
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

function realmSeed(database: StorageDatabase, domain: string): string {
  const created = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm.id
}

function userSeed(database: StorageDatabase, realmId: string, userName: string): string {
  const context = realmTenantContextCreate(realmId, "anonymous")
  let verificationToken = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `${userName}@example.com`,
      password: "Correct Horse 12",
      profile: { displayName: userName },
      userName,
    },
    onVerificationToken: (delivery) => {
      verificationToken = delivery.token
    },
    realmId,
  })
  expect(registered.success).toBe(true)
  if (!registered.success) throw new Error(registered.errorMessage)
  const verified = passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId })
  expect(verified.success).toBe(true)
  if (!verified.success) throw new Error(verified.errorMessage)
  return verified.data.user.id
}

test("tenant contexts read only their own realm", async () => {
  await withDatabase(async (database) => {
    const alphaId = realmSeed(database, "tenant-alpha.example.com")
    const betaId = realmSeed(database, "tenant-beta.example.com")

    const alphaTenant = realmTenantContextCreate(alphaId, "anonymous")
    expect(realmGet({ context: alphaTenant, database, realmId: alphaId }).success).toBe(true)
    const crossRealm = realmGet({ context: alphaTenant, database, realmId: betaId })
    expect(crossRealm.success).toBe(false)

    const system = realmSystemContextCreate()
    expect(realmGet({ context: system, database, realmId: alphaId }).success).toBe(true)
    expect(realmGet({ context: system, database, realmId: betaId }).success).toBe(true)
  })
})

test("tenant hosts resolve by domain with ports stripped and unknown hosts rejected", async () => {
  await withDatabase(async (database) => {
    const alphaId = realmSeed(database, "tenant-host.example.com")

    const resolved = realmTenantContextResolve({ database, host: "tenant-host.example.com" })
    expect(resolved.success).toBe(true)
    if (!resolved.success) return
    expect(resolved.data.realmId).toBe(alphaId)

    const withPort = realmTenantContextResolve({ database, host: "tenant-host.example.com:5190" })
    expect(withPort.success).toBe(true)
    if (!withPort.success) return
    expect(withPort.data.realmId).toBe(alphaId)

    expect(realmTenantContextResolve({ database, host: "unknown-tenant.example.com" }).success).toBe(false)
    expect(realmTenantContextResolve({ database, host: "" }).success).toBe(false)
    expect(realmTenantContextResolve({ database }).success).toBe(false)
  })
})

test("sessions issued in one realm are rejected in another", async () => {
  await withDatabase(async (database) => {
    const alphaId = realmSeed(database, "session-alpha.example.com")
    const betaId = realmSeed(database, "session-beta.example.com")
    const userId = userSeed(database, alphaId, "cross-realm-user")

    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: alphaId,
      subjectId: userId,
      userId,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return

    expect(sessionAuthenticate({ database, realmId: alphaId, token: issued.data.token }).success).toBe(true)
    expect(sessionAuthenticate({ database, realmId: betaId, token: issued.data.token }).success).toBe(false)
  })
})

test("disabled realms reject password sign-in while system updates still apply", async () => {
  await withDatabase(async (database) => {
    const realmId = realmSeed(database, "disabled-realm.example.com")
    userSeed(database, realmId, "disabled-realm-user")
    const anonymous = realmTenantContextCreate(realmId, "anonymous")
    const loginInput = { identifier: "disabled-realm-user", password: "Correct Horse 12" }

    const beforeDisable = passwordLogin({
      context: anonymous,
      database,
      input: loginInput,
      realmId,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(beforeDisable.success).toBe(true)

    const disabled = realmUpdate({
      context: realmSystemContextCreate(),
      database,
      input: { status: "disabled" },
      realmId,
    })
    expect(disabled.success).toBe(true)
    if (!disabled.success) return
    expect(disabled.data.realm.status).toBe("disabled")

    // A disabled realm must not authenticate tenants, and a foreign tenant context is still rejected first.
    const blocked = passwordLogin({
      context: anonymous,
      database,
      input: loginInput,
      realmId,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(blocked.success).toBe(false)

    const reenabled = realmUpdate({
      context: realmSystemContextCreate(),
      database,
      input: { status: "active" },
      realmId,
    })
    expect(reenabled.success).toBe(true)
    expect(
      passwordLogin({
        context: anonymous,
        database,
        input: loginInput,
        realmId,
        sessionCreate: sessionPasswordCreate(),
      }).success,
    ).toBe(true)
  })
})
