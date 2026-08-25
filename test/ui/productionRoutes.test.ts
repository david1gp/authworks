import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { adminScreenSchema } from "../../src/features/admin/ui/adminScreenSchema.js"
import { machineAdminScreenSchema } from "../../src/features/machineUsers/ui/machineAdminScreenSchema.js"
import { oidcAdminScreenSchema } from "../../src/features/oidc/ui/oidcAdminScreenSchema.js"
import { organizationAdminScreenSchema } from "../../src/features/organizations/ui/organizationAdminScreenSchema.js"
import { projectAdminScreenSchema } from "../../src/features/projects/ui/projectAdminScreenSchema.js"
import { englishCatalog } from "../../src/ui/i18n/model/englishCatalog.js"
import { productionLoginRedirectUrlCreate } from "../../src/ui/production/productionLoginRedirectUrlCreate.js"
import type { ProductionNavigationGroup } from "../../src/ui/production/productionNavigationGroup.js"
import { productionNavigationItemActive } from "../../src/ui/production/productionNavigationItemActive.js"
import { productionRouteContractMap } from "../../src/ui/production/productionRouteContractMap.js"
import type { ProductionRouteGuardContext } from "../../src/ui/production/productionRouteGuardContext.js"
import { productionRouteGuardStateCreate } from "../../src/ui/production/productionRouteGuardStateCreate.js"
import { productionRouteParamGet } from "../../src/ui/production/productionRouteParamGet.js"
import { productionRouteScreenSelect } from "../../src/ui/production/productionRouteScreenSelect.js"
import { productionShellNavigationGroups } from "../../src/ui/production/productionShellNavigationGroups.js"
import { productionShellNavigationLinkVisible } from "../../src/ui/production/productionShellNavigationLinkVisible.js"

