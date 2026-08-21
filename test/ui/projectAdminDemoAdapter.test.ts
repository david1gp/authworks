import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { demoAdminProjectApplications } from "../../src/features/demo/demoAdminProjectApplications.js"
import { demoAdminProjectGrants } from "../../src/features/demo/demoAdminProjectGrants.js"
import { projectApplicationSchema } from "../../src/features/projects/public/projectApplicationSchema.js"
import { projectGrantSchema } from "../../src/features/projects/public/projectGrantSchema.js"
import { projectAdminDemoAdapterCreate } from "../../src/features/projects/ui/projectAdminDemoAdapterCreate.js"

const projectId = "01900000-0000-7000-8000-000000000031"

describe("project administration demo fixtures", () => {
  test("parse against the public transport schemas", () => {
    expect(v.safeParse(v.array(projectApplicationSchema), demoAdminProjectApplications).success).toBe(true)
    expect(v.safeParse(v.array(projectGrantSchema), demoAdminProjectGrants).success).toBe(true)
  })
})

describe("project administration demo adapter", () => {
  test("returns fixture collections for the success state without any network access", async () => {
    const adapter = projectAdminDemoAdapterCreate(() => "success")

    const projects = await adapter.projectList()
    const applications = await adapter.applicationList(projectId)
    const grants = await adapter.grantList(projectId)
    const roles = await adapter.roleList(projectId)

    expect(projects.success && projects.data.items.length).toBeGreaterThan(0)
    expect(applications.success && applications.data.items.length).toBeGreaterThan(0)
    expect(grants.success && grants.data.items.length).toBeGreaterThan(0)
    expect(roles.success && roles.data.items.length).toBeGreaterThan(0)
  })

  test("returns empty collections for the empty state", async () => {
    const adapter = projectAdminDemoAdapterCreate(() => "empty")

    const projects = await adapter.projectList()
    const applications = await adapter.applicationList(projectId)

    expect(projects.success && projects.data.items).toEqual([])
    expect(applications.success && applications.data.items).toEqual([])
  })

  test("maps the denied and cross-tenant states onto distinct coded failures", async () => {
    const denied = await projectAdminDemoAdapterCreate(() => "permission-denied").projectList()
    const crossTenant = await projectAdminDemoAdapterCreate(() => "cross-tenant").projectList()
    const failed = await projectAdminDemoAdapterCreate(() => "error").projectList()

    expect(denied.success).toBe(false)
    expect(!denied.success && denied.code).toBe("projects.forbidden")
    expect(!crossTenant.success && crossTenant.code).toBe("projects.tenant-mismatch")
    expect(!failed.success && failed.code).toBe("projects.read-failed")
  })

  test("never settles in the loading state so the loading view stays visible", async () => {
    const adapter = projectAdminDemoAdapterCreate(() => "loading")
    const pending = adapter.projectList()

    const outcome = await Promise.race([
      pending.then(() => "settled" as const),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 25)),
    ])

    expect(outcome).toBe("pending")
  })

  test("applies deterministic mutations for applications, grants, and roles", async () => {
    const adapter = projectAdminDemoAdapterCreate(() => "success")

    const application = await adapter.applicationCreate(projectId, { applicationType: "oidc", name: "Demo App" })
    const grant = await adapter.grantCreate(projectId, {
      grantedOrganizationId: "01900000-0000-7000-8000-000000000013",
      roleKeys: ["reader"],
    })
    const role = await adapter.roleCreate(projectId, { displayName: "Auditor", key: "auditor" })

    expect(application.success && application.data.name).toBe("Demo App")
    expect(application.success && application.data.status).toBe("active")
    expect(grant.success && grant.data.roleKeys).toEqual(["reader"])
    expect(role.success && role.data.key).toBe("auditor")

    const listed = await adapter.applicationList(projectId)
    expect(listed.success && listed.data.items.some((item) => item.name === "Demo App")).toBe(true)
  })

  test("exposes read-only fixed roles and an effective access check", async () => {
    const adapter = projectAdminDemoAdapterCreate(() => "success")

    const access = await adapter.projectAccessCheck(projectId)

    expect(access.success && access.data.roleKeys).toEqual(["admin", "reader"])
    expect(adapter.permissionRoles().map((role) => role.roleId)).toContain("realm_admin")
  })
})
