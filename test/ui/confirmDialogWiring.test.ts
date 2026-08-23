import { describe, expect, test } from "bun:test"

// The adapters cannot be rendered under the test condition, so their composition is asserted
// from source: both the production and the demo mount must reach the same shared dialog and
// no confirmation may fall back to a native prompt or a silent auto-accept.
const sourceRead = async (path: string) => await Bun.file(new URL(path, import.meta.url)).text()

const adapters = [
  { path: "../../src/features/admin/ui/AdminProductionAdapter.tsx", titleKey: "admin.common.confirmTitle" },
  { path: "../../src/features/admin/ui/AdminDemoAdapter.tsx", titleKey: "admin.common.confirmTitle" },
  { path: "../../src/features/oidc/ui/OidcAdminScreenView.tsx", titleKey: "admin.oidc.confirmTitle" },
  {
    path: "../../src/features/impersonation/ui/ImpersonationAdminProductionAdapter.tsx",
    titleKey: "admin.common.confirmTitle",
  },
  {
    path: "../../src/features/impersonation/ui/ImpersonationAdminDemoAdapter.tsx",
    titleKey: "admin.common.confirmTitle",
  },
  { path: "../../src/ui/production/ProductionImpersonationBannerSlot.tsx", titleKey: "admin.common.confirmTitle" },
] as const

const migratedStateModules = [
  "../../src/features/admin/ui/adminProductionStateCreate.ts",
  "../../src/features/admin/ui/adminDemoStateCreate.ts",
  "../../src/features/admin/ui/adminPageStateCreate.ts",
  "../../src/features/oidc/ui/oidcAdminScreenStateCreate.ts",
  "../../src/features/impersonation/ui/impersonationAdminProductionStateCreate.ts",
  "../../src/features/impersonation/ui/impersonationAdminDemoStateCreate.ts",
  "../../src/features/impersonation/ui/impersonationAdminShellBannerStateCreate.ts",
] as const

describe("confirmation wiring", () => {
  test("every production and demo mount renders the shared dialog with its feature title key", async () => {
    for (const adapter of adapters) {
      const source = await sourceRead(adapter.path)
      expect(source).toContain("ConfirmDialog")
      expect(source).toContain(`titleKey="${adapter.titleKey}"`)
    }
  })

  test("the dialog settles a pending promise when it unmounts", async () => {
    const source = await sourceRead("../../src/ui/confirm/ConfirmDialog.tsx")
    expect(source).toContain("onCleanup(() => state.dispose())")
  })

  test("no migrated administration state falls back to a native prompt or auto-accept", async () => {
    for (const path of migratedStateModules) {
      const source = await sourceRead(path)
      expect(source).not.toContain("window.confirm")
      expect(source).not.toContain("confirm: () => true")
    }
  })

  test("impersonation no longer imports administration UI internals", async () => {
    for (const path of [
      "../../src/features/impersonation/ui/impersonationAdminDemoStateCreate.ts",
      "../../src/features/impersonation/ui/ImpersonationAdminDemoAdapter.tsx",
    ]) {
      expect(await sourceRead(path)).not.toContain("../../admin/ui/")
    }
  })

  test("the duplicated feature-local confirmation modules are gone", async () => {
    for (const path of [
      "../../src/features/admin/ui/AdminConfirmDialog.tsx",
      "../../src/features/admin/ui/adminConfirmStateCreate.ts",
      "../../src/features/admin/ui/adminDialogFocusNextSelect.ts",
      "../../src/features/oidc/ui/OidcAdminConfirmDialog.tsx",
      "../../src/features/oidc/ui/oidcAdminConfirmStateCreate.ts",
      "../../src/features/oidc/ui/oidcAdminDialogFocusNextSelect.ts",
    ]) {
      expect(await Bun.file(new URL(path, import.meta.url)).exists()).toBe(false)
    }
  })
})
