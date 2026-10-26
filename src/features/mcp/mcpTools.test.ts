import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import type { StorageDatabase } from "../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../platform/testkit/platformTestkitCreate.js"
import { machineApiKeyCreate } from "../machineUsers/actions/machineApiKeyCreate.js"
import { machineUserCreate } from "../machineUsers/actions/machineUserCreate.js"
import { oidcClientCreate } from "../oidc/actions/oidcClientCreate.js"
import { oidcSigningKeyCreate } from "../oidc/actions/oidcSigningKeyCreate.js"
import { organizationCreate } from "../organizations/actions/organizationCreate.js"
import { organizationInvitationCreate } from "../organizations/actions/organizationInvitationCreate.js"
import { organizationMembershipCreate } from "../organizations/actions/organizationMembershipCreate.js"
import { realmAdministratorGrant } from "../realms/actions/realmAdministratorGrant.js"
import { realmCreate } from "../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../realms/domain/realmSystemContextCreate.js"
import type { RealmTenantContext } from "../realms/server/index.js"
import { userCreate } from "../users/actions/userCreate.js"
import { mcpHttpHandlerCreate } from "./mcpHttpHandler.js"
import { mcpReadToolsRegister } from "./mcpReadToolsRegister.js"
import { mcpToolRegistryCreate } from "./mcpToolRegistry.js"
import { valibotToJsonSchema } from "./mcpValibotJsonSchema.js"
import { mcpWriteToolsRegister } from "./mcpWriteToolsRegister.js"

type McpToolsSeed = {
  readonly database: StorageDatabase
  readonly handle: (request: Request) => Promise<Response>
  readonly organizationId: string
  readonly realmId: string
  readonly unscopedSecret: string
}

const mcpToolsFullScopes = [
  "organization.read",
  "organization.manage",
  "organization.members.manage",
  "project.read",
  "project.create",
  "project.write",
  "project.role.read",
  "project.role.write",
  "project.grant.read",
  "project.grant.create",
  "project.grant.write",
  "project.grant.delete",
  "project.app.read",
  "project.app.write",
  "project.app.delete",
  "event.read",
  "user.read",
  "user.manage",
]

async function withSeededDatabase<T>(operation: (seed: McpToolsSeed) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-mcp-tools-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    const database = opened.data
    const system = realmSystemContextCreate()
    const realmCreated = realmCreate({
      context: system,
      database,
      input: { domain: "mcp-tools.example.com", name: "mcp-tools.example.com" },
    })
    expect(realmCreated.success).toBe(true)
    if (!realmCreated.success) throw new Error(realmCreated.errorMessage)
    const realmId = realmCreated.data.realm.id
    const organizationCreated = organizationCreate({ context: system, database, input: { name: "MCP" }, realmId })
    expect(organizationCreated.success).toBe(true)
    if (!organizationCreated.success) throw new Error(organizationCreated.errorMessage)
    const organizationId = organizationCreated.data.organization.id
    const machineUserCreated = machineUserCreate({
      context: system,
      database,
      input: { displayName: "MCP tools worker", userName: "mcp-tools-worker" },
      organizationId,
      realmId,
    })
    expect(machineUserCreated.success).toBe(true)
    if (!machineUserCreated.success) throw new Error(machineUserCreated.errorMessage)
    // Organization tools require actor membership; scopes alone are not enough.
    const seedMembershipCreated = organizationMembershipCreate({
      context: system,
      database,
      input: { roles: ["member"], userId: machineUserCreated.data.machineUser.id },
      organizationId,
      realmId,
    })
    expect(seedMembershipCreated.success).toBe(true)
    if (!seedMembershipCreated.success) throw new Error(seedMembershipCreated.errorMessage)
    const apiKeyCreated = machineApiKeyCreate({
      context: system,
      database,
      input: { machineUserId: machineUserCreated.data.machineUser.id, name: "mcp-tools-test" },
      organizationId,
      realmId,
    })
    expect(apiKeyCreated.success).toBe(true)
    if (!apiKeyCreated.success) throw new Error(apiKeyCreated.errorMessage)
    const handle = mcpHttpHandlerCreate({ database })
    return await operation({ database, handle, organizationId, realmId, unscopedSecret: apiKeyCreated.data.secret })
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

type McpToolsScopedCredential = {
  readonly machineUserId: string
  readonly secret: string
}

function scopedCredentialCreate(seed: McpToolsSeed, scopes: readonly string[], name: string): McpToolsScopedCredential {
  const system = realmSystemContextCreate()
  const machineUserCreated = machineUserCreate({
    context: system,
    database: seed.database,
    input: { displayName: name, scopes: [...scopes], userName: name },
    organizationId: seed.organizationId,
    realmId: seed.realmId,
  })
  expect(machineUserCreated.success).toBe(true)
  if (!machineUserCreated.success) throw new Error(machineUserCreated.errorMessage)
  const membershipCreated = organizationMembershipCreate({
    context: system,
    database: seed.database,
    input: { roles: ["admin"], userId: machineUserCreated.data.machineUser.id },
    organizationId: seed.organizationId,
    realmId: seed.realmId,
  })
  expect(membershipCreated.success).toBe(true)
  if (!membershipCreated.success) throw new Error(membershipCreated.errorMessage)
  const apiKeyCreated = machineApiKeyCreate({
    context: system,
    database: seed.database,
    input: {
      machineUserId: machineUserCreated.data.machineUser.id,
      name: `${name}-key`,
      scopes: [...scopes],
    },
    organizationId: seed.organizationId,
    realmId: seed.realmId,
  })
  expect(apiKeyCreated.success).toBe(true)
  if (!apiKeyCreated.success) throw new Error(apiKeyCreated.errorMessage)
  return { machineUserId: machineUserCreated.data.machineUser.id, secret: apiKeyCreated.data.secret }
}

// Organization tools authorize actors per organization: enroll the credential
// in every organization it must manage beyond its home organization.
function organizationMemberEnroll(
  seed: McpToolsSeed,
  credential: McpToolsScopedCredential,
  organizationId: string,
): void {
  const enrolled = organizationMembershipCreate({
    context: realmSystemContextCreate(),
    database: seed.database,
    input: { roles: ["admin"], userId: credential.machineUserId },
    organizationId,
    realmId: seed.realmId,
  })
  expect(enrolled.success).toBe(true)
  if (!enrolled.success) throw new Error(enrolled.errorMessage)
}

async function mcpCall(
  seed: McpToolsSeed,
  secret: string,
  name: string,
  args: unknown,
): Promise<{ readonly isError?: true; readonly text: string }> {
  const response = await seed.handle(
    new Request(`https://example.test/mcp?realmId=${seed.realmId}`, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/call", params: { arguments: args, name } }),
    }),
  )
  expect(response.status).toBe(200)
  const body = (await response.json()) as {
    result: { readonly content: readonly [{ readonly text: string }]; readonly isError?: true }
  }
  return { ...body.result, text: body.result.content[0]?.text ?? "" }
}

