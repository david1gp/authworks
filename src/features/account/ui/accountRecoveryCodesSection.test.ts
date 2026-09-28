import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { accountPasswordSectionStateCreate } from "./accountPasswordSectionStateCreate.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

test("password card reflects configured and missing method state without changing it", () => {
  createRoot((dispose) => {
    const available = createSignalObject(false)
    const security = { methods: () => ({ password: { available: available.get() } }) } as AccountSecurityViewState
    const state = accountPasswordSectionStateCreate(() => security)

    expect(state.summaryStatus()).toBe("Not configured")
    expect(state.summaryValue()).toBe("No password set")
    available.set(true)
    expect(state.summaryStatus()).toBe("Configured")
    expect(state.summaryValue()).toBe("Password set")
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
