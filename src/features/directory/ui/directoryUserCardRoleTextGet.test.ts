import { describe, expect, test } from "bun:test"
import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import type { DirectoryMembership } from "../public/directoryMembershipSchema.js"
import { directoryUserCardRoleTextGet } from "./directoryUserCardRoleTextGet.js"

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

describe("directory user card role text", () => {
  test("joins organization roles with commas in organization scope", () => {
    const entry: DirectoryEntry = {
      team: null,
      memberships: [membership("org-a", "Acme Corporation", ["owner", "admin"])],
      user: { ...user },
    }
    expect(directoryUserCardRoleTextGet(entry, "org-a", "organization")).toBe("Owner, Admin")
  })
  test("ignores other organizations in organization scope", () => {
    const entry: DirectoryEntry = {
      team: null,
      memberships: [
        membership("org-a", "Acme Corporation", ["member"]),
        membership("org-b", "Globex Corporation", ["owner"]),
      ],
      user: { ...user },
    }
    expect(directoryUserCardRoleTextGet(entry, "org-a", "organization")).toBe("Member")
  })
  test("renders one org segment per membership in all scope", () => {
    const entry: DirectoryEntry = {
      team: null,
      memberships: [
        membership("org-a", "Acme Corporation", ["owner", "admin"]),
        membership("org-b", "Globex Corporation", ["guest"]),
      ],
      user: { ...user },
    }
    expect(directoryUserCardRoleTextGet(entry, "org-a", "all")).toBe(
      "Acme Corporation: Owner, Admin · Globex Corporation: Guest",
    )
  })
  test("returns empty text when the entry has no roles in scope", () => {
    const entry: DirectoryEntry = {
      team: null,
      memberships: [membership("org-b", "Globex Corporation", ["owner"])],
      user: { ...user },
    }
    expect(directoryUserCardRoleTextGet(entry, "org-a", "organization")).toBe("")
  })
})
