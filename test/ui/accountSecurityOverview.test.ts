import { describe, expect, test } from "bun:test"
import type { UserAuthenticationMethods } from "../../src/features/users/public/userAuthenticationMethodsSchema.js"
import type { User } from "../../src/features/users/public/userSchema.js"
import { accountSecurityOverviewStateCreate } from "../../src/features/account/ui/accountSecurityOverviewStateCreate.js"

const methodsCreate = (configured: boolean): UserAuthenticationMethods => ({
  emailOtp: { available: configured },
  passkeys: {
    credentials: configured
      ? [{ id: "passkey-1" } as UserAuthenticationMethods["passkeys"]["credentials"][number]]
      : [],
  },
  password: { available: configured },
  recoveryCodes: { available: configured, generatedAt: configured ? 1 : null, remaining: configured ? 7 : 0 },
  totp: { enrolled: false, enrollments: [] },
})

const userCreate = (configured: boolean): User =>
  ({
    email: "avery@example.com",
    emailVerified: configured,
    phoneNumber: configured ? "+14155552671" : undefined,
    phoneNumberVerifiedAt: configured ? 1 : undefined,
  }) as User

describe("account security overview", () => {
  test("states concrete configured values and counts for every required method", () => {
    const state = accountSecurityOverviewStateCreate({
      methods: () => methodsCreate(true),
      user: () => userCreate(true),
    })

    expect(state.items().map(({ configured, detail, label }) => ({ configured, detail, label }))).toEqual([
      { configured: true, detail: "Password set", label: "Password" },
      { configured: true, detail: "avery@example.com verified", label: "Email" },
      { configured: true, detail: "+14155552671 verified", label: "Phone" },
      { configured: true, detail: "1 passkeys configured", label: "Passkeys" },
      { configured: true, detail: "7 backup codes remaining", label: "Backup codes" },
    ])
  })

  test("states concrete missing values and zero counts for every required method", () => {
    const state = accountSecurityOverviewStateCreate({
      methods: () => methodsCreate(false),
      user: () => userCreate(false),
    })

    expect(state.items().map(({ configured, detail }) => ({ configured, detail }))).toEqual([
      { configured: false, detail: "No password set" },
      { configured: false, detail: "No verified email" },
      { configured: false, detail: "No verified phone" },
      { configured: false, detail: "0 passkeys configured" },
      { configured: false, detail: "0 backup codes remaining" },
    ])
  })

  test("renders the overview first with responsive outer and internal grids and outline status icons", async () => {
    const view = await Bun.file(
      new URL("../../src/features/account/ui/AccountSecurityOverview.tsx", import.meta.url),
    ).text()
    const workspace = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspaceProductionAdapter.tsx", import.meta.url),
    ).text()

    expect(view).toContain("sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5")
    expect(view).toContain("grid-cols-[auto_minmax(0,1fr)]")
    expect(view).toContain('item.configured ? "mt-0.5 size-5 text-success" : "mt-0.5 size-5 text-danger"')
    expect(workspace.indexOf('screen="overview"')).toBeLessThan(workspace.indexOf('kind="password"'))
  })
})
