import { expect, test } from "bun:test"

test("phone card shows the current number and status when closed and keeps actions inside its dialog", async () => {
  const source = await Bun.file(
    new URL("../../src/features/account/ui/AccountProfilePhoneSection.tsx", import.meta.url),
  ).text()

  expect(source).toContain("<AccountDisclosure")
  expect(source).toContain('variant="card"')
  expect(source).toContain('value={props.phoneNumber || messageTranslate("account.profile.notSet")}')
  expect(source).toContain('statusTone={props.phoneNumber && props.verified ? "success" : "neutral"}')
  expect(source.indexOf("<AccountDisclosure")).toBeLessThan(
    source.indexOf('messageTranslate("account.profile.phoneDescription")'),
  )
  expect(source.indexOf("<AuthenticatedDialog")).toBeLessThan(source.indexOf("onSubmit={props.onStart}"))
  expect(source.indexOf("<AuthenticatedDialog")).toBeLessThan(source.indexOf("onSubmit={props.onVerify}"))
  expect(source.match(/<AuthenticatedDialog/g)).toHaveLength(1)
  expect(source).not.toContain("<AuthenticatedSection")
})