describe("production route contracts", () => {
  test("encodes the exact same-origin path, query, and hash for login continuation", () => {
    const redirectUrl = productionLoginRedirectUrlCreate({
      hash: "#password",
      pathname: "/account/profile",
      search: "?tab=security&mode=edit",
    })

    expect(redirectUrl).toBe("/login?return_to=%2Faccount%2Fprofile%3Ftab%3Dsecurity%26mode%3Dedit%23password")
    expect(new URL(redirectUrl, "https://authworks.example").searchParams.get("return_to")).toBe(
      "/account/profile?tab=security&mode=edit#password",
    )
  })

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
    expect(productionRouteContractMap.login.screens).toEqual(
      expect.arrayContaining([
        {
          contracts: ["whatsapp-otp.availability", "whatsapp-otp.start"],
          key: "whatsapp-otp",
          path: "/login/whatsapp-otp",
          title: "login.whatsappOtp.title",
        },
        {
          contracts: ["whatsapp-otp.resend", "whatsapp-otp.verify"],
          key: "whatsapp-otp-code",
          path: "/login/whatsapp-otp/code",
          title: "login.whatsappOtp.codeTitle",
        },
      ]),
    )
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

  test("advertises only typed catalog keys for screen titles and shell navigation labels", () => {
    const catalogKeys = new Set(Object.keys(englishCatalog))

    for (const route of Object.values(productionRouteContractMap)) {
      for (const screen of route.screens) {
        expect(catalogKeys.has(screen.title), `${screen.path} title must be a typed key`).toBe(true)
      }
    }
    for (const groups of Object.values(productionShellNavigationGroups)) {
      for (const group of groups) {
        expect(catalogKeys.has(group.label), `${group.label} must be a typed key`).toBe(true)
        for (const item of group.items) {
          expect(catalogKeys.has(item.label), `${item.href} label must be a typed key`).toBe(true)
        }
      }
    }
  })

  test("keeps semantic icons on every authenticated navigation group and item", () => {
    const navigationGroups = Object.values(
      productionShellNavigationGroups,
    ) as readonly (readonly ProductionNavigationGroup[])[]
    for (const groups of navigationGroups) {
      for (const group of groups) {
        expect(group.icon.length).toBeGreaterThan(0)
        for (const item of group.items) expect(item.icon.length, item.href).toBeGreaterThan(0)
      }
    }

    expect(productionShellNavigationGroups.invitations[0]?.items[0]?.icon).toBe(
      productionShellNavigationGroups.account[0]?.items[0]?.icon,
    )
    expect(productionShellNavigationGroups.invitations[0]?.items[1]?.icon).toBe(
      productionShellNavigationGroups.account[0]?.items[3]?.icon,
    )
    expect(productionShellNavigationGroups.account[2]?.items[0]?.icon).toBeDefined()
  })

  test("resolves shell labels that share an English value through distinct unambiguous keys", () => {
    const accountOverview = productionShellNavigationGroups.account[0]?.items[0]
    const adminOverview = productionShellNavigationGroups.admin[0]?.items[0]
    expect(accountOverview?.label).toBe("shell.nav.overview")
    expect(adminOverview?.label).toBe("shell.nav.overview")

    // "Application consents" is also the English value of admin.oidc.consents.title.
    const accountConsents = productionShellNavigationGroups.account[2]?.items[0]
    expect(accountConsents?.label).toBe("shell.nav.applicationConsents")
    expect(englishCatalog["shell.nav.applicationConsents"]).toBe(englishCatalog["admin.oidc.consents.title"])

    // "Password" and "Profile" and "Email address" duplicate feature catalog values.
    expect(englishCatalog["shell.nav.password"]).toBe(englishCatalog["login.password.label"])
    expect(englishCatalog["shell.nav.profile"]).toBe(englishCatalog["admin.users.profileTitle"])
    expect(englishCatalog["shell.nav.emailAddress"]).toBe(englishCatalog["account.profile.email"])

    const accountScreens = productionRouteContractMap.account.screens
    expect(accountScreens.find((screen) => screen.key === "password")?.title).toBe("shell.nav.password")
    expect(accountScreens.find((screen) => screen.key === "profile")?.title).toBe("shell.nav.profile")
    expect(accountScreens.find((screen) => screen.key === "email")?.title).toBe("shell.nav.emailAddress")
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
  const shellGuardCreate = (overrides: Partial<ProductionRouteGuardContext> = {}): ProductionRouteGuardContext => ({
    authentication: { status: "authenticated", userId: "user-1" },
    organization: "missing",
    permission: "granted",
    realm: { realmId: "realm-1", status: "available" },
    ...overrides,
  })

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
      "shell.nav.personalInformation",
      "shell.nav.security",
      "shell.nav.access",
    ])
    expect(productionShellNavigationGroups.admin.map((group) => group.label)).toEqual([
      "shell.nav.realm",
      "shell.nav.directory",
      "shell.nav.applications",
      "shell.nav.openIdConnect",
      "shell.nav.operations",
    ])
    expect(productionNavigationItemActive("/admin/users", "/admin/users/user-42")).toBe(true)
    expect(productionNavigationItemActive("/admin", "/admin/users")).toBe(false)
    expect(productionNavigationItemActive("/account", "/account/password")).toBe(false)
  })

  test("shows administration only for an active-realm realm.read decision and always returns to account from admin", () => {
    const baseGuard = shellGuardCreate()
    expect(productionShellNavigationLinkVisible({ guard: baseGuard, kind: "account", target: "admin" })).toBe(true)
    expect(
      productionShellNavigationLinkVisible({
        guard: shellGuardCreate({ permission: "denied" }),
        kind: "account",
        target: "admin",
      }),
    ).toBe(false)
    expect(
      productionShellNavigationLinkVisible({
        guard: shellGuardCreate({ permission: "loading" }),
        kind: "account",
        target: "admin",
      }),
    ).toBe(false)
    expect(
      productionShellNavigationLinkVisible({
        guard: shellGuardCreate({ realm: "missing" }),
        kind: "account",
        target: "admin",
      }),
    ).toBe(false)
    expect(productionShellNavigationLinkVisible({ guard: baseGuard, kind: "admin", target: "account" })).toBe(true)
  })

  test("offers an advertised sign-out destination from every authenticated shell", () => {
    const signOutHref = "/login/logout"
    expect(productionRouteScreenSelect(productionRouteContractMap.login, signOutHref)?.key).toBe("logout")
  })

  test("keeps administration navigation targets owned by advertised screens", () => {
    const admin = productionRouteContractMap.admin
    const hrefs = productionShellNavigationGroups.admin.flatMap((group) => group.items.map((item) => item.href))

    for (const href of hrefs) expect(productionRouteScreenSelect(admin, href), href).toBeDefined()
  })
})
