import { expect, test } from "bun:test"

test("email addresses are an independently collapsed summary with helper copy only inside", async () => {
  const source = await Bun.file(
    new URL("../../src/features/account/ui/AccountEmailAddressView.tsx", import.meta.url),
  ).text()

  expect(source).toContain("<AccountDisclosure")
  expect(source).toContain('variant="card"')
  expect(source).toContain("value={state.summaryValue()}")
  expect(source).toContain("status={state.summaryStatus()}")
  expect(source.indexOf("<AccountDisclosure")).toBeLessThan(source.indexOf("account.profile.emailDescription"))
  expect(source).not.toContain("<AuthenticatedSection")
})

test("address rows open labelled management dialogs; add is last and mutations stay inside dialogs", async () => {
  const source = await Bun.file(
    new URL("../../src/features/account/ui/AccountEmailAddressView.tsx", import.meta.url),
  ).text()

  const row = source.indexOf("<For each={props.addresses}>")
  const management = source.indexOf("<AuthenticatedDialog", row)
  const add = source.indexOf("<AuthenticatedDialog", management + 1)
  const listEnd = source.indexOf("</ul>", row)
  expect(row).toBeGreaterThan(-1)
  expect(management).toBeGreaterThan(row)
  expect(source.slice(management, add)).toContain("title={address.email}")
  expect(source.slice(management, add)).toContain("triggerLabel={")
  expect(source.slice(management, add)).toContain("open={state.dialogOpen(address.id)}")
  expect(source.slice(management, add)).toContain("disabled={!address.verified || props.actionId !== undefined}")
  expect(source.slice(management, add)).toContain("disabled={address.isPrimary || props.actionId !== undefined}")
  expect(source.slice(management, add)).toContain("onClick={() => props.onPrimarySet(address.id)}")
  expect(source.slice(management, add)).toContain("onClick={() => props.onRemove(address.id)}")
  expect(add).toBeGreaterThan(source.indexOf("</For>", row))
  expect(add).toBeLessThan(listEnd)
  expect(source.slice(add, listEnd)).toContain("onSubmit={props.onAddStart}")
  expect(source.slice(add, listEnd)).toContain("onSubmit={props.onAddVerify}")
  expect(source.slice(add, listEnd)).toContain("onClick={props.onAddResend}")
})
