import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { PasskeyCredential } from "../../passkeys/public/passkeyCredentialSchema.js"
import { accountPasskeysSectionStateCreate } from "./accountPasskeysSectionStateCreate.js"

const credential = (id: string): PasskeyCredential => ({
  aaguid: "00000000-0000-0000-0000-000000000001",
  backedUp: true,
  createdAt: 1,
  deviceType: "multiDevice",
  id,
  lastUsedAt: null,
  revokedAt: null,
  transports: ["internal"],
})

test("passkey card summary reflects the current count without mutating credentials", () => {
  createRoot((dispose) => {
    const passkeys = createSignalObject<PasskeyCredential[]>([])
    const state = accountPasskeysSectionStateCreate(passkeys.get)

    expect(state.summaryValue()).toBe("0 passkeys configured")
    expect(state.summaryStatus()).toBe("Not configured")
    expect(state.summaryTone()).toBe("neutral")
    passkeys.set([credential("one"), credential("two")])
    expect(state.summaryValue()).toBe("2 passkeys configured")
    expect(state.summaryStatus()).toBe("Configured")
    expect(state.summaryTone()).toBe("success")
    expect(passkeys.get()).toHaveLength(2)
    dispose()
  })
})

test("passkey item and setup dialogs select independently and removed items cannot remain open", () => {
  createRoot((dispose) => {
    const passkeys = createSignalObject([credential("one"), credential("two")])
    const state = accountPasskeysSectionStateCreate(passkeys.get)

    state.dialogOpenChange("one", true)
    expect(state.dialogOpen("one")).toBe(true)
    expect(state.dialogOpen("two")).toBe(false)
    state.addDialogOpenChange(true)
    expect(state.dialogOpen("one")).toBe(false)
    expect(state.addDialogOpen()).toBe(true)
    state.dialogOpenChange("two", true)
    expect(state.addDialogOpen()).toBe(false)
    expect(state.dialogOpen("two")).toBe(true)
    passkeys.set([credential("one")])
    expect(state.dialogOpen("two")).toBe(false)
    state.dialogOpenChange("two", false)
    state.dialogOpenChange("one", true)
    expect(state.dialogOpen("one")).toBe(true)
    state.dialogOpenChange("one", false)
    expect(state.dialogOpen("one")).toBe(false)
    dispose()
  })
})

test("passkey rows open management dialogs and setup and removal actions stay inside dialogs", async () => {
  const source = await Bun.file(new URL("./AccountPasskeysSection.tsx", import.meta.url)).text()
  expect(source).toContain('summary={messageTranslate("shell.nav.passkeys")}')
  expect(source).toContain("status={state.summaryStatus()}")
  expect(source).toContain("value={state.summaryValue()}")
  expect(source).toContain('messageTranslate("account.passkeys.description")')
  expect(source).toContain("<For each={props.state.passkeys()}>")
  expect(source).toContain('title={messageTranslate("account.passkeys.manage", {')
  expect(source).toContain("open={state.dialogOpen(credential.id)}")
  expect(source).toContain("onClick={() => props.state.passkeyRevoke(credential.id)}")
  expect(source).toContain("open={state.addDialogOpen()}")
  expect(source).toContain("onClick={props.state.passkeyAdd}")
  expect(source.indexOf("onClick={props.state.passkeyAdd}")).toBeGreaterThan(
    source.indexOf('title={messageTranslate("account.passkeys.add")}'),
  )
  expect(source.indexOf("onClick={() => props.state.passkeyRevoke(credential.id)}")).toBeLessThan(
    source.indexOf("</AuthenticatedDialog>"),
  )
})
