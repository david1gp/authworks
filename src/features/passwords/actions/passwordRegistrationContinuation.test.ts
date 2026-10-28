import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import { passwordRegistrationRequestSchema } from "../public/passwordRegistrationRequestSchema.js"
import { passwordEmailVerify } from "./passwordEmailVerify.js"
import { passwordRegister } from "./passwordRegister.js"

const input = {
  email: "invitee@example.com",
  password: "Correct Horse 12",
  profile: { displayName: "Invitee" },
  userName: "invitee",
}
const destination = "/invitations/accept?token=a%2Bb%3D&next=x#part"

test("registration accepts only safe local continuations", () => {
  expect(v.safeParse(passwordRegistrationRequestSchema, { ...input, returnTo: destination }).success).toBe(true)
  expect(v.safeParse(passwordRegistrationRequestSchema, input).success).toBe(true)
  for (const returnTo of [
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil",
    "/%5cevil",
    "/%2f%2fevil",
    "/bad%0a",
    "/bad%zz",
  ]) {
    expect(v.safeParse(passwordRegistrationRequestSchema, { ...input, returnTo }).success).toBe(false)
  }
})

test("registration sends the exact continuation with the verification token, without signing in", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-registration-continuation-"))
  const opened = storageDatabaseOpen(join(directory, "db.sqlite"), platformTestkitCreate().runtime)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    const database = opened.data
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "invite.example.com", name: "Invite" },
    })
    if (!realm.success) throw new Error(realm.errorMessage)
    const realmId = realm.data.realm.id
    const context = realmTenantContextCreate(realmId, "anonymous")
    let delivery: { token: string; returnTo?: string } | undefined
    const registered = passwordRegister({
      context,
      database,
      input: { ...input, returnTo: destination },
      realmId,
      onVerificationToken: (value) => {
        delivery = value
      },
    })
    expect(registered.success).toBe(true)
    expect(delivery?.returnTo).toBe(destination)
    expect(delivery?.token).toBeDefined()
    const verified = passwordEmailVerify({ context, database, input: { token: delivery?.token ?? "" }, realmId })
    expect(verified.success).toBe(true)
  } finally {
    opened.data.close()
    await rm(directory, { recursive: true, force: true })
  }
})
