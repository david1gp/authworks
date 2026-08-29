import { describe, expect, test } from "bun:test"
import { accountSectionNavStateCreate } from "../../src/features/account/ui/accountSectionNavStateCreate.js"
import { accountWorkspaceSectionIds } from "../../src/features/account/ui/accountWorkspaceSectionIds.js"

describe("account workspace", () => {
  test("keeps stable anchors for every workspace section", () => {
    expect(accountWorkspaceSectionIds).toEqual({
      access: "access",
      dangerZone: "danger-zone",
      devicesApplications: "devices-applications",
      profile: "profile",
      security: "security",
    })
    expect(new Set(Object.values(accountWorkspaceSectionIds)).size).toBe(5)
  })

  test("creates account section navigation items targeting workspace section anchors", () => {
    const state = accountSectionNavStateCreate(() => "")
    const items = state.items()
    expect(items.map((item) => item.id)).toEqual([
      accountWorkspaceSectionIds.profile,
      accountWorkspaceSectionIds.security,
      accountWorkspaceSectionIds.devicesApplications,
      accountWorkspaceSectionIds.access,
      accountWorkspaceSectionIds.dangerZone,
    ])
    expect(items.map((item) => item.href)).toEqual([
      `#${accountWorkspaceSectionIds.profile}`,
      `#${accountWorkspaceSectionIds.security}`,
      `#${accountWorkspaceSectionIds.devicesApplications}`,
      `#${accountWorkspaceSectionIds.access}`,
      `#${accountWorkspaceSectionIds.dangerZone}`,
    ])
    for (const item of items) {
      expect(item.icon.length).toBeGreaterThan(0)
      expect(item.label.length).toBeGreaterThan(0)
    }
  })

  test("shares profile state between the identity and email adapters only", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspaceProductionAdapter.tsx", import.meta.url),
    ).text()

    expect(source).toContain('const profileState = accountProductionAdapterStateCreate(() => "email")')
    expect(source).toContain('<AccountProductionAdapter kind="overview" state={profileState} />')
    expect(source).toContain('<AccountProductionAdapter kind="email" state={profileState} />')
    expect(source.match(/state=\{profileState\}/g)).toHaveLength(2)
  })

  test("consolidates profile identity into one summary without a redundant sign-in card", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountProfileView.tsx", import.meta.url),
    ).text()

    expect(source).toContain("<AccountProfileIdentityStrip")
    expect(source).not.toContain("account.profile.signInTitle")
    expect(source).not.toContain("account.profile.signInDescription")
  })

  test("lays out profile form and picture field in an 8/4 grid on wide screens", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountProfileView.tsx", import.meta.url),
    ).text()

    expect(source).toContain("lg:grid-cols-12")
    expect(source).toContain("lg:col-span-8")
    expect(source).toContain("lg:col-span-4")
    expect(source).toContain("<AccountProfilePictureField")
  })

  test("marks only the hash-targeted section as current", () => {
    let hash = "#security"
    const state = accountSectionNavStateCreate(() => hash)

    expect(state.isActive(accountWorkspaceSectionIds.profile)).toBe(false)
    expect(state.isActive(accountWorkspaceSectionIds.security)).toBe(true)

    hash = "#danger-zone"
    expect(state.isActive(accountWorkspaceSectionIds.security)).toBe(false)
    expect(state.isActive(accountWorkspaceSectionIds.dangerZone)).toBe(true)
  })

  test("marks Profile current when the account page has no hash", () => {
    const state = accountSectionNavStateCreate(() => "")

    expect(state.isActive(accountWorkspaceSectionIds.profile)).toBe(true)
    expect(state.isActive(accountWorkspaceSectionIds.security)).toBe(false)
  })

  test("renders a page-level Account heading without the removed shell header", async () => {
    const source = await Bun.file(new URL("../../src/features/account/ui/AccountWorkspace.tsx", import.meta.url)).text()

    expect(source).toContain('<h1 class="text-xl font-semibold tracking-tight">')
    expect(source).toContain('messageTranslate("shell.nav.account")')
    expect(source).not.toContain("AuthenticatedPageHeader")
  })

  test("points invitation organization switching to account access", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountAccessProductionAdapter.tsx", import.meta.url),
    ).text()

    expect(source).toContain('organizationsHref="/account#access"')
  })
})
