import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"
import { englishCatalog } from "../../src/ui/i18n/model/englishCatalog.js"
import { translationPlaceholdersApply } from "../../src/ui/i18n/model/translationPlaceholdersApply.js"

/** Administration state creators whose destructive guards must speak the catalog language. */
const guardedStateCreators = [
  "src/features/machineUsers/ui/machineAdminPageStateCreate.ts",
  "src/features/oidc/ui/oidcAdminPageStateCreate.ts",
  "src/features/organizations/ui/organizationAdminPageStateCreate.ts",
  "src/features/projects/ui/projectAdminPageStateCreate.ts",
]

const guardedKeys = [
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
})
