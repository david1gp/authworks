import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { englishCatalog } from "../../src/ui/i18n/model/englishCatalog.js"
import { translationPlaceholdersApply } from "../../src/ui/i18n/model/translationPlaceholdersApply.js"

/** Administration state creators whose destructive guards must speak the catalog language. */
const guardedStateCreators = [
  "src/features/admin/ui/adminPageStateCreate.ts",
  "src/features/admin/ui/adminUserSecurityStateCreate.ts",
  "src/features/impersonation/ui/impersonationAdminPageStateCreate.ts",
  "src/features/impersonation/ui/impersonationAdminShellBannerStateCreate.ts",
  "src/features/machineUsers/ui/machineAdminPageStateCreate.ts",
  "src/features/oidc/ui/oidcAdminPageStateCreate.ts",
  "src/features/organizations/ui/organizationAdminPageStateCreate.ts",
  "src/features/projects/ui/projectAdminPageStateCreate.ts",
]

const guardedKeys = [
  "admin.impersonation.endConfirm",
  "admin.machine.credentials.revokeConfirm",
  "admin.machine.lifecycle.removeConfirm",
  "admin.machine.secret.rotateConfirm",
  "admin.oidc.clients.removeConfirm",
  "admin.oidc.consents.revokeConfirm",
  "admin.oidc.keys.retireConfirm",
  "admin.oidc.keys.rotateConfirm",
  "admin.oidc.secret.revokeConfirm",
  "admin.oidc.secret.rotateConfirm",
  "admin.organizations.domains.removeConfirm",
  "admin.organizations.invitations.revokeConfirm",
  "admin.organizations.lifecycle.activateConfirm",
  "admin.organizations.lifecycle.deactivateConfirm",
  "admin.organizations.lifecycle.removeConfirm",
  "admin.organizations.memberships.removeConfirm",
  "admin.organizations.providers.disableConfirm",
  "admin.projects.applications.removeConfirm",
  "admin.projects.deleteConfirm",
  "admin.projects.grants.revokeConfirm",
  "admin.projects.lifecycle.removeConfirm",
  "admin.projects.roles.deleteConfirm",
  "admin.users.deleteConfirm",
  "admin.users.lifecycleConfirm",
  "admin.users.sessions.revokeConfirm",
]

/** Locale catalogs that must carry the directly affected user-administration wording. */
const localeCatalogs = ["public/i18n/de.csv", "public/i18n/ar.csv"]

const translatedKeys = [
  "admin.impersonation.end",
  "admin.impersonation.endConfirm",
  "admin.impersonation.endedNotice",
  "admin.organizations.policy.description",
  "admin.organizations.providers.description",
  "admin.organizations.providers.disableConfirm",
  "admin.organizations.providers.displayName",
  "admin.organizations.providers.secretWriteOnly",
  "admin.users.createdAt",
  "admin.users.sessions.revokeConfirm",
  "admin.users.sessions.revoked",
  "admin.users.sessions.title",
  "admin.users.updated",
  "demo.admin.description",
  "demo.admin.directoryTitle",
  "demo.admin.eyebrow",
]

describe("localized destructive confirmations in administration state creators", () => {
  test("every guarded message key exists in the English catalog", () => {
    for (const key of guardedKeys) expect(englishCatalog[key as keyof typeof englishCatalog], key).toBeString()
  })

  test("every confirm guard argument flows through messageTranslate instead of a literal", () => {
    for (const file of guardedStateCreators) {
      const source = readFileSync(file, "utf8")
      // Literal or template arguments would bypass the catalog and stay English in every locale.
      // Variable arguments are fine when they hold a translated catalog string.
      const withoutTranslations = source.replaceAll(/messageTranslate\([^)]*\)/g, "")
      expect(/confirm\(\s*["`]/.test(withoutTranslations), `${file} non-catalog confirm argument`).toBe(false)
    }
  })

  test("placeholder interpolation keeps translated confirmation sentences intact", () => {
    const domain = englishCatalog["admin.organizations.domains.removeConfirm"]
    expect(translationPlaceholdersApply(domain, { domain: "acme.example" })).toContain("acme.example")
    expect(translationPlaceholdersApply(domain, { domain: "acme.example" })).not.toContain("{domain}")
    const invitation = englishCatalog["admin.organizations.invitations.revokeConfirm"]
    expect(translationPlaceholdersApply(invitation, { email: "rowan@example.com" })).toContain("rowan@example.com")
    const arabicMembership = "هل تريد إزالة {userId} من هذه المؤسسة؟ سينتهي وصوله إلى المؤسسة فوراً."
    expect(translationPlaceholdersApply(arabicMembership, { userId: "user-42" })).toContain("user-42")
    expect(translationPlaceholdersApply(arabicMembership, { userId: "user-42" })).not.toContain("{userId}")
  })

  test("user creation and impersonation end interpolate their placeholders", () => {
    const created = translationPlaceholdersApply(englishCatalog["admin.users.created"], { userName: "rowan" })
    expect(created).toContain("rowan")
    expect(created).not.toContain("{userName}")
    const ended = translationPlaceholdersApply(englishCatalog["admin.impersonation.endConfirm"], {
      subject: "rowan@example.com",
    })
    expect(ended).toContain("rowan@example.com")
    expect(ended).not.toContain("{subject}")
  })

  test("timestamp labels carry no unresolved placeholder", () => {
    // These keys are rendered as detail labels beside a separately formatted value.
    expect(englishCatalog["admin.users.updated"]).not.toContain("{")
    expect(englishCatalog["admin.users.createdAt"]).not.toContain("{")
  })

  test("the affected user-administration keys are translated in every locale catalog", () => {
    for (const file of localeCatalogs) {
      const source = readFileSync(file, "utf8")
      for (const key of translatedKeys) {
        const line = source.split("\n").find((entry) => entry.startsWith(`${key},`))
        expect(line, `${file} ${key}`).toBeString()
        const value = (line ?? "").slice(key.length + 1)
        expect(value.length, `${file} ${key} empty`).toBeGreaterThan(0)
        expect(value, `${file} ${key} untranslated`).not.toBe(
          englishCatalog[key as keyof typeof englishCatalog] as string,
        )
      }
    }
  })
})
