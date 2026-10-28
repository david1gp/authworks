import { expect, test } from "bun:test"
import { productionRouteContractMap } from "./productionRouteContractMap.js"
import type { ProductionRouteGuardContext } from "./productionRouteGuardContext.js"
import { productionRouteGuardStateCreate } from "./productionRouteGuardStateCreate.js"
import { productionShellAccessPermits } from "./productionShellAccessPermits.js"
import { productionShellNavigationGroups } from "./productionShellNavigationGroups.js"

const activity = productionRouteContractMap.admin.screens.find((screen) => screen.key === "activity")!
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
  const item = productionShellNavigationGroups.admin[0].items.find((item) => item.href === "/admin/activity")!
  expect(item.label).toBe("shell.nav.activity")
  expect(activity.path).toBe("/admin/activity")
  expect(activity.ownsPageHeader).toBe(true)
  for (const roles of [["owner"], ["admin"]] as const) {
    const guard = context([...roles])
    expect(productionRouteGuardStateCreate(activity.guard, guard).status).toBe("authenticated")
    expect(productionShellAccessPermits(item.access, guard.access as Exclude<typeof guard.access, string>)).toBe(true)
  }
  const audit = productionRouteContractMap.admin.screens.find((screen) => screen.key === "audit-events")!
  expect(productionRouteGuardStateCreate(audit.guard, context(["admin"])).status).toBe("insufficient-permission")
})

test("members and guests cannot discover or access Activity; IAM administrators need no organization", () => {
  for (const roles of [[], ["member"], ["guest"]] as const) {
    const guard = context([...roles])
    expect(productionRouteGuardStateCreate(activity.guard, guard).status).toBe("insufficient-permission")
    expect(
      productionShellAccessPermits("organization-admin", guard.access as Exclude<typeof guard.access, string>),
    ).toBe(false)
  }
  expect(
    productionRouteGuardStateCreate(activity.guard, { ...context([], true), organization: "missing" }).status,
  ).toBe("authenticated")
  expect(productionRouteGuardStateCreate(activity.guard, { ...context([]), authentication: "anonymous" }).status).toBe(
    "anonymous",
  )
})
