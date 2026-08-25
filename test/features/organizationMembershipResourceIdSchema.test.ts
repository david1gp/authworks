import { expect, test } from "bun:test"
import * as v from "valibot"
import { organizationMembershipListResponseSchema } from "../../src/features/organizations/public/organizationMembershipListResponseSchema.js"
import { organizationMembershipResourceIdSchema } from "../../src/features/organizations/public/organizationMembershipResourceIdSchema.js"
import { organizationMembershipResponseSchema } from "../../src/features/organizations/public/organizationMembershipResponseSchema.js"

const validMembership = {
  createdAt: 1,
  id: "018f0000-0000-7000-8000-000000000001",
  organizationId: "018f0000-0000-7000-8000-000000000002",
  realmId: "018f0000-0000-7000-8000-000000000003",
  roles: ["member"],
  updatedAt: 2,
  userId: "user-1",
}

const invalidMembershipIds = [
  "",
  "membership-",
  "membership-0",
  "membership-01",
  "membership-123456789012345678901",
  "membership-1/2",
  "membership-1\\2",
  "membership-1.2",
  "membership-1\u0000",
  "zitadel-membership-0-1",
  "zitadel-membership-01-1",
  "zitadel-membership-1-01",
  "zitadel-membership-123456789012345678901-1",
  "zitadel-membership-1-123456789012345678901",
  "zitadel-membership-1-2/3",
  "zitadel-membership-1-2\\3",
  "zitadel-membership-1-2.3",
  "zitadel-membership-1-2\n",
  "zitadel-membership-uuid-user",
  "../membership-1",
  "018f0000-0000-4000-8000-000000000001",
  "018F0000-0000-7000-8000-000000000001",
] as const

test("membership resource IDs accept only the Authworks and migrated grammars", () => {
  const valid = [
    "018f0000-0000-7000-8000-000000000001",
    "membership-1",
    "membership-12345678901234567890",
    "zitadel-membership-1-1",
    "zitadel-membership-12345678901234567890-98765432109876543210",
  ]
  for (const id of valid) expect(v.safeParse(organizationMembershipResourceIdSchema, id).success).toBe(true)
  for (const id of invalidMembershipIds)
    expect(v.safeParse(organizationMembershipResourceIdSchema, id).success).toBe(false)
})

test("membership public responses use the membership-specific resource ID schema", () => {
  for (const id of [
    "018f0000-0000-7000-8000-000000000001",
    "membership-1",
    "zitadel-membership-12345678901234567890-98765432109876543210",
  ]) {
    const membership = { ...validMembership, id }
    expect(v.safeParse(organizationMembershipResponseSchema, { membership }).success).toBe(true)
    expect(v.safeParse(organizationMembershipListResponseSchema, { items: [membership] }).success).toBe(true)
  }
  for (const id of invalidMembershipIds) {
    const membership = { ...validMembership, id }
    expect(v.safeParse(organizationMembershipResponseSchema, { membership }).success).toBe(false)
  }
})