function mcpResultDataParse(text: string): { readonly success: boolean; readonly [field: string]: unknown } {
  return JSON.parse(text) as { readonly success: boolean; readonly [field: string]: unknown }
}

function mcpTenantContextCreate(realmId: string, actorId: string): RealmTenantContext {
  return {
    actor: { actorId, assurance: "authenticated", authenticationMethod: "api_key", kind: "machine", realmId },
    actorId,
    kind: "tenant",
    realmId,
  }
}

test("converts date record and tuple schemas to JSON schema", () => {
  expect(valibotToJsonSchema(v.date())).toMatchObject({ format: "date-time", type: "string" })
  expect(valibotToJsonSchema(v.record(v.string(), v.number()))).toMatchObject({
    additionalProperties: { type: "number" },
    type: "object",
  })
  expect(valibotToJsonSchema(v.tuple([v.string(), v.number()]))).toMatchObject({
    minItems: 2,
    maxItems: 2,
    prefixItems: [{ type: "string" }, { type: "number" }],
    type: "array",
  })
  expect(valibotToJsonSchema(v.tupleWithRest([v.string()], v.number()))).toMatchObject({
    items: { type: "number" },
    minItems: 1,
    prefixItems: [{ type: "string" }],
    type: "array",
  })
})

test("emits the correct JSON type for literal and picklist values", () => {
  expect(valibotToJsonSchema(v.literal(42))).toMatchObject({ const: 42, type: "integer" })
  expect(valibotToJsonSchema(v.literal(4.5))).toMatchObject({ const: 4.5, type: "number" })
  expect(valibotToJsonSchema(v.literal(true))).toMatchObject({ const: true, type: "boolean" })
  expect(valibotToJsonSchema(v.literal("active"))).toMatchObject({ const: "active", type: "string" })
  expect(valibotToJsonSchema(v.picklist(["oidc", "api"]))).toMatchObject({
    enum: ["oidc", "api"],
    type: "string",
  })
  const mixed = valibotToJsonSchema(v.picklist([1, "api"]))
  expect(mixed).toMatchObject({ enum: [1, "api"] })
  expect(mixed).not.toHaveProperty("type")
})

