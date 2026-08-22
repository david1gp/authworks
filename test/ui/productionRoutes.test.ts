import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { adminScreenSchema } from "../../src/features/admin/ui/adminScreenSchema.js"
import { machineAdminScreenSchema } from "../../src/features/machineUsers/ui/machineAdminScreenSchema.js"
import { oidcAdminScreenSchema } from "../../src/features/oidc/ui/oidcAdminScreenSchema.js"
import { organizationAdminScreenSchema } from "../../src/features/organizations/ui/organizationAdminScreenSchema.js"
import { projectAdminScreenSchema } from "../../src/features/projects/ui/projectAdminScreenSchema.js"
import { productionNavigationItemActive } from "../../src/ui/production/productionNavigationItemActive.js"
import { productionRouteContractMap } from "../../src/ui/production/productionRouteContractMap.js"
import type { ProductionRouteGuardContext } from "../../src/ui/production/productionRouteGuardContext.js"
import { productionRouteGuardStateCreate } from "../../src/ui/production/productionRouteGuardStateCreate.js"
import { productionRouteParamGet } from "../../src/ui/production/productionRouteParamGet.js"
import { productionRouteScreenSelect } from "../../src/ui/production/productionRouteScreenSelect.js"
import { productionShellNavigationGroups } from "../../src/ui/production/productionShellNavigationGroups.js"

describe("production route contracts", () => {
  test("covers every production browser prefix and its screen contracts", () => {
    expect(Object.keys(productionRouteContractMap)).toEqual(["login", "consent", "account", "invitations", "admin"])

    for (const route of Object.values(productionRouteContractMap)) {
      expect(route.path.startsWith("/")).toBe(true)
      expect(route.screens.length).toBeGreaterThan(0)
      for (const screen of route.screens) {
        expect(screen.path.startsWith(route.path)).toBe(true)
        expect(screen.contracts.length).toBeGreaterThan(0)
      }
    }

    expect(productionRouteContractMap.login.screens.map((screen) => screen.path)).toContain("/login/password")
    expect(productionRouteContractMap.consent.screens[0]?.contracts).toContain("oidc.consent")
    expect(productionRouteContractMap.account.screens.map((screen) => screen.path)).toContain("/account/sessions")
    expect(productionRouteContractMap.invitations.screens.map((screen) => screen.path)).toContain("/invitations/accept")
    expect(productionRouteContractMap.admin.screens.map((screen) => screen.path)).toContain("/admin/users/:userId")

    const userDetail = productionRouteContractMap.admin.screens.find((screen) => screen.key === "user-detail")
    expect(userDetail?.contracts).toEqual(
      expect.arrayContaining(["users.authentication-methods", "sessions.list", "sessions.revoke"]),
    )
    expect(productionRouteContractMap.admin.screens.map((screen) => screen.path)).not.toContain(
      "/admin/user-authentication",
    )
    expect(productionRouteContractMap.admin.screens.map((screen) => screen.path)).not.toContain("/admin/user-sessions")
  })

  test("renders every advertised administration screen through exactly one feature owner", () => {
    const featureSchemas = [
      adminScreenSchema,
      organizationAdminScreenSchema,
      projectAdminScreenSchema,
      oidcAdminScreenSchema,
      machineAdminScreenSchema,
    ] as const

    for (const screen of productionRouteContractMap.admin.screens) {
      const ownerCount =
        featureSchemas.filter((schema) => v.safeParse(schema, screen.key).success).length +
        (screen.key === "impersonation" ? 1 : 0)
      expect(ownerCount, `${screen.path} must resolve to one administration feature`).toBe(1)
    }
  })
})

