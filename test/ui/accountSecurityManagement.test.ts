import { describe, expect, test } from "bun:test"
import { accountRecoveryAccessStateCreate } from "../../src/features/account/ui/accountRecoveryAccessStateCreate.js"
import { accountSecurityProgressStateCreate } from "../../src/features/account/ui/accountSecurityProgressStateCreate.js"
import type { UserAuthenticationMethods } from "../../src/features/users/public/userAuthenticationMethodsSchema.js"
import type { User } from "../../src/features/users/public/userSchema.js"

const methodsCreate = (configured: boolean): UserAuthenticationMethods => ({
  emailOtp: { available: configured },
  passkeys: {
    credentials: configured
      ? [{ id: "passkey-1" } as UserAuthenticationMethods["passkeys"]["credentials"][number]]
      : [],
  },
  password: { available: configured },
  recoveryCodes: { available: configured, generatedAt: configured ? 1 : null, remaining: configured ? 7 : 0 },
  totp: { enrolled: configured, enrollments: [] },
})

const userCreate = (configured: boolean): User =>
  ({
    email: "avery@example.com",
    emailVerified: configured,
    phoneNumber: configured ? "+14155552671" : undefined,
    phoneNumberVerifiedAt: configured ? 1 : undefined,
  }) as User

const progressCreate = (options: {
  readonly backupCodes: number
  readonly emailVerified: boolean
  readonly passkeyCount: number
  readonly password: boolean
  readonly phoneVerified: boolean
}) => {
  const methods = methodsCreate(false)
  const user = userCreate(false)
  return accountSecurityProgressStateCreate({
    methods: () => ({
      ...methods,
      emailOtp: { available: true },
      password: { available: options.password },
      recoveryCodes: {
        available: options.backupCodes > 0,
        generatedAt: options.backupCodes > 0 ? 1 : null,
        remaining: options.backupCodes,
      },
      totp: { enrolled: true, enrollments: [] },
    }),
    passkeyCount: () => options.passkeyCount,
    user: () => ({
      ...user,
      emailVerified: options.emailVerified,
      phoneNumber: "+14155552671",
      phoneNumberVerifiedAt: options.phoneVerified ? 1 : undefined,
    }),
  })
}