test("registers the expanded read and write tool sets", async () => {
  await withSeededDatabase(async (seed) => {
    const context = mcpTenantContextCreate(seed.realmId, "audit")
    const read = mcpReadToolsRegister({ context, database: seed.database, realmId: seed.realmId, scopes: [] })
    const write = mcpWriteToolsRegister({ context, database: seed.database, realmId: seed.realmId })
    const readNames = read.map((tool) => tool.name).sort()
    const writeNames = write.map((tool) => tool.name).sort()
    expect(readNames).toEqual(
      [
        "event-list",
        "machine-credential-list",
        "machine-user-get",
        "machine-user-list",
        "oidc-client-get",
        "oidc-client-list",
        "oidc-discovery-get",
        "oidc-jwks-get",
        "oidc-signing-key-list",
        "organization-branding-get",
        "organization-domain-list",
        "organization-get",
        "organization-invitation-list",
        "organization-list",
        "organization-login-policy-get",
        "organization-membership-list",
        "organization-metadata-get",
        "organization-metadata-list",
        "ping",
        "project-application-list",
        "project-get",
        "project-grant-list",
        "project-list",
        "project-role-list",
        "project-user-assignment-list",
        "realm-get",
        "server-info",
        "session-list",
        "user-get",
        "user-list",
        "user-metadata-get",
        "user-metadata-list",
      ].sort(),
    )
    expect(writeNames).toEqual(
      [
        "machine-credential-issue",
        "machine-credential-revoke",
        "machine-user-create",
        "machine-user-lifecycle-set",
        "organization-branding-set",
        "organization-create",
        "organization-domain-claim",
        "organization-domain-remove",
        "organization-domain-verify",
        "organization-invitation-revoke",
        "organization-lifecycle-set",
        "organization-login-policy-set",
        "organization-membership-create",
        "organization-membership-remove",
        "organization-membership-update",
        "organization-metadata-remove",
        "organization-metadata-set",
        "organization-update",
        "project-application-create",
        "project-application-remove",
        "project-application-update",
        "project-create",
        "project-grant-create",
        "project-grant-lifecycle-set",
        "project-grant-remove",
        "project-grant-update",
        "project-role-create",
        "project-role-remove",
        "project-role-update",
        "project-update",
        "project-user-assignment-create",
        "project-user-assignment-remove",
        "user-create",
        "user-delete",
        "user-email-verification-set",
        "user-lifecycle-set",
        "user-metadata-remove",
        "user-metadata-set",
        "user-profile-update",
      ].sort(),
    )
    // Intentional exclusions: no matching safe machine-context surface exists.
    expect([...readNames, ...writeNames]).not.toContain("organization-invitation-create")
    expect([...readNames, ...writeNames]).not.toContain("user-email-primary-set")
    expect([...readNames, ...writeNames]).not.toContain("project-user-assignment-update")
    expect([...readNames, ...writeNames]).not.toContain("project-application-lifecycle-set")
    // Item 20 exclusions: secret-bearing or oversized surfaces stay out of MCP
    // by design (machine secret rotate, session revoke, OIDC secret writes,
    // event export). Use the Admin/CLI/API surfaces instead.
    expect([...readNames, ...writeNames]).not.toContain("machine-credential-rotate")
    expect([...readNames, ...writeNames]).not.toContain("session-revoke")
    expect([...readNames, ...writeNames]).not.toContain("oidc-client-secret-rotate")
    expect([...readNames, ...writeNames]).not.toContain("oidc-client-secret-revoke")
    expect([...readNames, ...writeNames]).not.toContain("event-export")
  })
})

test("no registered tool input property serializes to an empty schema", async () => {
  await withSeededDatabase(async (seed) => {
    const context = mcpTenantContextCreate(seed.realmId, "audit")
    const tools = [
      ...mcpReadToolsRegister({ context, database: seed.database, realmId: seed.realmId, scopes: [] }),
      ...mcpWriteToolsRegister({ context, database: seed.database, realmId: seed.realmId }),
    ]
    const emptyPaths: string[] = []
    const emptySchemaWalk = (node: unknown, path: string): void => {
      if (node === null || typeof node !== "object" || Array.isArray(node)) return
      const entries = Object.entries(node as Record<string, unknown>).filter(([key]) => key !== "$schema")
      if (entries.length === 0) {
        emptyPaths.push(path)
        return
      }
      for (const [key, value] of entries) {
        if (key === "properties" && value !== null && typeof value === "object" && !Array.isArray(value)) {
          for (const [property, schema] of Object.entries(value as Record<string, unknown>))
            emptySchemaWalk(schema, `${path}.${property}`)
        } else if (key === "items" || key === "additionalProperties") emptySchemaWalk(value, `${path}.${key}`)
        else if (
          (key === "prefixItems" || key === "oneOf" || key === "anyOf" || key === "allOf") &&
          Array.isArray(value)
        )
          value.forEach((entry, index) => {
            emptySchemaWalk(entry, `${path}.${key}[${index}]`)
          })
      }
    }
    for (const tool of tools) emptySchemaWalk(valibotToJsonSchema(tool.inputSchema), tool.name)
    expect(emptyPaths).toEqual([])
  })
})