describe("production route guard state", () => {
  const required = productionRouteContractMap.admin.guard
  const authenticatedContext = (overrides: Partial<ProductionRouteGuardContext> = {}): ProductionRouteGuardContext => ({
    authentication: { status: "authenticated", userId: "user-1" },
    organization: "missing",
    permission: "granted",
    realm: { realmId: "realm-1", status: "available" },
    ...overrides,
  })

  test("distinguishes loading and anonymous access", () => {
    expect(
      productionRouteGuardStateCreate(required, {
        authentication: "loading",
        organization: "loading",
        permission: "loading",
        realm: "loading",
      }),
    ).toEqual({ status: "loading" })
    expect(
      productionRouteGuardStateCreate(required, { ...authenticatedContext(), authentication: "anonymous" }),
    ).toEqual({
      status: "anonymous",
    })
  })

  test("allows an anonymous actor through a public route while retaining realm guards", () => {
    const anonymousContext: ProductionRouteGuardContext = {
      authentication: "anonymous",
      organization: "missing",
      permission: "not-required",
      realm: { realmId: "realm-1", status: "available" },
    }
    expect(productionRouteGuardStateCreate(productionRouteContractMap.login.guard, anonymousContext)).toEqual({
      organizationId: undefined,
      realmId: "realm-1",
      status: "authenticated",
      userId: "public",
    })
  })

  test("distinguishes authenticated, missing context, and insufficient permission", () => {
    expect(productionRouteGuardStateCreate(required, authenticatedContext())).toEqual({
      organizationId: undefined,
      realmId: "realm-1",
      status: "authenticated",
      userId: "user-1",
    })
    expect(productionRouteGuardStateCreate(required, authenticatedContext({ realm: "missing" }))).toEqual({
      context: "realm",
      status: "missing-context",
    })
    expect(
      productionRouteGuardStateCreate(
        productionRouteContractMap.invitations.guard,
        authenticatedContext({ organization: "missing" }),
      ),
    ).toEqual({ organizationId: undefined, realmId: "realm-1", status: "authenticated", userId: "user-1" })
    expect(productionRouteGuardStateCreate(required, authenticatedContext({ permission: "denied" }))).toEqual({
      permission: "realm.read",
      status: "insufficient-permission",
    })
  })
})

describe("production shell state", () => {
  test("selects exact and parameterized screens without falling back for inaccessible paths", () => {
    expect(productionRouteScreenSelect(productionRouteContractMap.account, "/account/sessions")?.key).toBe("sessions")
    expect(productionRouteScreenSelect(productionRouteContractMap.admin, "/admin/users/user-42")?.key).toBe(
      "user-detail",
    )
    expect(productionRouteScreenSelect(productionRouteContractMap.admin, "/admin/not-a-screen")).toBeUndefined()
  })

  test("resolves project-scoped authorization screens and their project identifier", () => {
    const admin = productionRouteContractMap.admin
    const cases = [
      ["/admin/projects/project-9/applications", "applications"],
      ["/admin/projects/project-9/roles-grants", "roles-grants"],
      ["/admin/projects/project-9/effective-access", "effective-access"],
    ] as const

    for (const [pathname, key] of cases) {
      const screen = productionRouteScreenSelect(admin, pathname)
      expect(screen?.key).toBe(key)
      expect(productionRouteParamGet(screen?.path ?? "", pathname, "projectId")).toBe("project-9")
    }

    expect(productionRouteScreenSelect(admin, "/admin/projects/project-9")?.key).toBe("project-detail")
    expect(
      productionRouteParamGet("/admin/projects/:projectId", "/admin/projects/project-9", "missing"),
    ).toBeUndefined()
  })

  test("keeps navigation grouped and marks only the matching destination active", () => {
    expect(productionShellNavigationGroups.account.map((group) => group.label)).toEqual([
      "Personal information",
      "Security",
      "Access",
    ])
    expect(productionShellNavigationGroups.admin.map((group) => group.label)).toEqual([
      "Realm",
      "Directory",
      "Applications",
      "OpenID Connect",
      "Operations",
    ])
    expect(productionNavigationItemActive("/admin/users", "/admin/users/user-42")).toBe(true)
    expect(productionNavigationItemActive("/admin", "/admin/users")).toBe(false)
    expect(productionNavigationItemActive("/account", "/account/password")).toBe(false)
  })

  test("keeps administration navigation targets owned by advertised screens", () => {
    const admin = productionRouteContractMap.admin
    const hrefs = productionShellNavigationGroups.admin.flatMap((group) => group.items.map((item) => item.href))

    for (const href of hrefs) expect(productionRouteScreenSelect(admin, href), href).toBeDefined()
  })
})
