import { describe, expect, test } from "bun:test"

const sourceRead = async (path: string) => await Bun.file(new URL(path, import.meta.url)).text()

describe("sidebar user popover", () => {
  test("hosts the profile destination with the language and theme controls in one menu", async () => {
    const source = await sourceRead("../../src/ui/production/ProductionIdentityMenu.tsx")

    expect(source).toContain("<LanguageSelector")
    expect(source).toContain("<AuthenticatedThemeToggle />")
    expect(source).toContain('messageTranslate("shell.nav.profile")')
    expect(source).toContain('messageTranslate("common.signOut")')
    expect(source).toContain('messageTranslate("common.language")')
    expect(source).toContain('data-identity-menu=""')
    expect(source).toContain("identityMenuPreferences")
    expect(source).toContain("identityMenuCaption")
  })

  test("production footer is a single user popover without separate preference rows", async () => {
    const source = await sourceRead("../../src/ui/production/ProductionAuthenticatedShell.tsx")

    expect(source).toContain("<ProductionIdentityMenu")
    expect(source).not.toContain("<LanguageSelector")
    expect(source).not.toContain("AuthenticatedThemeToggle")
    expect(source).not.toContain("footerPreferences")
  })

  test("demo footer is a single user popover without separate preference rows", async () => {
    const source = await sourceRead("../../src/features/admin/ui/AdminDemoApp.tsx")

    expect(source).toContain("<ProductionIdentityMenu")
    expect(source).toContain('messageTranslate("demo.nav.label")')
    expect(source).toContain("showProfile={false}")
    expect(source).not.toContain("<LanguageSelector")
    expect(source).not.toContain("AuthenticatedThemeToggle")
    expect(source).not.toContain("footerPreferences")
  })
})