test("realm-get preserves the action error code", async () => {
  await withSeededDatabase(async (seed) => {
    const mismatched = mcpTenantContextCreate("00000000-0000-7000-8000-000000000000", "audit")
    const registry = mcpToolRegistryCreate(
      mcpReadToolsRegister({ context: mismatched, database: seed.database, realmId: seed.realmId, scopes: [] }),
    )
    const failed = await registry.call("realm-get", {})
    expect(failed.isError).toBe(true)
    expect(mcpResultDataParse(failed.content[0]?.text ?? "").success).toBe(false)
    expect(failed.content[0]?.text ?? "").toContain("realms.tenant-mismatch")

    const secret = scopedCredentialCreate(seed, [], "realm-get-happy").secret
    const happy = await mcpCall(seed, secret, "realm-get", {})
    expect(happy.isError).toBeUndefined()
    expect((mcpResultDataParse(happy.text).data as { realm: { id: string } }).realm.id).toBe(seed.realmId)
  })
})

test("event-list stays forbidden without the event read scope", async () => {
  await withSeededDatabase(async (seed) => {
    const denied = await mcpCall(seed, seed.unscopedSecret, "event-list", {})
    expect(denied.isError).toBe(true)
    expect(denied.text).toContain("authorization.forbidden")

    const secret = scopedCredentialCreate(seed, ["event.read"], "event-reader-tools").secret
    const allowed = await mcpCall(seed, secret, "event-list", {})
    expect(allowed.isError).toBeUndefined()
  })
})

test("organization tools run with the matching scopes", async () => {
  await withSeededDatabase(async (seed) => {
    const credential = scopedCredentialCreate(seed, mcpToolsFullScopes, "org-tools-worker")
    const secret = credential.secret

    // organization-create requires a user actor; machine credentials cannot call it.
    const system = realmSystemContextCreate()
    const orgCreated = organizationCreate({
      context: system,
      database: seed.database,
      input: { name: "MCP org tools" },
      realmId: seed.realmId,
    })
    expect(orgCreated.success).toBe(true)
    if (!orgCreated.success) throw new Error(orgCreated.errorMessage)
    const organizationId = orgCreated.data.organization.id
    organizationMemberEnroll(seed, credential, organizationId)

    const listed = await mcpCall(seed, secret, "organization-list", {})
    expect(listed.isError).toBeUndefined()
    const fetched = await mcpCall(seed, secret, "organization-get", { organizationId })
    expect(fetched.isError).toBeUndefined()

    const policyFetched = await mcpCall(seed, secret, "organization-login-policy-get", { organizationId })
    expect(policyFetched.isError).toBeUndefined()
    const policySet = await mcpCall(seed, secret, "organization-login-policy-set", {
      allowPassword: true,
      organizationId,
    })
    expect(policySet.isError).toBeUndefined()

    const brandingFetched = await mcpCall(seed, secret, "organization-branding-get", { organizationId })
    expect(brandingFetched.isError).toBeUndefined()
    const brandingTheme = {
      backgroundColor: "#ffffff",
      fontColor: "#000000",
      primaryColor: "#0000ff",
      warnColor: "#ff0000",
    }
    const brandingSet = await mcpCall(seed, secret, "organization-branding-set", {
      dark: brandingTheme,
      disableWatermark: true,
      light: brandingTheme,
      organizationId,
      themeMode: "dark",
    })
    expect(brandingSet.isError).toBeUndefined()

    const domainsListed = await mcpCall(seed, secret, "organization-domain-list", { organizationId })
    expect(domainsListed.isError).toBeUndefined()
    const domainClaimed = await mcpCall(seed, secret, "organization-domain-claim", {
      domain: "claimed.example.com",
      organizationId,
    })
    expect(domainClaimed.isError).toBeUndefined()
    const domainRemoved = await mcpCall(seed, secret, "organization-domain-remove", {
      domain: "claimed.example.com",
      organizationId,
    })
    expect(domainRemoved.isError).toBeUndefined()

    const member = await mcpCall(seed, secret, "user-create", {
      email: "mcp-member@example.com",
      profile: { displayName: "MCP member" },
      userName: "mcp-member",
    })
    expect(member.isError).toBeUndefined()
    const memberId = (mcpResultDataParse(member.text).data as { user: { id: string } }).user.id

    const membershipsListed = await mcpCall(seed, secret, "organization-membership-list", { organizationId })
    expect(membershipsListed.isError).toBeUndefined()
    const membershipCreated = await mcpCall(seed, secret, "organization-membership-create", {
      organizationId,
      roles: ["member"],
      userId: memberId,
    })
    expect(membershipCreated.isError).toBeUndefined()
    const membershipId = (mcpResultDataParse(membershipCreated.text).data as { membership: { id: string } }).membership
      .id
    const membershipUpdated = await mcpCall(seed, secret, "organization-membership-update", {
      membershipId,
      organizationId,
      roles: ["admin"],
    })
    expect(membershipUpdated.isError).toBeUndefined()

    const invitationCreated = organizationInvitationCreate({
      context: system,
      database: seed.database,
      input: { email: "mcp-invitee@example.com", roles: ["member"] },
      organizationId,
      realmId: seed.realmId,
    })
    expect(invitationCreated.success).toBe(true)
    if (!invitationCreated.success) throw new Error(invitationCreated.errorMessage)
    const invitationsListed = await mcpCall(seed, secret, "organization-invitation-list", { organizationId })
    expect(invitationsListed.isError).toBeUndefined()
    const invitationRevoked = await mcpCall(seed, secret, "organization-invitation-revoke", {
      invitationId: invitationCreated.data.invitation.id,
      organizationId,
    })
    expect(invitationRevoked.isError).toBeUndefined()

    const lifecycleSuspended = await mcpCall(seed, secret, "organization-lifecycle-set", {
      organizationId,
      status: "inactive",
    })
    expect(lifecycleSuspended.isError).toBeUndefined()
    const lifecycleRestored = await mcpCall(seed, secret, "organization-lifecycle-set", {
      organizationId,
      status: "active",
    })
    expect(lifecycleRestored.isError).toBeUndefined()

    const membershipRemoved = await mcpCall(seed, secret, "organization-membership-remove", {
      membershipId,
      organizationId,
    })
    expect(membershipRemoved.isError).toBeUndefined()

    const verificationSet = await mcpCall(seed, secret, "user-email-verification-set", {
      state: "verified",
      userId: memberId,
    })
    expect(verificationSet.isError).toBeUndefined()
    const memberDeleted = await mcpCall(seed, secret, "user-delete", { userId: memberId })
    expect(memberDeleted.isError).toBeUndefined()
  })
})

