import { describe, expect, mock, test } from "bun:test"
import { readFileSync } from "node:fs"

mock.module("solid-js", () => ({
  createEffect: (fn: () => void) => {
    fn()
  },
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (_deps: unknown, fn: () => void) => fn,
}))

const [{ organizationConfigurationCanEdit }] = await Promise.all([
  import("../../src/features/organizations/ui/organizationConfigurationCanEdit.js"),
])
const [{ organizationConfigurationSectionSelect }] = await Promise.all([
  import("../../src/features/organizations/ui/organizationConfigurationSectionSelect.js"),
])

describe("organization configuration access", () => {
  test("owners and realm administrators can edit", () => {
    expect(organizationConfigurationCanEdit({ organizationRoles: ["owner"], realmAdministrator: false })).toBe(true)
    expect(organizationConfigurationCanEdit({ organizationRoles: [], realmAdministrator: true })).toBe(true)
  })

  test("admins, members, and anonymous viewers are read-only", () => {
    expect(organizationConfigurationCanEdit({ organizationRoles: ["admin"], realmAdministrator: false })).toBe(false)
    expect(organizationConfigurationCanEdit({ organizationRoles: ["member"], realmAdministrator: false })).toBe(false)
    expect(organizationConfigurationCanEdit({ organizationRoles: [], realmAdministrator: false })).toBe(false)
  })
})

describe("organization configuration section selection", () => {
  test("accepts the four configuration sections and falls back to general", () => {
    expect(organizationConfigurationSectionSelect("general")).toBe("general")
    expect(organizationConfigurationSectionSelect("branding")).toBe("branding")
    expect(organizationConfigurationSectionSelect("sign-in")).toBe("sign-in")
    expect(organizationConfigurationSectionSelect("domains")).toBe("domains")
    expect(organizationConfigurationSectionSelect(undefined)).toBe("general")
    expect(organizationConfigurationSectionSelect("unknown")).toBe("general")
  })
})

describe("organization configuration shell layout", () => {
  test("owns its page header so the shell renders a single Configuration title", async () => {
    const { productionRouteContractMap } = await import("../../src/ui/production/productionRouteContractMap.js")
    const configuration = productionRouteContractMap.admin.screens.find((screen) => screen.key === "configuration")
    expect(configuration?.ownsPageHeader).toBe(true)
  })

  test("renders one header with top tabs instead of a nested section card", () => {
    const shellSource = readFileSync("src/features/organizations/ui/OrganizationConfigurationShellView.tsx", "utf8")
    expect(shellSource).toContain("AuthenticatedPageHeader")
    expect(shellSource).toContain("AuthenticatedTabs")
    expect(shellSource).not.toContain("AuthenticatedSection")
    expect(shellSource).not.toContain("AuthenticatedSubNav")
  })

  test("demo renders the same single header as production, with no fixture chrome", () => {
    const demoSource = readFileSync("src/features/organizations/ui/OrganizationConfigurationDemoAdapter.tsx", "utf8")
    expect(demoSource).not.toContain("AuthenticatedPageHeader")
    expect(demoSource).not.toContain("DemoFixtureStateSelector")
    expect(demoSource).not.toContain("headerMeta")
  })
})