describe("account security management", () => {
  test("derives the four recovery-access states", () => {
    const configured = accountRecoveryAccessStateCreate({
      methods: () => methodsCreate(true),
      user: () => userCreate(true),
    })
    expect(configured.statuses()).toEqual([
      { configured: true, detail: "Password set", label: "Password" },
      { configured: true, detail: "avery@example.com verified", label: "Email" },
      { configured: true, detail: "+14155552671 verified", label: "Phone" },
      { configured: true, detail: "7 backup codes remaining", label: "Backup codes" },
    ])

    const missing = accountRecoveryAccessStateCreate({
      methods: () => methodsCreate(false),
      user: () => userCreate(false),
    })
    expect(missing.statuses().map(({ configured: value, detail }) => ({ configured: value, detail }))).toEqual([
      { configured: false, detail: "No password set" },
      { configured: false, detail: "No verified email" },
      { configured: false, detail: "No verified phone" },
      { configured: false, detail: "0 backup codes remaining" },
    ])
  })

  test("counts no configured methods at 0/5", () => {
    const state = progressCreate({
      backupCodes: 0,
      emailVerified: false,
      passkeyCount: 0,
      password: false,
      phoneVerified: false,
    })

    expect(state.configuredCount()).toBe(0)
    expect(state.text()).toBe("0/5 methods configured")
    expect(state.accessibleLabel()).toBe("Security setup progress: 0 of 5 methods configured")
    expect(state.width()).toBe("0%")
  })

  test("counts only the five specified method states in a mixed setup", () => {
    const state = progressCreate({
      backupCodes: 0,
      emailVerified: true,
      passkeyCount: 2,
      password: true,
      phoneVerified: false,
    })

    expect(state.configuredCount()).toBe(3)
    expect(state.text()).toBe("3/5 methods configured")
    expect(state.accessibleLabel()).toBe("Security setup progress: 3 of 5 methods configured")
    expect(state.width()).toBe("60%")
  })

  test("counts every configured method at 5/5", () => {
    const state = progressCreate({
      backupCodes: 1,
      emailVerified: true,
      passkeyCount: 1,
      password: true,
      phoneVerified: true,
    })

    expect(state.configuredCount()).toBe(5)
    expect(state.text()).toBe("5/5 methods configured")
    expect(state.accessibleLabel()).toBe("Security setup progress: 5 of 5 methods configured")
    expect(state.width()).toBe("100%")
  })

  test("renders exactly four responsive management cards followed by seamless progress", async () => {
    const management = await Bun.file(
      new URL("../../src/features/account/ui/AccountSecurityManagement.tsx", import.meta.url),
    ).text()
    const view = await Bun.file(
      new URL("../../src/features/account/ui/AccountSecurityView.tsx", import.meta.url),
    ).text()

    expect(management).toContain("md:grid-cols-2 2xl:grid-cols-4")
    expect(management.match(/<Account(Passkeys|Factors|Identities|RecoveryCodes)Section/g)).toHaveLength(4)
    expect(management).toContain("<AccountSecurityProgress state={props.state} />")
    expect(management.indexOf("<AccountSecurityProgress")).toBeGreaterThan(
      management.indexOf("<AccountRecoveryCodesSection"),
    )
    expect(
      await Bun.file(new URL("../../src/features/account/ui/AccountSecurityProgress.tsx", import.meta.url)).exists(),
    ).toBe(true)
    expect(view).toContain("<AccountSecurityManagement")
    expect(view).not.toContain("AccountSecurityOverview")
  })

  test("exposes progress semantics and smooth responsive width without nested card chrome", async () => {
    const progress = await Bun.file(
      new URL("../../src/features/account/ui/AccountSecurityProgress.tsx", import.meta.url),
    ).text()

    expect(progress).toContain('role="progressbar"')
    expect(progress).toContain("aria-valuemin={0}")
    expect(progress).toContain("aria-valuemax={5}")
    expect(progress).toContain("aria-valuenow={state.configuredCount()}")
    expect(progress).toContain("aria-label={state.accessibleLabel()}")
    expect(progress).toContain("style={{ width: state.width() }}")
    expect(progress).toContain("transition-[width]")
    expect(progress).toContain("motion-reduce:transition-none")
    expect(progress).toContain("sm:flex-row")
    expect(progress).not.toContain("AuthenticatedSection")
  })

  test("uses the required card titles and keeps recovery actions without profile list duplication", async () => {
    const sources = await Promise.all(
      [
        "AccountPasskeysSection",
        "AccountFactorsSection",
        "AccountIdentitiesSection",
        "AccountRecoveryCodesSection",
      ].map((name) => Bun.file(new URL(`../../src/features/account/ui/${name}.tsx`, import.meta.url)).text()),
    )

    expect(sources[0]).toContain('title={messageTranslate("shell.nav.passkeys")}')
    expect(sources[1]).toContain('title={messageTranslate("account.security.authenticators")}')
    expect(sources[2]).toContain('title={messageTranslate("shell.nav.linkedIdentities")}')
    expect(sources[3]).toContain('title={messageTranslate("account.recovery.summary")}')
    for (const source of sources) expect(source).toContain("<AccountSecurityStatus")

    expect(sources[3]).toContain("props.passwordAction")
    expect(sources[3]).toContain("onClick={props.state.recoveryCodesGenerate}")
    expect(sources[3]).toContain('data-one-time-secret="recovery-codes"')
    expect(sources[3]).not.toContain("AccountEmailAddressView")
    expect(sources[3]).not.toContain("AccountProfilePhoneSection")
  })

  test("moves authenticator enrollment into one accessible dialog without changing removal", async () => {
    const factors = await Bun.file(
      new URL("../../src/features/account/ui/AccountFactorsSection.tsx", import.meta.url),
    ).text()

    expect(factors).not.toContain("account.factors.description")
    expect(factors).not.toContain("account.factors.emailOtp")
    expect(factors).not.toContain("account.factors.passkeys")
    expect(factors).not.toContain("account.factors.recovery")
    expect(factors.match(/<AuthenticatedDialog/g)).toHaveLength(1)
    expect(factors).toContain("open={props.state.totpDialogOpen()}")
    expect(factors).toContain("onOpenChange={props.state.totpDialogOpenSet}")
    expect(factors).toContain('triggerLabel={messageTranslate("account.factors.addTotp")}')
    expect(factors).toContain('disabled={props.state.pendingId()?.startsWith("totp:")}')
    expect(factors.indexOf("props.state.totpSetup()")).toBeLessThan(factors.indexOf("</AuthenticatedDialog>"))
    expect(factors).toContain("{setup().secret}")
    expect(factors).toContain("{setup().otpauthUri}")
    expect(factors).toContain("props.state.totpError()")
    expect(factors).toContain("state.startPending()")
    expect(factors).toContain("onClick={props.state.totpSetupDismiss}")
    expect(factors).toContain("onClick={() => props.state.totpRemove(enrollment.id)}")
    expect(
      await Bun.file(new URL("../../src/features/account/ui/AccountSecurityOverview.tsx", import.meta.url)).exists(),
    ).toBe(false)
  })

  test("uses prominent configured and missing MDI outline status icons", async () => {
    const status = await Bun.file(
      new URL("../../src/features/account/ui/AccountSecurityStatus.tsx", import.meta.url),
    ).text()

    expect(status).toContain("mdiCheckCircleOutline")
    expect(status).toContain("mdiAlertCircleOutline")
    expect(status).toContain('aria-hidden="true"')
    expect(status).toContain("text-success")
    expect(status).toContain("text-danger")
  })

  test("loads all existing security resources for the consolidated production card grid", async () => {
    const state = await Bun.file(
      new URL("../../src/features/account/ui/accountSecurityProductionStateCreate.ts", import.meta.url),
    ).text()

    const overviewBlock = state.slice(
      state.indexOf('if (screen === "overview")'),
      state.indexOf('if (screen === "sessions")'),
    )
    expect(overviewBlock).toContain("api.methodsGet(realmId)")
    expect(overviewBlock).toContain("api.userGet(realmId)")
    expect(overviewBlock).toContain("api.passkeyList(realmId)")
    expect(overviewBlock).toContain("api.identitiesList(realmId)")
    expect(overviewBlock).toContain("api.identityProvidersList(realmId)")
  })
})