test("project tools run with the matching scopes", async () => {
  await withSeededDatabase(async (seed) => {
    const secret = scopedCredentialCreate(seed, mcpToolsFullScopes, "project-tools-worker").secret

    const grantedCreated = organizationCreate({
      context: realmSystemContextCreate(),
      database: seed.database,
      input: { name: "MCP granted org" },
      realmId: seed.realmId,
    })
    expect(grantedCreated.success).toBe(true)
    if (!grantedCreated.success) throw new Error(grantedCreated.errorMessage)
    const grantedOrganizationId = grantedCreated.data.organization.id

    const member = await mcpCall(seed, secret, "user-create", {
      email: "mcp-assignee@example.com",
      profile: { displayName: "MCP assignee" },
      userName: "mcp-assignee",
    })
    expect(member.isError).toBeUndefined()
    const memberId = (mcpResultDataParse(member.text).data as { user: { id: string } }).user.id

    const projectCreated = await mcpCall(seed, secret, "project-create", {
      name: "MCP tools project",
      organizationId: seed.organizationId,
    })
    expect(projectCreated.isError).toBeUndefined()
    const projectId = (mcpResultDataParse(projectCreated.text).data as { project: { id: string } }).project.id

    const projectsListed = await mcpCall(seed, secret, "project-list", {})
    expect(projectsListed.isError).toBeUndefined()
    const projectFetched = await mcpCall(seed, secret, "project-get", { projectId })
    expect(projectFetched.isError).toBeUndefined()

    const roleCreated = await mcpCall(seed, secret, "project-role-create", {
      displayName: "Viewer",
      key: "viewer",
      projectId,
    })
    expect(roleCreated.isError).toBeUndefined()
    const roleId = (mcpResultDataParse(roleCreated.text).data as { role: { id: string } }).role.id
    const rolesListed = await mcpCall(seed, secret, "project-role-list", { projectId })
    expect(rolesListed.isError).toBeUndefined()
    const roleUpdated = await mcpCall(seed, secret, "project-role-update", {
      displayName: "Project viewer",
      projectId,
      roleId,
    })
    expect(roleUpdated.isError).toBeUndefined()

    const grantCreated = await mcpCall(seed, secret, "project-grant-create", {
      grantedOrganizationId,
      projectId,
      roleKeys: ["viewer"],
    })
    expect(grantCreated.isError).toBeUndefined()
    const grantId = (mcpResultDataParse(grantCreated.text).data as { grant: { id: string } }).grant.id
    const grantsListed = await mcpCall(seed, secret, "project-grant-list", { projectId })
    expect(grantsListed.isError).toBeUndefined()
    const grantUpdated = await mcpCall(seed, secret, "project-grant-update", {
      grantId,
      projectId,
      roleKeys: ["viewer"],
    })
    expect(grantUpdated.isError).toBeUndefined()
    const grantLifecycleSet = await mcpCall(seed, secret, "project-grant-lifecycle-set", {
      grantId,
      projectId,
      status: "inactive",
    })
    expect(grantLifecycleSet.isError).toBeUndefined()

    const assignmentCreated = await mcpCall(seed, secret, "project-user-assignment-create", {
      projectId,
      roleKeys: ["viewer"],
      userId: memberId,
    })
    expect(assignmentCreated.isError).toBeUndefined()
    const assignmentId = (mcpResultDataParse(assignmentCreated.text).data as { assignment: { id: string } }).assignment
      .id
    const assignmentsListed = await mcpCall(seed, secret, "project-user-assignment-list", { projectId })
    expect(assignmentsListed.isError).toBeUndefined()

    const applicationCreated = await mcpCall(seed, secret, "project-application-create", {
      applicationType: "api",
      name: "MCP tools app",
      projectId,
    })
    expect(applicationCreated.isError).toBeUndefined()
    const applicationId = (mcpResultDataParse(applicationCreated.text).data as { application: { id: string } })
      .application.id
    const applicationsListed = await mcpCall(seed, secret, "project-application-list", { projectId })
    expect(applicationsListed.isError).toBeUndefined()
    const applicationUpdated = await mcpCall(seed, secret, "project-application-update", {
      applicationId,
      name: "MCP tools app renamed",
      projectId,
    })
    expect(applicationUpdated.isError).toBeUndefined()

    const applicationRemoved = await mcpCall(seed, secret, "project-application-remove", {
      applicationId,
      projectId,
    })
    expect(applicationRemoved.isError).toBeUndefined()
    const assignmentRemoved = await mcpCall(seed, secret, "project-user-assignment-remove", {
      assignmentId,
      projectId,
    })
    expect(assignmentRemoved.isError).toBeUndefined()
    const grantRemoved = await mcpCall(seed, secret, "project-grant-remove", { grantId, projectId })
    expect(grantRemoved.isError).toBeUndefined()
    const roleRemoved = await mcpCall(seed, secret, "project-role-remove", { projectId, roleId })
    expect(roleRemoved.isError).toBeUndefined()

    const memberDeleted = await mcpCall(seed, secret, "user-delete", { userId: memberId })
    expect(memberDeleted.isError).toBeUndefined()
  })
})

