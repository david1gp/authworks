import { describe, expect, test } from "bun:test"
import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import type { DirectoryMembership } from "../public/directoryMembershipSchema.js"
import { directoryOrganizationRolesGet } from "./directoryOrganizationRolesGet.js"

const user = {
  createdAt: 1_755_782_400_000,
  email: "david@example.com",
  emailVerified: true,
  id: "01900000-0000-7000-8000-000000000001",
  state: "active",
  userName: "david",
  verificationState: "verified",
} as const

const membership = (
  organizationId: string,
  organizationName: string,
  roles: readonly OrganizationRoleId[],
): DirectoryMembership => ({
  createdAt: 1_755_782_400_000,
  membershipId: `membership-${organizationId}`,
  organizationId,
  organizationName,
  roles: [...roles],
})

describe("directory organization roles resolution", () => {
  test("returns only the active organization roles when the user belongs to several organizations", () => {
    const entry: DirectoryEntry = {
      memberships: [
        membership("org-a", "Acme Corporation", ["owner"]),
        membership("org-b", "Globex Corporation", ["owner"]),
        membership("org-c", "Initech LLC", ["owner"]),
      ],
      user: { ...user },
    }
    expect(directoryOrganizationRolesGet(entry, "org-a")).toEqual(["owner"])
  })
  test("ignores roles from other organizations instead of merging them into the active scope", () => {
    const entry: DirectoryEntry = {
      memberships: [
        membership("org-a", "Acme Corporation", ["admin"]),
        membership("org-b", "Globex Corporation", ["member"]),
      ],
      user: { ...user },
    }
    expect(directoryOrganizationRolesGet(entry, "org-a")).toEqual(["admin"])
  })
  test("returns no roles when the user has no membership in the active organization", () => {
    const entry: DirectoryEntry = {
      memberships: [membership("org-b", "Globex Corporation", ["owner"])],
      user: { ...user },
    }
    expect(directoryOrganizationRolesGet(entry, "org-a")).toEqual([])
  })
  test("deduplicates repeated roles inside the active organization", () => {
    const entry: DirectoryEntry = {
      memberships: [
        membership("org-a", "Acme Corporation", ["owner"]),
        { ...membership("org-a", "Acme Corporation", ["owner", "admin"]), membershipId: "membership-org-a-2" },
      ],
      user: { ...user },
    }
    expect(directoryOrganizationRolesGet(entry, "org-a")).toEqual(["owner", "admin"])
  })
})
