import { expect, test } from "bun:test"
import { accountEffectiveAccessGroupsCreate } from "../../src/features/account/model/accountEffectiveAccessGroupsCreate.js"
import type { AccountEffectiveAccessEntry } from "../../src/features/account/public/accountEffectiveAccessEntrySchema.js"

const organization = (id: string, name: string) => ({
  membership: {
    createdAt: 1,
    id: `membership-${id}`,
    organizationId: id,
    realmId: "realm-1",
    roles: ["member"],
    updatedAt: 1,
    userId: "user-1",
  },
  organization: {
    createdAt: 1,
    id,
    name,
    realmId: "realm-1",
    status: "active" as const,
    updatedAt: 1,
  },
})

test("effective access state groups flat entries by organization in stable order", () => {
  const entries: AccountEffectiveAccessEntry[] = [
    {
      id: "project:zeta",
      organization: organization("zeta", "Zeta"),
      permissions: ["project.read"],
      project: {
        authorizationRequired: true,
        createdAt: 1,
        id: "zeta-project",
        name: "Zeta project",
        organizationId: "zeta",
        projectAccessRequired: true,
        realmId: "realm-1",
        status: "active",
        updatedAt: 1,
      },
      roleKeys: ["member"],
      source: "project-owner",
    },
    {
      id: "organization:zeta",
      organization: organization("zeta", "Zeta"),
      permissions: ["organization.read"],
      roleKeys: ["member"],
      source: "membership",
    },
    {
      id: "organization:alpha",
      organization: organization("alpha", "Alpha"),
      permissions: ["organization.read"],
      roleKeys: ["member"],
      source: "membership",
    },
  ]

  const groups = accountEffectiveAccessGroupsCreate(entries)

  expect(groups.map((group) => group.organization.id)).toEqual(["alpha", "zeta"])
  expect(groups[1]?.entries.map((entry) => entry.id)).toEqual(["organization:zeta", "project:zeta"])
})