test("write tools stay forbidden without the matching scope", async () => {
  await withSeededDatabase(async (seed) => {
    const credential = scopedCredentialCreate(seed, mcpToolsFullScopes, "forbidden-matrix-worker")
    const secret = credential.secret
    const system = realmSystemContextCreate()

    const organizationCreated = organizationCreate({
      context: system,
      database: seed.database,
      input: { name: "MCP forbidden org" },
      realmId: seed.realmId,
    })
    expect(organizationCreated.success).toBe(true)
    if (!organizationCreated.success) throw new Error(organizationCreated.errorMessage)
    const organizationId = organizationCreated.data.organization.id
    organizationMemberEnroll(seed, credential, organizationId)
    const member = await mcpCall(seed, secret, "user-create", {
      email: "mcp-forbidden@example.com",
      profile: { displayName: "MCP forbidden" },
      userName: "mcp-forbidden",
    })
    expect(member.isError).toBeUndefined()
    const memberId = (mcpResultDataParse(member.text).data as { user: { id: string } }).user.id
    const projectCreated = await mcpCall(seed, secret, "project-create", {
      name: "MCP forbidden project",
      organizationId,
    })
    expect(projectCreated.isError).toBeUndefined()
    const projectId = (mcpResultDataParse(projectCreated.text).data as { project: { id: string } }).project.id
    const roleCreated = await mcpCall(seed, secret, "project-role-create", {
      displayName: "Viewer",
      key: "viewer",
      projectId,
    })
    expect(roleCreated.isError).toBeUndefined()
    const roleId = (mcpResultDataParse(roleCreated.text).data as { role: { id: string } }).role.id
    const grantCreated = await mcpCall(seed, secret, "project-grant-create", {
      grantedOrganizationId: seed.organizationId,
      projectId,
      roleKeys: ["viewer"],
    })
    expect(grantCreated.isError).toBeUndefined()
    const grantId = (mcpResultDataParse(grantCreated.text).data as { grant: { id: string } }).grant.id
    const assignmentCreated = await mcpCall(seed, secret, "project-user-assignment-create", {
      projectId,
      userId: memberId,
    })
    expect(assignmentCreated.isError).toBeUndefined()
    const assignmentId = (mcpResultDataParse(assignmentCreated.text).data as { assignment: { id: string } }).assignment
      .id
    const applicationCreated = await mcpCall(seed, secret, "project-application-create", {
      applicationType: "api",
      name: "MCP forbidden app",
      projectId,
    })
    expect(applicationCreated.isError).toBeUndefined()
    const applicationId = (mcpResultDataParse(applicationCreated.text).data as { application: { id: string } })
      .application.id
    const invitationCreated = organizationInvitationCreate({
      context: system,
      database: seed.database,
      input: { email: "mcp-forbidden-invitee@example.com", roles: ["member"] },
      organizationId,
      realmId: seed.realmId,
    })
    expect(invitationCreated.success).toBe(true)
    if (!invitationCreated.success) throw new Error(invitationCreated.errorMessage)
    const membershipCreated = await mcpCall(seed, secret, "organization-membership-create", {
      organizationId,
      roles: ["member"],
      userId: memberId,
    })
    expect(membershipCreated.isError).toBeUndefined()
    const membershipId = (mcpResultDataParse(membershipCreated.text).data as { membership: { id: string } }).membership
      .id

    // The seed credential holds no scopes: every permission-gated tool must fail.
    // realm-get and the user tools carry no permission gate, so they are excluded here.
    const forbiddenCalls: ReadonlyArray<{ readonly args: unknown; readonly name: string }> = [
      { args: { organizationId }, name: "organization-login-policy-get" },
      { args: { allowPassword: true, organizationId }, name: "organization-login-policy-set" },
      { args: { organizationId }, name: "organization-branding-get" },
      {
        args: {
          dark: {
            backgroundColor: "#ffffff",
            fontColor: "#000000",
            primaryColor: "#0000ff",
            warnColor: "#ff0000",
          },
          disableWatermark: true,
          light: {
            backgroundColor: "#ffffff",
            fontColor: "#000000",
            primaryColor: "#0000ff",
            warnColor: "#ff0000",
          },
          organizationId,
          themeMode: "dark",
        },
        name: "organization-branding-set",
      },
      { args: { organizationId }, name: "organization-domain-list" },
      { args: { domain: "mcp-forbidden.example.com", organizationId }, name: "organization-domain-claim" },
      { args: { domain: "mcp-forbidden.example.com", organizationId }, name: "organization-domain-verify" },
      { args: { domain: "mcp-forbidden.example.com", organizationId }, name: "organization-domain-remove" },
      { args: { organizationId, status: "inactive" }, name: "organization-lifecycle-set" },
      { args: { organizationId }, name: "organization-membership-list" },
      { args: { organizationId, roles: ["member"], userId: memberId }, name: "organization-membership-create" },
      {
        args: { membershipId, organizationId, roles: ["admin"] },
        name: "organization-membership-update",
      },
      { args: { membershipId, organizationId }, name: "organization-membership-remove" },
      { args: { organizationId }, name: "organization-invitation-list" },
      {
        args: { invitationId: invitationCreated.data.invitation.id, organizationId },
        name: "organization-invitation-revoke",
      },
      { args: { projectId }, name: "project-role-list" },
      { args: { displayName: "Nope", key: "nope", projectId }, name: "project-role-create" },
      { args: { displayName: "Nope", projectId, roleId }, name: "project-role-update" },
      { args: { projectId, roleId }, name: "project-role-remove" },
      { args: { projectId }, name: "project-grant-list" },
      {
        args: { grantedOrganizationId: seed.organizationId, projectId, roleKeys: ["viewer"] },
        name: "project-grant-create",
      },
      { args: { grantId, projectId, roleKeys: ["viewer"] }, name: "project-grant-update" },
      { args: { grantId, projectId, status: "inactive" }, name: "project-grant-lifecycle-set" },
      { args: { grantId, projectId }, name: "project-grant-remove" },
      { args: { projectId }, name: "project-user-assignment-list" },
      { args: { projectId, userId: memberId }, name: "project-user-assignment-create" },
      { args: { assignmentId, projectId }, name: "project-user-assignment-remove" },
      { args: { projectId }, name: "project-application-list" },
      { args: { applicationType: "api", name: "Nope", projectId }, name: "project-application-create" },
      { args: { applicationId, name: "Nope", projectId }, name: "project-application-update" },
      { args: { applicationId, projectId }, name: "project-application-remove" },
    ]
    for (const call of forbiddenCalls) {
      const denied = await mcpCall(seed, seed.unscopedSecret, call.name, call.args)
      expect(`${call.name}: ${denied.text}`).toContain('"success":false')
      expect(denied.isError).toBe(true)
    }
  })
})

