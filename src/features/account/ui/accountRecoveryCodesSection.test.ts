import { expect, mock, test } from "bun:test"
import { createRoot } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { UserAuthenticationMethods } from "../../users/public/userAuthenticationMethodsSchema.js"
import { accountPasswordSectionStateCreate } from "./accountPasswordSectionStateCreate.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

const navigate = () => undefined

mock.module("@solidjs/router", () => ({
  useLocation: () => ({ hash: "", pathname: "/demo/account", search: "" }),
  useNavigate: () => navigate,
}))

const { accountRecoveryCodesSectionStateCreate } = await import("./accountRecoveryCodesSectionStateCreate.js")

test("password card reflects configured and missing method state and alerts while no password is set", () => {
  createRoot((dispose) => {
    const available = createSignalObject(false)
    const security = { methods: () => ({ password: { available: available.get() } }) } as AccountSecurityViewState
    const state = accountPasswordSectionStateCreate(() => security)

    expect(state.summaryStatus()).toBe("Not configured")
    expect(state.summaryValue()).toBe("No password set")
    expect(state.summaryTone()).toBe("danger")
    available.set(true)
    expect(state.summaryStatus()).toBe("Configured")
    expect(state.summaryValue()).toBe("Password set")
    expect(state.summaryTone()).toBe("success")
    dispose()
  })
})

test("recovery codes card alerts while no backup codes remain and confirms when codes are available", () => {
  createRoot((dispose) => {
    const remaining = createSignalObject(0)
    const methods = (): UserAuthenticationMethods => ({
      emailOtp: { available: false },
      passkeys: { credentials: [] },
      password: { available: true },
      recoveryCodes: { available: true, generatedAt: null, remaining: remaining.get() },
      totp: { enrolled: false, enrollments: [] },
    })
    const security = {
      methods,
      oneTimeCodes: (): string[] => [],
      pendingId: (): string | undefined => undefined,
    } as AccountSecurityViewState
    const state = accountRecoveryCodesSectionStateCreate(() => security)

    expect(state.summaryStatus()).toBe("Not configured")
    expect(state.summaryTone()).toBe("danger")
    remaining.set(3)
    expect(state.summaryStatus()).toBe("Configured")
    expect(state.summaryTone()).toBe("success")
    dispose()
  })
})

test("password and recovery codes are distinct collapsed cards with their own status", async () => {
  const files = await Promise.all(
    ["AccountSecurityManagement", "AccountPasswordSection", "AccountRecoveryCodesSection"].map((name) =>
      Bun.file(new URL(`./${name}.tsx`, import.meta.url)).text(),
    ),
  )

  expect(files[0]).toContain("<AccountPasswordSection action={props.passwordAction} state={props.state} />")
  expect(files[0]).toContain("<AccountRecoveryCodesSection state={props.state} />")
  for (const source of files.slice(1)) {
    expect(source).toContain("<AccountDisclosure")
    expect(source).toContain('variant="card"')
    expect(source).toContain("status={")
  }
  expect(files[1]).toContain("{props.action}")
  expect(files[2]).toContain("value={state.summaryValue()}")
})

test("generation and one-time acknowledgement remain inside the recovery dialog", async () => {
  const section = await Bun.file(new URL("./AccountRecoveryCodesSection.tsx", import.meta.url)).text()
  const dialog = section.slice(section.indexOf("<AuthenticatedDialog"), section.indexOf("</AuthenticatedDialog>"))
  const presentation = await Bun.file(new URL("./accountRecoveryCodesSectionStateCreate.ts", import.meta.url)).text()

  expect(dialog).toContain('title={messageTranslate("shell.nav.recoveryCodes")}')
  expect(dialog).toContain('messageTranslate("account.recovery.remaining"')
  expect(dialog).toContain("onClick={props.state.recoveryCodesGenerate}")
  expect(dialog).toContain('data-one-time-secret="recovery-codes"')
  expect(dialog).toContain("onClick={state.codesDismiss}")
  expect(presentation).toContain('codesVisible() || security().pendingId() === "recovery:generate"')
  expect(presentation).toContain("security().oneTimeCodesDismiss()")
  expect(presentation).toContain("v.safeParse(recoveryDialogSchema")
})
