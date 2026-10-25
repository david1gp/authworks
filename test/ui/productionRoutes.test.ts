import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { adminScreenSchema } from "../../src/features/admin/ui/adminScreenSchema.js"
import { demoAdminScenarioGroups } from "../../src/features/demo/demoAdminScenarioGroups.js"
import { directoryAdminScreenSchema } from "../../src/features/directory/ui/directoryAdminScreenSchema.js"
import { machineAdminScreenSchema } from "../../src/features/machineUsers/ui/machineAdminScreenSchema.js"
import { oidcAdminScreenSchema } from "../../src/features/oidc/ui/oidcAdminScreenSchema.js"
import { organizationAdminScreenSchema } from "../../src/features/organizations/ui/organizationAdminScreenSchema.js"
import { organizationConfigurationSectionSelect } from "../../src/features/organizations/ui/organizationConfigurationSectionSelect.js"
import { projectAdminScreenSchema } from "../../src/features/projects/ui/projectAdminScreenSchema.js"
import { englishCatalog } from "../../src/ui/i18n/model/englishCatalog.js"
import { productionLoginRedirectUrlCreate } from "../../src/ui/production/productionLoginRedirectUrlCreate.js"
import type { ProductionNavigationGroup } from "../../src/ui/production/productionNavigationGroup.js"
import { productionNavigationActiveHrefSelect } from "../../src/ui/production/productionNavigationActiveHrefSelect.js"
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
      pathname: "/account",
      search: "?tab=security&mode=edit",
    })

    expect(redirectUrl).toBe("/login?return_to=%2Faccount%3Ftab%3Dsecurity%26mode%3Dedit%23password")
    expect(new URL(redirectUrl, "https://authworks.example").searchParams.get("return_to")).toBe(
      "/account?tab=security&mode=edit#password",
    )
  })

  test("covers every production browser prefix and its screen contracts", () => {
    expect(Object.keys(productionRouteContractMap)).toEqual(["login", "consent", "account", "invitations", "admin"])

    for (const route of Object.values(productionRouteContractMap)) {
      expect(route.path.startsWith("/")).toBe(true)
      expect(route.screens.length).toBeGreaterThan(0)
      for (const screen of route.screens) {
        expect(screen.path.startsWith(`/${route.path.split("/")[1]}`)).toBe(true)
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
    expect(productionRouteContractMap.account.screens.map((screen) => screen.path)).toEqual(["/account"])
    expect(productionRouteContractMap.account.screens[0]?.contracts).toEqual(
      expect.arrayContaining([
        "account.profile",
        "account.email",
        "account.password",
        "account.delete",
        "organizations.list",
        "organizations.switch",
        "account.effective-access",
        "sessions.list",
        "sessions.revoke",
        "passkeys.list",
        "passkeys.revoke",
        "mfa.list",
        "mfa.enroll",
        "mfa.revoke",
        "mfa.recovery-codes",
        "external-identities.list",
        "external-identities.providers",
        "external-identities.link-start",
        "external-identities.link-callback",
        "external-identities.link-complete",
        "external-identities.unlink",
        "oidc.refresh-tokens.list",
        "oidc.refresh-tokens.revoke",
        "account.security-history",
        "oidc.consents.list",
        "oidc.consents.revoke",
      ]),
    )
    expect(productionRouteContractMap.invitations.screens.map((screen) => screen.path)).toContain("/invitations/accept")
    expect(productionRouteContractMap.admin.screens.map((screen) => screen.path)).toContain("/admin/users/:userId")

    const userDetail = productionRouteContractMap.admin.screens.find((screen) => screen.key === "user-detail")
    expect(userDetail?.contracts).toEqual(expect.arrayContaining(["users.get", "users.profile"]))
    expect(productionRouteContractMap.admin.screens.map((screen) => screen.key)).toEqual(
      expect.arrayContaining(["users", "user-detail", "roles", "realm-administrators", "configuration"]),
    )
    for (const removed of [
      "/admin",
      "/admin/branding",
      "/admin/domains",
      "/admin/memberships",
      "/admin/invitations",
      "/admin/machine-users",
      "/admin/projects/:projectId/applications",
      "/admin/projects/:projectId/roles-grants",
      "/admin/projects/:projectId/effective-access",
    ])
      expect(
        productionRouteContractMap.admin.screens.map((screen) => screen.path),
        removed,
      ).not.toContain(removed)
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
        if (group.label !== null) expect(catalogKeys.has(group.label), `${group.label} must be a typed key`).toBe(true)
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
        if (group.label !== null) expect(group.icon?.length).toBeGreaterThan(0)
        for (const item of group.items) expect(item.icon.length, item.href).toBeGreaterThan(0)
      }
    }

    expect(productionShellNavigationGroups.admin[0]?.items[0]?.icon).toBeDefined()
  })

  test("resolves shell labels that share an English value through distinct unambiguous keys", () => {
    const adminUsers = productionShellNavigationGroups.admin[0]?.items[0]
    expect(adminUsers?.href).toBe("/admin/users")
    expect(adminUsers?.label).toBe("shell.nav.users")

    // "Application consents" is also the English value of admin.oidc.consents.title.
    const realmGroup = productionShellNavigationGroups.admin.find((group) => group.label === "shell.nav.realmGroup")
    const adminConsents = realmGroup?.items.find((item) => item.href === "/admin/oidc-consents")
    expect(adminConsents?.label).toBe("shell.nav.applicationConsents")
    expect(englishCatalog["shell.nav.applicationConsents"]).toBe(englishCatalog["admin.oidc.consents.title"])

    // "Password" duplicates the login feature catalog value.
    expect(englishCatalog["shell.nav.password"]).toBe(englishCatalog["login.password.label"])

    const accountScreen = productionRouteContractMap.account.screens[0]
    expect(accountScreen?.key).toBe("overview")
    expect(accountScreen?.title).toBe("shell.nav.account")
  })

  test("renders every advertised administration screen through exactly one feature owner", () => {
    const featureSchemas = [
      adminScreenSchema,
      directoryAdminScreenSchema,
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
    access: { organizationRoles: [], realmAdministrator: false },
    authentication: { status: "authenticated", userId: "user-1" },
    organization: "missing",
    permission: "granted",
    realm: { realmId: "realm-1", status: "available" },
    ...overrides,
  })

  test("distinguishes loading and anonymous access", () => {
    expect(
      productionRouteGuardStateCreate(required, {
        access: "loading",
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
      access: { organizationRoles: [], realmAdministrator: false },
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

  test("distinguishes authenticated, missing context, and insufficient access", () => {
    expect(
      productionRouteGuardStateCreate(
        required,
        authenticatedContext({ access: { organizationRoles: ["owner"], realmAdministrator: false } }),
      ),
    ).toEqual({
      organizationId: undefined,
      realmId: "realm-1",
      status: "authenticated",
      userId: "user-1",
    })
    expect(
      productionRouteGuardStateCreate(
        required,
        authenticatedContext({ access: { organizationRoles: [], realmAdministrator: true } }),
      ),
    ).toEqual({
      organizationId: undefined,
      realmId: "realm-1",
      status: "authenticated",
      userId: "user-1",
    })
    expect(productionRouteGuardStateCreate(required, authenticatedContext())).toEqual({
      permission: "organization-admin",
      status: "insufficient-permission",
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
    expect(
      productionRouteGuardStateCreate(
        productionRouteContractMap.login.guard,
        authenticatedContext({ permission: "denied" }),
      ),
    ).toEqual({
      organizationId: undefined,
      realmId: "realm-1",
      status: "authenticated",
      userId: "user-1",
    })
  })

  test("evaluates organization-admin and realm-admin access from the active context", () => {
    const users = productionRouteContractMap.admin.screens.find((screen) => screen.key === "users")
    const administrators = productionRouteContractMap.admin.screens.find(
      (screen) => screen.key === "realm-administrators",
    )
    expect(users?.guard?.access).toBe("organization-admin")
    expect(administrators?.guard?.access).toBe("realm-admin")

    const organizationAdmin = (roles: readonly ("owner" | "admin" | "member" | "guest")[]) =>
      authenticatedContext({ access: { organizationRoles: [...roles], realmAdministrator: false } })
    expect(productionRouteGuardStateCreate(users?.guard ?? required, organizationAdmin(["member"]))).toEqual({
      permission: "organization-admin",
      status: "insufficient-permission",
    })
    expect(productionRouteGuardStateCreate(users?.guard ?? required, organizationAdmin(["admin"]))).toEqual({
      organizationId: undefined,
      realmId: "realm-1",
      status: "authenticated",
      userId: "user-1",
    })
    expect(
      productionRouteGuardStateCreate(
        administrators?.guard ?? required,
        authenticatedContext({ access: { organizationRoles: ["owner"], realmAdministrator: false } }),
      ),
    ).toEqual({ permission: "realm-admin", status: "insufficient-permission" })
  })
})

describe("production shell state", () => {
  const shellGuardCreate = (overrides: Partial<ProductionRouteGuardContext> = {}): ProductionRouteGuardContext => ({
    access: { organizationRoles: [], realmAdministrator: true },
    authentication: { status: "authenticated", userId: "user-1" },
    organization: "missing",
    permission: "granted",
    realm: { realmId: "realm-1", status: "available" },
    ...overrides,
  })

  test("selects exact and parameterized screens without falling back for inaccessible paths", () => {
    expect(productionRouteScreenSelect(productionRouteContractMap.account, "/account")?.key).toBe("overview")
    expect(productionRouteScreenSelect(productionRouteContractMap.account, "/account/sessions")).toBeUndefined()
    expect(productionRouteScreenSelect(productionRouteContractMap.admin, "/admin/users/user-42")?.key).toBe(
      "user-detail",
    )
    expect(productionRouteScreenSelect(productionRouteContractMap.admin, "/admin/not-a-screen")).toBeUndefined()
  })

  test("resolves project detail without legacy project sub-route screens", () => {
    const admin = productionRouteContractMap.admin
    for (const removed of [
      "/admin/projects/project-9/applications",
      "/admin/projects/project-9/roles-grants",
      "/admin/projects/project-9/effective-access",
    ])
      expect(productionRouteScreenSelect(admin, removed)).toBeUndefined()

    const screen = productionRouteScreenSelect(admin, "/admin/projects/project-9")
    expect(screen?.key).toBe("project-detail")
    expect(productionRouteParamGet(screen?.path ?? "", "/admin/projects/project-9", "projectId")).toBe("project-9")
    expect(
      productionRouteParamGet("/admin/projects/:projectId", "/admin/projects/project-9", "missing"),
    ).toBeUndefined()
  })

  test("resolves organization detail and configuration route params for production adapters", () => {
    const admin = productionRouteContractMap.admin

    const detail = productionRouteScreenSelect(admin, "/admin/organizations/org-7")
    expect(detail?.key).toBe("organization-detail")
    expect(productionRouteParamGet(detail?.path ?? "", "/admin/organizations/org-7", "organizationId")).toBe("org-7")

    const configuration = productionRouteScreenSelect(admin, "/admin/configuration/branding")
    expect(configuration?.key).toBe("configuration")
    expect(productionRouteParamGet(configuration?.path ?? "", "/admin/configuration/branding", "section")).toBe(
      "branding",
    )
    // Unknown sections fall back to general in the configuration screen state.
    expect(organizationConfigurationSectionSelect("unknown")).toBe("general")
  })

  test("keeps navigation grouped and marks only the matching destination active", () => {
    expect(productionShellNavigationGroups.account).toEqual([])
    expect(productionShellNavigationGroups.admin.map((group) => group.label)).toEqual([null, "shell.nav.realmGroup"])
    expect(productionShellNavigationGroups.admin[0]?.items.map((item) => item.href)).toEqual([
      "/admin/users",
      "/admin/roles",
      "/admin/projects",
      "/admin/configuration/general",
    ])
    expect(productionNavigationItemActive("/admin/users", "/admin/users/user-42")).toBe(true)
    expect(productionNavigationItemActive("/admin/configuration", "/admin/configuration/branding")).toBe(true)
    expect(productionShellNavigationGroups.admin[0]?.items[3]?.href).toBe("/admin/configuration/general")
    expect(productionNavigationItemActive("/admin", "/admin/users")).toBe(false)
    expect(productionNavigationItemActive("/admin", "/admin")).toBe(true)
    expect(productionNavigationItemActive("/admin", "/account")).toBe(false)
    expect(productionNavigationItemActive("/account", "/account")).toBe(true)
    expect(productionNavigationItemActive("/account", "/admin")).toBe(false)
    expect(productionNavigationItemActive("/account", "/account/legacy")).toBe(false)
  })

  test("highlights only the most specific sidebar destination for a nested path", () => {
    const hrefs = productionShellNavigationGroups.admin.flatMap((group) => group.items.map((item) => item.href))
    expect(productionNavigationActiveHrefSelect(hrefs, "/admin/realm/administrators")).toBe(
      "/admin/realm/administrators",
    )
    expect(productionNavigationActiveHrefSelect(hrefs, "/admin/realm")).toBe("/admin/realm")
    expect(productionNavigationActiveHrefSelect(hrefs, "/admin/users/user-42")).toBe("/admin/users")
    expect(productionNavigationActiveHrefSelect(hrefs, "/admin/machine-credentials")).toBeUndefined()
  })

  test("shows administration for an active realm session and always returns to account from admin", () => {
    const baseGuard = shellGuardCreate()
    expect(productionShellNavigationLinkVisible({ guard: baseGuard, kind: "account", target: "admin" })).toBe(true)
    expect(
      productionShellNavigationLinkVisible({
        guard: shellGuardCreate({ access: { organizationRoles: [], realmAdministrator: false } }),
        kind: "account",
        target: "admin",
      }),
    ).toBe(false)
    expect(
      productionShellNavigationLinkVisible({
        guard: shellGuardCreate({
          access: { organizationRoles: ["owner"], realmAdministrator: false },
          permission: "denied",
        }),
        kind: "account",
        target: "admin",
      }),
    ).toBe(true)
    expect(
      productionShellNavigationLinkVisible({
        guard: shellGuardCreate({
          access: { organizationRoles: ["admin"], realmAdministrator: false },
          permission: "denied",
        }),
        kind: "account",
        target: "admin",
      }),
    ).toBe(true)
    expect(
      productionShellNavigationLinkVisible({
        guard: shellGuardCreate({
          access: { organizationRoles: ["member"], realmAdministrator: false },
          permission: "denied",
        }),
        kind: "account",
        target: "admin",
      }),
    ).toBe(false)
    expect(
      productionShellNavigationLinkVisible({
        guard: shellGuardCreate({ access: "loading" }),
        kind: "account",
        target: "admin",
      }),
    ).toBe(true)
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

describe("org-admin machine-user administration", () => {
  const machineKeys = ["machine-user-detail", "machine-credentials"] as const

  test("requires an organization context with organization-admin access on every machine screen", () => {
    const guardOf = (key: string) => {
      const screen = productionRouteContractMap.admin.screens.find((item) => item.key === key)
      if (screen === undefined || screen.guard === undefined || !("access" in screen.guard)) return undefined
      return screen.guard
    }
    expect(productionRouteContractMap.admin.screens.map((screen) => screen.key)).not.toContain("machine-users")
    for (const key of machineKeys) {
      expect(guardOf(key)?.organization, key).toBe("required")
      expect(guardOf(key)?.realm, key).toBe("required")
      expect(guardOf(key)?.access, key).toBe("organization-admin")
      expect(guardOf(key)?.permission, key).toBeNull()
    }

    const detail = guardOf("machine-user-detail")
    expect(
      productionRouteGuardStateCreate(detail ?? productionRouteContractMap.admin.guard, {
        access: { organizationRoles: [], realmAdministrator: false },
        authentication: { status: "authenticated", userId: "user-1" },
        organization: "missing",
        permission: "granted",
        realm: { realmId: "realm-1", status: "available" },
      }),
    ).toEqual({ context: "organization", status: "missing-context" })
  })

  test("keeps machine destinations out of the sidebar and inside the realm group scenario catalog", () => {
    const groups = productionShellNavigationGroups.admin
    const hrefs = groups.flatMap((group) => group.items.map((item) => item.href))
    expect(hrefs).not.toContain("/admin/machine-users")
    expect(hrefs).not.toContain("/admin/machine-users/:machineUserId")
    expect(hrefs).not.toContain("/admin/machine-credentials")

    expect(productionRouteContractMap.admin.screens.find((screen) => screen.key === "machine-user-detail")?.path).toBe(
      "/admin/machine-users/:machineUserId",
    )
  })

  test("mirrors the new production routes in the demo scenario catalog", () => {
    const paths = demoAdminScenarioGroups.flatMap((group) => group.scenarios.map((scenario) => scenario.path))
    for (const kept of [
      "/demo/admin/users",
      "/demo/admin/roles",
      "/demo/admin/projects",
      "/demo/admin/configuration/general",
      "/demo/admin/realm",
      "/demo/admin/realm/administrators",
    ])
      expect(paths, kept).toContain(kept)
    for (const removed of [
      "/demo/admin/overview",
      "/demo/admin/branding",
      "/demo/admin/memberships",
      "/demo/admin/invitations",
      "/demo/admin/domains",
      "/demo/admin/machine-users",
      "/demo/admin/projects/01900000-0000-7000-8000-000000000031/applications",
      "/demo/admin/projects/01900000-0000-7000-8000-000000000031/roles-grants",
      "/demo/admin/projects/01900000-0000-7000-8000-000000000031/effective-access",
    ])
      expect(paths, removed).not.toContain(removed)
  })
})