test("oidc read tools run with the oidc.read scope", async () => {
  await withSeededDatabase(async (seed) => {
    const system = realmSystemContextCreate()
    const clientCreated = oidcClientCreate({
      context: system,
      database: seed.database,
      input: {
        clientType: "confidential",
        name: "MCP OIDC client",
        redirectUris: ["https://client.example/callback"],
      },
      realmId: seed.realmId,
    })
    expect(clientCreated.success).toBe(true)
    if (!clientCreated.success) throw new Error(clientCreated.errorMessage)
    const clientId = clientCreated.data.client.id
    const keyCreated = oidcSigningKeyCreate({
      context: system,
      database: seed.database,
      encryptionSecret: "mcp-tools-oidc-secret",
      realmId: seed.realmId,
    })
    expect(keyCreated.success).toBe(true)
    if (!keyCreated.success) throw new Error(keyCreated.errorMessage)

    // Scope-less credential: gated tools stay forbidden, public metadata stays open.
    for (const name of ["oidc-client-list", "oidc-client-get", "oidc-signing-key-list"]) {
      const denied = await mcpCall(seed, seed.unscopedSecret, name, name === "oidc-client-get" ? { clientId } : {})
      expect(`${name}: ${denied.text}`).toContain("authorization.forbidden")
      expect(denied.isError).toBe(true)
    }
    const publicDiscovery = await mcpCall(seed, seed.unscopedSecret, "oidc-discovery-get", {})
    expect(publicDiscovery.isError).toBeUndefined()
    const publicJwks = await mcpCall(seed, seed.unscopedSecret, "oidc-jwks-get", {})
    expect(publicJwks.isError).toBeUndefined()

    const secret = scopedCredentialCreate(seed, ["oidc.read"], "oidc-reader-tools").secret
    const listed = await mcpCall(seed, secret, "oidc-client-list", {})
    expect(listed.isError).toBeUndefined()
    const fetched = await mcpCall(seed, secret, "oidc-client-get", { clientId })
    expect(fetched.isError).toBeUndefined()
    // Client views must never carry secret material.
    expect(fetched.text).not.toMatch(/secret/i)
    expect((mcpResultDataParse(fetched.text).data as { client: { id: string } }).client.id).toBe(clientId)
    const discovery = await mcpCall(seed, secret, "oidc-discovery-get", {})
    expect(discovery.isError).toBeUndefined()
    const jwks = await mcpCall(seed, secret, "oidc-jwks-get", {})
    expect(jwks.isError).toBeUndefined()
    const keys = await mcpCall(seed, secret, "oidc-signing-key-list", {})
    expect(keys.isError).toBeUndefined()
  })
})

