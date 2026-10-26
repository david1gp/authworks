import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { passwordEmailVerify } from "../../passwords/actions/passwordEmailVerify.js"
import { passwordRegister } from "../../passwords/actions/passwordRegister.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import type { EmailOtpSecurityNotification } from "../public/emailOtpSecurityNotificationSchema.js"
import { emailOtpSecurityNotificationLogCreate } from "./emailOtpSecurityNotificationLogCreate.js"
import { emailOtpServerAppCreate } from "./emailOtpServerAppCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-email-otp-notification-"))
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

async function verifiedUserSeed(database: StorageDatabase, domain: string) {
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const realmId = realm.data.realm.id
  const context = realmTenantContextCreate(realmId, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: "otp@example.com",
      password: "Correct Horse 12",
      profile: { displayName: "OTP User" },
      userName: "otp-user",
    },
    realmId,
    onVerificationToken: (value) => {
      token = value.token
    },
  })
  expect(registered.success).toBe(true)
  const verified = passwordEmailVerify({ context, database, input: { token }, realmId })
  expect(verified.success).toBe(true)
  return { domain, realmId }
}

test("a failed email OTP verify invokes the wired security notification port", async () => {
  await withDatabase(async (database) => {
    const { domain, realmId } = await verifiedUserSeed(database, "email-otp-notify.example.com")
    let delivery: { challengeId: string; code: string } | undefined
    const notifications: EmailOtpSecurityNotification[] = []
    const app = emailOtpServerAppCreate({
      database,
      onDelivery: (value) => {
        delivery = { challengeId: value.challengeId, code: value.code }
      },
      onSecurityNotification: (notification) => {
        notifications.push(notification)
      },
    })
    const started = await app.request(`https://${domain}/realms/${realmId}/email-otp/start`, {
      body: JSON.stringify({ email: "otp@example.com" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    expect(started.status).toBe(200)
    if (delivery === undefined) throw new Error("The OTP delivery was not captured.")

    const verified = await app.request(`https://${domain}/realms/${realmId}/email-otp/verify`, {
      body: JSON.stringify({ challengeId: delivery.challengeId, code: "000000" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    expect(verified.status).not.toBe(200)
    expect(notifications).toHaveLength(2)
    expect(notifications[0]).toMatchObject({ challengeId: delivery.challengeId, kind: "requested", realmId })
    expect(notifications[1]).toMatchObject({ challengeId: delivery.challengeId, kind: "failed", realmId })
  })
})

test("the default email OTP notification port logs a structured event without secrets", async () => {
  const port = emailOtpSecurityNotificationLogCreate()
  expect(typeof port).toBe("function")
  const lines: string[] = []
  const original = console.info
  console.info = (...values: unknown[]) => {
    lines.push(values.map((value) => String(value)).join(" "))
  }
  try {
    port({ challengeId: "challenge-1", kind: "failed", realmId: "realm-1", userId: "user-1" })
  } finally {
    console.info = original
  }
  expect(lines).toHaveLength(1)
  const logged = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>
  expect(logged).toMatchObject({
    challengeId: "challenge-1",
    event: "email-otp.security-notification",
    kind: "failed",
    realmId: "realm-1",
    userId: "user-1",
  })
  expect(JSON.stringify(logged)).not.toContain("code")
})
