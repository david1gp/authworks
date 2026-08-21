import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { demoAdminOrganizationDomains } from "../../src/features/demo/demoAdminOrganizationDomains.js"
import { demoAdminOrganizationInvitations } from "../../src/features/demo/demoAdminOrganizationInvitations.js"
import { demoAdminOrganizationProviders } from "../../src/features/demo/demoAdminOrganizationProviders.js"
import { demoAdminOrganizationRoles } from "../../src/features/demo/demoAdminOrganizationRoles.js"
import { externalIdentityProviderSchema } from "../../src/features/externalIdentities/public/externalIdentityProviderSchema.js"
import { organizationDomainSchema } from "../../src/features/organizations/public/organizationDomainSchema.js"
import { organizationInvitationSchema } from "../../src/features/organizations/public/organizationInvitationSchema.js"
import { organizationRoleSchema } from "../../src/features/organizations/public/organizationRoleSchema.js"
import { organizationAdminDemoAdapterCreate } from "../../src/features/organizations/ui/organizationAdminDemoAdapterCreate.js"

const organizationId = "01900000-0000-7000-8000-000000000011"

describe("organization administration demo fixtures", () => {
  test("parse against the public transport schemas", () => {
    expect(v.safeParse(v.array(organizationDomainSchema), demoAdminOrganizationDomains).success).toBe(true)
    expect(v.safeParse(v.array(organizationInvitationSchema), demoAdminOrganizationInvitations).success).toBe(true)
    expect(v.safeParse(v.array(externalIdentityProviderSchema), demoAdminOrganizationProviders).success).toBe(true)
    expect(v.safeParse(v.array(organizationRoleSchema), demoAdminOrganizationRoles).success).toBe(true)
  })

  test("expose only the four fixed organization roles", () => {
    expect(demoAdminOrganizationRoles.map((role) => role.id)).toEqual(["owner", "admin", "member", "guest"])
  })
})

describe("organization administration demo adapter", () => {
  test("returns fixture collections for the success state", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")

    const organizations = await adapter.organizationList()
    const memberships = await adapter.membershipList(organizationId)

    expect(organizations.success && organizations.data.items.length).toBeGreaterThan(0)
    expect(memberships.success && memberships.data.items.length).toBeGreaterThan(0)
  })

  test("returns empty collections for the empty state", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "empty")

    const invitations = await adapter.invitationList(organizationId)
    const domains = await adapter.domainList(organizationId)

    expect(invitations.success && invitations.data.items).toEqual([])
    expect(domains.success && domains.data.items).toEqual([])
  })

  test("maps the denied state onto a forbidden result", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "permission-denied")

    const result = await adapter.organizationList()

    expect(result.success).toBe(false)
    expect(result.success === false && result.statusCode).toBe(403)
  })

  test("never returns a stored provider client secret", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")

    const created = await adapter.providerCreate({
      allowAccountCreation: true,
      clientId: "client-id",
      clientSecret: "super-secret-value",
      displayName: "Google",
      redirectUri: "https://auth.example/callback",
      type: "google",
    })
    const list = await adapter.providerList(organizationId)

    expect(created.success).toBe(true)
    expect(JSON.stringify(created)).not.toContain("super-secret-value")
    expect(JSON.stringify(list)).not.toContain("super-secret-value")
  })

  test("issues an invitation token exactly once at creation", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")

    const created = await adapter.invitationCreate(organizationId, { email: "new@example.com", roles: ["member"] })
    const list = await adapter.invitationList(organizationId)

    expect(created.success && created.data.token.length).toBeGreaterThan(0)
    const token = created.success ? created.data.token : ""
    expect(JSON.stringify(list)).not.toContain(token)
  })

  test("verifies a claimed domain and clears its DNS challenge", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")

    const verified = await adapter.domainVerify(organizationId, "acme-labs.example")

    expect(verified.success && verified.data.domain.verified).toBe(true)
    expect(verified.success && verified.data.domain.verification).toBeUndefined()
  })

  test("never settles while the loading state is selected", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "loading")
    let settled = false

    void adapter.organizationList().then(() => {
      settled = true
    })
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(settled).toBe(false)
  })
})
