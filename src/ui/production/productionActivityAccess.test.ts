import { expect, test } from "bun:test"
import { productionRouteContractMap } from "./productionRouteContractMap.js"
import type { ProductionRouteGuardContext } from "./productionRouteGuardContext.js"
import { productionRouteGuardStateCreate } from "./productionRouteGuardStateCreate.js"
import { productionShellAccessPermits } from "./productionShellAccessPermits.js"
import { productionShellNavigationGroupsCreate } from "./productionShellNavigationGroupsCreate.js"

const activities = productionRouteContractMap.admin.screens.filter((screen) => screen.key === "activity")!
const organizationActivity = activities.find((screen) => screen.path === "/orgs/:orgSlug/activity")!
const realmActivity = activities.find((screen) => screen.path === "/realm/activity")!
const context = (
  roles: ("owner" | "admin" | "member" | "guest")[],
  realmAdministrator = false,
): ProductionRouteGuardContext => ({
  access: { organizationRoles: roles, realmAdministrator },
  authentication: { status: "authenticated", userId: "user" },
  realm: { realmId: "realm", status: "available" },
  organization: { organizationId: "org", status: "available" },
  permission: "not-required",
})

test("Activity is a top-level organization-admin destination; the legacy audit log stays realm-only", () => {
  const item = productionShellNavigationGroupsCreate("acme").admin[0]!.items.find(
    (item) => item.href === "/orgs/acme/activity",
  )!
  expect(item.label).toBe("shell.nav.activity")
  expect(activities.map((screen) => screen.path)).toEqual(["/orgs/:orgSlug/activity", "/realm/activity"])
  expect(organizationActivity.ownsPageHeader).toBe(true)
  expect(realmActivity.ownsPageHeader).toBe(true)
  expect(organizationActivity.guard?.organization).toBe("optional")
  expect(realmActivity.guard?.organization).toBe("not-required")
  for (const roles of [["owner"], ["admin"]] as const) {
    const guard = context([...roles])
    expect(productionRouteGuardStateCreate(organizationActivity.guard, guard).status).toBe("authenticated")
    expect(productionRouteGuardStateCreate(realmActivity.guard, guard).status).toBe("insufficient-permission")
    expect(productionShellAccessPermits(item.access, guard.access as Exclude<typeof guard.access, string>)).toBe(true)
  }
  const audit = productionRouteContractMap.admin.screens.find((screen) => screen.key === "audit-events")!
  expect(audit.path).toBe("/realm/events")
  expect(productionRouteGuardStateCreate(audit.guard, context(["admin"])).status).toBe("insufficient-permission")
})

test("members and guests cannot discover or access Activity; IAM administrators need no organization", () => {
  for (const roles of [[], ["member"], ["guest"]] as const) {
    const guard = context([...roles])
    expect(productionRouteGuardStateCreate(organizationActivity.guard, guard).status).toBe("insufficient-permission")
    expect(productionRouteGuardStateCreate(realmActivity.guard, guard).status).toBe("insufficient-permission")
    expect(
      productionShellAccessPermits("organization-admin", guard.access as Exclude<typeof guard.access, string>),
    ).toBe(false)
  }
  expect(
    productionRouteGuardStateCreate(organizationActivity.guard, { ...context([], true), organization: "missing" })
      .status,
  ).toBe("authenticated")
  expect(
    productionRouteGuardStateCreate(realmActivity.guard, { ...context([], true), organization: "missing" }).status,
  ).toBe("authenticated")
  expect(
    productionRouteGuardStateCreate(organizationActivity.guard, { ...context([]), authentication: "anonymous" }).status,
  ).toBe("anonymous")
})