test("machine credential list stays forbidden without the matching scope", async () => {
  await withSeededDatabase(async (seed) => {
    const credential = scopedCredentialCreate(seed, ["machine.credential.manage"], "credential-lister")
    const denied = await mcpCall(seed, seed.unscopedSecret, "machine-credential-list", {
      machineUserId: credential.machineUserId,
      organizationId: seed.organizationId,
    })
    expect(denied.isError).toBe(true)
    expect(denied.text).toContain("authorization.forbidden")

    const allowed = await mcpCall(seed, credential.secret, "machine-credential-list", {
      machineUserId: credential.machineUserId,
      organizationId: seed.organizationId,
    })
    expect(allowed.isError).toBeUndefined()
    const items = (mcpResultDataParse(allowed.text).data as { items: readonly unknown[] }).items
    expect(items.length).toBeGreaterThanOrEqual(1)
  })
})

test("session-list uses the session administrator gate", async () => {
  await withSeededDatabase(async (seed) => {
    const system = realmSystemContextCreate()
    const adminCreated = userCreate({
      context: system,
      database: seed.database,
      input: {
        email: "mcp-session-admin@example.com",
        profile: { displayName: "MCP session admin" },
        userName: "mcp-session-admin",
      },
      realmId: seed.realmId,
    })
    expect(adminCreated.success).toBe(true)
    if (!adminCreated.success) throw new Error(adminCreated.errorMessage)
    const granted = realmAdministratorGrant({
      context: system,
      database: seed.database,
      realmId: seed.realmId,
      userId: adminCreated.data.user.id,
    })
    expect(granted.success).toBe(true)
    if (!granted.success) throw new Error(granted.errorMessage)
    const targetCreated = userCreate({
      context: system,
      database: seed.database,
      input: {
        email: "mcp-session-target@example.com",
        profile: { displayName: "MCP session target" },
        userName: "mcp-session-target",
      },
      realmId: seed.realmId,
    })
    expect(targetCreated.success).toBe(true)
    if (!targetCreated.success) throw new Error(targetCreated.errorMessage)
    const targetId = targetCreated.data.user.id

    // Machine credentials are denied by the administrator gate, even scope-less here.
    const denied = await mcpCall(seed, seed.unscopedSecret, "session-list", { userId: targetId })
    expect(denied.isError).toBe(true)
    expect(denied.text).toContain("authorization.forbidden")

    // A realm administrator user context reads through the same registered tool.
    const adminContext: RealmTenantContext = {
      actor: {
        actorId: adminCreated.data.user.id,
        assurance: "authenticated",
        authenticationMethod: "trusted",
        kind: "user",
        realmId: seed.realmId,
      },
      actorId: adminCreated.data.user.id,
      kind: "tenant",
      realmId: seed.realmId,
    }
    const registry = mcpToolRegistryCreate(
      mcpReadToolsRegister({ context: adminContext, database: seed.database, realmId: seed.realmId, scopes: [] }),
    )
    const happy = await registry.call("session-list", { userId: targetId })
    expect(happy.isError).toBeUndefined()
    expect(mcpResultDataParse(happy.content[0]?.text ?? "").success).toBe(true)
  })
})
