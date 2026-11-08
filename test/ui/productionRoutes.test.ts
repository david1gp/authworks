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
import { productionNavigationActiveHrefSelect } from "../../src/ui/production/productionNavigationActiveHrefSelect.js"
import type { ProductionNavigationGroup } from "../../src/ui/production/productionNavigationGroup.js"
import { productionNavigationItemActive } from "../../src/ui/production/productionNavigationItemActive.js"
import { productionRouteContractMap } from "../../src/ui/production/productionRouteContractMap.js"
import type { ProductionRouteGuardContext } from "../../src/ui/production/productionRouteGuardContext.js"
import { productionRouteGuardStateCreate } from "../../src/ui/production/productionRouteGuardStateCreate.js"
import { productionRouteParamGet } from "../../src/ui/production/productionRouteParamGet.js"
import { productionRouteScreenSelect } from "../../src/ui/production/productionRouteScreenSelect.js"
import { productionShellNavigationGroupsCreate } from "../../src/ui/production/productionShellNavigationGroupsCreate.js"
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
        // The administration route spans two URL prefixes plus the legacy sign-in exception;
        // every other route keeps a single prefix.
        if (route.path === "/orgs/:orgSlug") {
          const adminPrefixes = ["/orgs/", "/realm"]
          expect(
            adminPrefixes.some((prefix) => screen.path.startsWith(prefix)),
            screen.path,
          ).toBe(true)
        } else {
          expect(screen.path.startsWith(`/${route.path.split("/")[1]}`)).toBe(true)
        }
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
    expect(productionRouteContractMap.admin.path).toBe("/orgs/:orgSlug")
    expect(productionRouteContractMap.admin.screens.map((screen) => screen.path)).toEqual(
      expect.arrayContaining([
        "/orgs/:orgSlug",
        "/orgs/:orgSlug/users",
        "/orgs/:orgSlug/users/:userId",
        "/orgs/:orgSlug/roles",
        "/orgs/:orgSlug/projects",
        "/orgs/:orgSlug/projects/:projectId",
        "/orgs/:orgSlug/configuration/:section",
        "/orgs/:orgSlug/machine-users/:machineUserId",
        "/orgs/:orgSlug/machine-credentials",
        "/orgs/:orgSlug/impersonation",
        "/orgs/:orgSlug/activity",
        "/realm",
        "/realm/activity",
        "/realm/administrators",
        "/realm/organizations",
        "/realm/login-policy",
        "/realm/oidc-clients",
        "/realm/oidc-clients/:clientId",
        "/realm/signing-keys",
        "/realm/oidc-consents",
        "/realm/protocol-documents",
        "/realm/sessions",
        "/realm/events",
        "/realm/whatsapp",
        "/realm/sign-in",
      ]),
    )

    const userDetail = productionRouteContractMap.admin.screens.find((screen) => screen.key === "user-detail")
    expect(userDetail?.contracts).toEqual(expect.arrayContaining(["users.get", "users.profile"]))
    expect(productionRouteContractMap.admin.screens.map((screen) => screen.key)).toEqual(
      expect.arrayContaining(["users", "user-detail", "roles", "realm-administrators", "configuration"]),
    )
    for (const removed of [
      "/admin",
      "/admin/activity",
      "/admin/branding",
      "/admin/configuration",
      "/admin/configuration/:section",
      "/admin/domains",
      "/admin/events",
      "/admin/impersonation",
      "/admin/login-policy",
      "/admin/machine-credentials",
      "/admin/machine-users",
      "/admin/machine-users/:machineUserId",
      "/admin/memberships",
      "/admin/invitations",
      "/admin/oidc-clients",
      "/admin/oidc-clients/:clientId",
      "/admin/oidc-consents",
      "/admin/organizations",
      "/admin/organizations/:organizationId",
      "/admin/projects",
      "/admin/projects/:projectId",
      "/admin/projects/:projectId/applications",
      "/admin/projects/:projectId/roles-grants",
      "/admin/projects/:projectId/effective-access",
      "/admin/protocol-documents",
      "/admin/realm",
      "/admin/realm/administrators",
      "/admin/roles",
      "/admin/sessions",
      "/admin/signing-keys",
      "/admin/users",
      "/admin/users/:userId",
      "/admin/whatsapp",
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
    for (const groups of Object.values(productionShellNavigationGroupsCreate("acme"))) {
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
      productionShellNavigationGroupsCreate("acme"),
    ) as readonly (readonly ProductionNavigationGroup[])[]
    for (const groups of navigationGroups) {
      for (const group of groups) {
        for (const item of group.items) expect(item.icon.length, item.href).toBeGreaterThan(0)
      }
    }

    expect(productionShellNavigationGroupsCreate("acme").admin[0]?.items[0]?.icon).toBeDefined()
  })

  test("resolves shell labels that share an English value through distinct unambiguous keys", () => {
    const adminUsers = productionShellNavigationGroupsCreate("acme").admin[0]?.items[0]
    expect(adminUsers?.href).toBe("/orgs/acme/users")
    expect(adminUsers?.label).toBe("shell.nav.users")

    // "Application consents" is also the English value of admin.oidc.consents.title.
    const realmGroup = productionShellNavigationGroupsCreate("acme").admin.find(
      (group) => group.label === "shell.nav.oidcGroup",
    )
    const adminConsents = realmGroup?.items.find((item) => item.href === "/realm/oidc-consents")
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
        (screen.key === "impersonation" || screen.key === "activity" ? 1 : 0)
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
    // The users surface admits organization members so team leaders reach their
    // team scope; the view and the server keep them out of admin-only data.
    expect(users?.guard?.access).toBe("organization-member")
    expect(administrators?.guard?.access).toBe("realm-admin")

    const organizationAdmin = (roles: readonly ("owner" | "admin" | "member" | "guest")[]) =>
      authenticatedContext({ access: { organizationRoles: [...roles], realmAdministrator: false } })
    expect(productionRouteGuardStateCreate(users?.guard ?? required, organizationAdmin([]))).toEqual({
      permission: "organization-member",
      status: "insufficient-permission",
    })
    expect(productionRouteGuardStateCreate(users?.guard ?? required, organizationAdmin(["member"]))).toEqual({
      organizationId: undefined,
      realmId: "realm-1",
      status: "authenticated",
      userId: "user-1",
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
    expect(productionRouteScreenSelect(productionRouteContractMap.admin, "/orgs/acme/users/user-42")?.key).toBe(
      "user-detail",
    )
    expect(productionRouteScreenSelect(productionRouteContractMap.admin, "/orgs/acme/not-a-screen")).toBeUndefined()
    expect(productionRouteScreenSelect(productionRouteContractMap.admin, "/realm/not-a-screen")).toBeUndefined()
  })

  test("resolves organization screens by slug and realm screens by prefix", () => {
    const admin = productionRouteContractMap.admin

    for (const [pathname, key] of [
      ["/orgs/acme", "organization-detail"],
      ["/orgs/acme/users", "users"],
      ["/orgs/acme/users/user-42", "user-detail"],
      ["/orgs/acme/roles", "roles"],
      ["/orgs/acme/projects", "projects"],
      ["/orgs/acme/projects/project-9", "project-detail"],
      ["/orgs/acme/configuration/branding", "configuration"],
      ["/orgs/acme/machine-users/machine-user-1", "machine-user-detail"],
      ["/orgs/acme/machine-credentials", "machine-credentials"],
      ["/orgs/acme/impersonation", "impersonation"],
      ["/orgs/acme/activity", "activity"],
      ["/realm", "realm"],
      ["/realm/activity", "activity"],
      ["/realm/administrators", "realm-administrators"],
      ["/realm/organizations", "organizations"],
      ["/realm/login-policy", "login-policy"],
      ["/realm/oidc-clients", "oidc-clients"],
      ["/realm/oidc-clients/client-1", "oidc-client-detail"],
      ["/realm/signing-keys", "signing-keys"],
      ["/realm/oidc-consents", "oidc-consents"],
      ["/realm/protocol-documents", "protocol-documents"],
      ["/realm/sessions", "sessions"],
      ["/realm/events", "audit-events"],
      ["/realm/whatsapp", "whatsapp"],
      ["/realm/sign-in", "sign-in"],
    ] as const)
      expect(productionRouteScreenSelect(admin, pathname)?.key, pathname).toBe(key)

    const userDetail = productionRouteScreenSelect(admin, "/orgs/acme/users/user-42")
    expect(productionRouteParamGet(userDetail?.path ?? "", "/orgs/acme/users/user-42", "orgSlug")).toBe("acme")
    expect(productionRouteParamGet(userDetail?.path ?? "", "/orgs/acme/users/user-42", "userId")).toBe("user-42")
  })

  test("resolves project detail without legacy project sub-route screens", () => {
    const admin = productionRouteContractMap.admin
    for (const removed of [
      "/orgs/acme/projects/project-9/applications",
      "/orgs/acme/projects/project-9/roles-grants",
      "/orgs/acme/projects/project-9/effective-access",
    ])
      expect(productionRouteScreenSelect(admin, removed)).toBeUndefined()

    const screen = productionRouteScreenSelect(admin, "/orgs/acme/projects/project-9")
    expect(screen?.key).toBe("project-detail")
    expect(productionRouteParamGet(screen?.path ?? "", "/orgs/acme/projects/project-9", "orgSlug")).toBe("acme")
    expect(productionRouteParamGet(screen?.path ?? "", "/orgs/acme/projects/project-9", "projectId")).toBe("project-9")
    expect(
      productionRouteParamGet("/orgs/acme/projects/:projectId", "/orgs/acme/projects/project-9", "missing"),
    ).toBeUndefined()
  })

  test("resolves organization detail and configuration route params for production adapters", () => {
    const admin = productionRouteContractMap.admin

    const detail = productionRouteScreenSelect(admin, "/orgs/acme")
    expect(detail?.key).toBe("organization-detail")
    expect(productionRouteParamGet(detail?.path ?? "", "/orgs/acme", "orgSlug")).toBe("acme")

    const configuration = productionRouteScreenSelect(admin, "/orgs/acme/configuration/branding")
    expect(configuration?.key).toBe("configuration")
    expect(productionRouteParamGet(configuration?.path ?? "", "/orgs/acme/configuration/branding", "section")).toBe(
      "branding",
    )
    // Unknown sections fall back to general in the configuration screen state.
    expect(organizationConfigurationSectionSelect("unknown")).toBe("general")
  })

  test("keeps navigation grouped and marks only the matching destination active", () => {
    expect(productionShellNavigationGroupsCreate("acme").account).toEqual([])
    expect(productionShellNavigationGroupsCreate("acme").admin.map((group) => group.scope)).toEqual([
      "organization",
      "realm",
      "realm",
      "realm",
    ])
    expect(productionShellNavigationGroupsCreate("acme").admin[0]?.items.map((item) => item.href)).toEqual([
      "/orgs/acme/users",
      "/orgs/acme/roles",
      "/orgs/acme/projects",
      "/orgs/acme/configuration/general",
      "/orgs/acme/impersonation",
      "/orgs/acme/activity",
    ])
    expect(productionNavigationItemActive("/orgs/acme/users", "/orgs/acme/users/user-42")).toBe(true)
    expect(productionNavigationItemActive("/orgs/acme/configuration", "/orgs/acme/configuration/branding")).toBe(true)
    expect(productionShellNavigationGroupsCreate("acme").admin[0]?.items[3]?.href).toBe(
      "/orgs/acme/configuration/general",
    )
    expect(productionNavigationItemActive("/orgs", "/orgs/acme/users")).toBe(false)
    expect(productionNavigationItemActive("/realm", "/realm/organizations")).toBe(false)
    expect(productionNavigationItemActive("/realm", "/realm")).toBe(true)
    expect(productionNavigationItemActive("/realm", "/account")).toBe(false)
    expect(productionNavigationItemActive("/account", "/account")).toBe(true)
    expect(productionNavigationItemActive("/account", "/orgs/acme/users")).toBe(false)
    expect(productionNavigationItemActive("/account", "/account/legacy")).toBe(false)
  })

  test("lists impersonation for organization admins", () => {
    const items = productionShellNavigationGroupsCreate("acme").admin[0]?.items ?? []
    expect(items.map((item) => item.href)).not.toContain("/orgs/acme/machine-credentials")
    const impersonation = items.find((item) => item.href === "/orgs/acme/impersonation")
    expect(impersonation).toMatchObject({ access: "organization-admin", label: "shell.nav.impersonation" })
  })

  test("highlights only the most specific sidebar destination for a nested path", () => {
    const hrefs = productionShellNavigationGroupsCreate("acme").admin.flatMap((group) =>
      group.items.map((item) => item.href),
    )
    expect(productionNavigationActiveHrefSelect(hrefs, "/realm/administrators")).toBe("/realm/administrators")
    expect(productionNavigationActiveHrefSelect(hrefs, "/realm")).toBe("/realm")
    expect(productionNavigationActiveHrefSelect(hrefs, "/orgs/acme/users/user-42")).toBe("/orgs/acme/users")
    expect(productionNavigationActiveHrefSelect(hrefs, "/orgs/acme/impersonation")).toBe("/orgs/acme/impersonation")
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

  test("keeps administration destinations owned by advertised screens", () => {
    const admin = productionRouteContractMap.admin
    for (const path of [
      "/orgs/acme/users",
      "/orgs/acme/users/user-42",
      "/orgs/acme/roles",
      "/orgs/acme/projects",
      "/orgs/acme/projects/project-9",
      "/orgs/acme/configuration/general",
      "/orgs/acme",
      "/orgs/acme/machine-users/machine-user-1",
      "/orgs/acme/machine-credentials",
      "/orgs/acme/impersonation",
      "/orgs/acme/activity",
      "/realm",
      "/realm/administrators",
      "/realm/organizations",
      "/realm/login-policy",
      "/realm/oidc-clients",
      "/realm/oidc-clients/client-1",
      "/realm/signing-keys",
      "/realm/oidc-consents",
      "/realm/protocol-documents",
      "/realm/sessions",
      "/realm/events",
      "/realm/whatsapp",
      "/realm/activity",
      "/realm/sign-in",
    ])
      expect(productionRouteScreenSelect(admin, path), path).toBeDefined()
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

  test("keeps machine credentials reachable as a deep link outside the sidebar", () => {
    const groups = productionShellNavigationGroupsCreate("acme").admin
    const hrefs = groups.flatMap((group) => group.items.map((item) => item.href))
    expect(hrefs).not.toContain("/orgs/acme/machine-users")
    expect(hrefs).not.toContain("/orgs/acme/machine-users/:machineUserId")
    expect(hrefs).not.toContain("/orgs/acme/machine-credentials")

    const screen = productionRouteScreenSelect(productionRouteContractMap.admin, "/orgs/acme/machine-credentials")
    expect(screen?.key).toBe("machine-credentials")
    expect(screen?.title).toBe("shell.nav.machineCredentials")

    expect(productionRouteContractMap.admin.screens.find((screen) => screen.key === "machine-user-detail")?.path).toBe(
      "/orgs/:orgSlug/machine-users/:machineUserId",
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
