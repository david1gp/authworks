import { expect, test } from "bun:test"
import * as v from "valibot"
import { realmResourceIdSchema } from "../../src/features/realms/public/realmResourceIdSchema.js"
import { userListResponseSchema } from "../../src/features/users/public/userListResponseSchema.js"
import { userResourceIdSchema } from "../../src/features/users/public/userResourceIdSchema.js"
import { userCurrentResponseSchema } from "../../src/features/users/public/userCurrentResponseSchema.js"
import { userResponseSchema } from "../../src/features/users/public/userResponseSchema.js"
import { userSchema } from "../../src/features/users/public/userSchema.js"

const realmId = "01900000-0000-7000-8000-000000000001"

function userCreate(id: string) {
  return {
    createdAt: 1700000000000,
    email: "user@example.com",
    emailVerified: true,
    id,
    profile: { displayName: "Example User" },
    realmId,
    state: "active" as const,
    updatedAt: 1700000000000,
    userName: "example-user",
    verificationState: "verified" as const,
  }
}

test("public user response and list schemas accept Authworks and migrated user IDs", () => {
  for (const id of ["01900000-0000-7000-8000-000000000002", "7", "12345678901234567890"]) {
    const user = userCreate(id)
    expect(v.safeParse(userSchema, user).success).toBe(true)
    expect(v.safeParse(userResponseSchema, { user }).success).toBe(true)
    expect(v.safeParse(userCurrentResponseSchema, { capabilities: { realmRead: true }, user }).success).toBe(true)
    expect(
      v.safeParse(userCurrentResponseSchema, { capabilities: { permissions: ["realm.read"] }, user }).success,
    ).toBe(false)
    expect(v.safeParse(userListResponseSchema, { items: [user] }).success).toBe(true)
  }
})

test("user and realm resource schemas reject malformed or path-dangerous identifiers", () => {
  for (const id of ["0", "01", "123456789012345678901", "../user", "01900000-0000-4000-8000-000000000001"]) {
    expect(v.safeParse(userResourceIdSchema, id).success).toBe(false)
  }
  for (const id of ["7", "../realm", "01900000-0000-7000-8000-00000000000a".toUpperCase()]) {
    expect(v.safeParse(realmResourceIdSchema, id).success).toBe(false)
  }
  expect(v.safeParse(userSchema, userCreate("7")).success).toBe(true)
  expect(v.safeParse(userSchema, { ...userCreate("7"), realmId: "7" }).success).toBe(false)
})
