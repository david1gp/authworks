import { describe, expect, test } from "bun:test"
import { productionRouteRedirectSelect } from "../../src/ui/production/productionRouteRedirectSelect.js"

const redirectContextCreate = (
  overrides: {
    readonly currentOrganizationId?: string | undefined
    readonly hash?: string
    readonly realmAdmin?: boolean
    readonly search?: string
  } = {},
) => ({
  currentOrganizationId: "org-1",
  hash: "",
  organizations: [
    { id: "org-1", slug: "acme" },
    { id: "org-2", slug: "field-notes" },
  ],
  realmAdmin: false,
  search: "",
  ...overrides,
})

describe("production route redirects", () => {
  test("redirects removed org paths under the default slug preserving the subpath", () => {
    const context = redirectContextCreate()
    for (const [pathname, target] of [
      ["/admin/users", "/orgs/acme/users"],
      ["/admin/users/user-42", "/orgs/acme/users/user-42"],
      ["/admin/roles", "/orgs/acme/roles"],
      ["/admin/projects", "/orgs/acme/projects"],
      ["/admin/projects/project-9", "/orgs/acme/projects/project-9"],
      ["/admin/configuration/branding", "/orgs/acme/configuration/branding"],
      ["/admin/machine-users/machine-user-1", "/orgs/acme/machine-users/machine-user-1"],
      ["/admin/machine-credentials", "/orgs/acme/machine-credentials"],
      ["/admin/impersonation", "/orgs/acme/impersonation"],
      ["/admin/activity", "/orgs/acme/activity"],
      ["/admin/future-screen", "/orgs/acme/future-screen"],
    ] as const)
      expect(productionRouteRedirectSelect(pathname, context), pathname).toBe(target)
  })

  test("keeps legacy configuration, invitation, and project sub-route redirects working under the slug", () => {
    const context = redirectContextCreate()
    for (const [pathname, target] of [
      ["/admin/branding", "/orgs/acme/configuration/branding"],
      ["/admin/configuration", "/orgs/acme/configuration/general"],
      ["/admin/domains", "/orgs/acme/configuration/domains"],
      ["/admin/invitations", "/orgs/acme/users?tab=invitations"],
      ["/admin/machine-users", "/orgs/acme/users?tab=service-accounts"],
      ["/admin/memberships", "/orgs/acme/users"],
      ["/admin/projects/project-9/applications", "/orgs/acme/projects/project-9?tab=applications"],
      ["/admin/projects/project-9/roles-grants", "/orgs/acme/projects/project-9?tab=roles"],
      ["/admin/projects/project-9/effective-access", "/orgs/acme/projects/project-9?tab=access"],
    ] as const)
      expect(productionRouteRedirectSelect(pathname, context), pathname).toBe(target)
  })

  test("redirects removed realm paths without an organization segment", () => {
    const context = redirectContextCreate()
    for (const [pathname, target] of [
      ["/admin/realm", "/realm"],
      ["/admin/realm/administrators", "/realm/administrators"],
      ["/admin/organizations", "/realm/organizations"],
      ["/admin/login-policy", "/realm/login-policy"],
      ["/admin/oidc-clients", "/realm/oidc-clients"],
      ["/admin/oidc-clients/client-1", "/realm/oidc-clients/client-1"],
      ["/admin/signing-keys", "/realm/signing-keys"],
      ["/admin/oidc-consents", "/realm/oidc-consents"],
      ["/admin/protocol-documents", "/realm/protocol-documents"],
      ["/admin/sessions", "/realm/sessions"],
      ["/admin/events", "/realm/events"],
      ["/admin/whatsapp", "/realm/whatsapp"],
    ] as const)
      expect(productionRouteRedirectSelect(pathname, context), pathname).toBe(target)
  })

  test("redirects legacy organization detail links to the matching slug", () => {
    const context = redirectContextCreate()
    expect(productionRouteRedirectSelect("/admin/organizations/org-2", context)).toBe("/orgs/field-notes")
    expect(productionRouteRedirectSelect("/admin/organizations/unknown-id", context)).toBe("/orgs/acme")
  })

  test("sends bare entry points to the realm or the default organization", () => {
    for (const pathname of ["/admin", "/admin/", "/orgs", "/orgs/"] as const) {
      expect(productionRouteRedirectSelect(pathname, redirectContextCreate({ realmAdmin: true })), pathname).toBe(
        "/realm",
      )
      expect(productionRouteRedirectSelect(pathname, redirectContextCreate()), pathname).toBe("/orgs/acme")
      expect(
        productionRouteRedirectSelect(
          pathname,
          redirectContextCreate({ currentOrganizationId: undefined, realmAdmin: false }),
        ),
        pathname,
      ).toBeUndefined()
    }
  })

  test("sends the legacy administrator sign-in to its canonical realm path", () => {
    expect(productionRouteRedirectSelect("/admin/sign-in", redirectContextCreate())).toBe("/realm/sign-in")
    expect(
      productionRouteRedirectSelect(
        "/admin/sign-in",
        redirectContextCreate({ hash: "#expired", search: "?reason=timeout" }),
      ),
    ).toBe("/realm/sign-in?reason=timeout#expired")
    expect(productionRouteRedirectSelect("/admin/sign-in/extra", redirectContextCreate())).toBeUndefined()
  })

  test("leaves new destinations without a redirect", () => {
    const context = redirectContextCreate()
    for (const pathname of [
      "/orgs/acme",
      "/orgs/acme/users",
      "/orgs/acme/users/user-42",
      "/orgs/unknown-slug/users",
      "/realm",
      "/realm/activity",
      "/realm/organizations",
      "/realm/sign-in",
      "/account",
    ] as const)
      expect(productionRouteRedirectSelect(pathname, context), pathname).toBeUndefined()
  })

  test("returns no org redirect without a default organization", () => {
    const context = redirectContextCreate({ currentOrganizationId: undefined })
    expect(productionRouteRedirectSelect("/admin/users", context)).toBeUndefined()
    expect(productionRouteRedirectSelect("/admin/branding", context)).toBeUndefined()
    expect(productionRouteRedirectSelect("/admin", context)).toBeUndefined()
  })

  test("preserves the source search and hash unless the legacy target sets its own query", () => {
    expect(
      productionRouteRedirectSelect("/admin/users", redirectContextCreate({ hash: "#row-1", search: "?tab=members" })),
    ).toBe("/orgs/acme/users?tab=members#row-1")
    expect(productionRouteRedirectSelect("/admin/invitations", redirectContextCreate({ search: "?tab=members" }))).toBe(
      "/orgs/acme/users?tab=invitations",
    )
    expect(productionRouteRedirectSelect("/admin/realm", redirectContextCreate({ hash: "#row-1" }))).toBe(
      "/realm#row-1",
    )
  })
})
