import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { AccountSecurityHistoryItem } from "../public/accountSecurityHistoryItemSchema.js"
import { accountSecurityHistorySectionStateCreate } from "./accountSecurityHistorySectionStateCreate.js"

test("activity summary counts loaded events and updates when another page arrives", () => {
  createRoot((dispose) => {
    const history = createSignalObject<AccountSecurityHistoryItem[]>([])
    const state = accountSecurityHistorySectionStateCreate(history.get)
    expect(state.summaryStatus()).toBe("No security activity is available")
    expect(state.summaryValue()).toBe("0 events shown")
    history.set([{ category: "sessions", displayCode: "session.created", id: "one", occurredAt: 1 }])
    expect(state.summaryStatus()).toBe("Available")
    expect(state.summaryValue()).toBe("1 event shown")
    history.set([...history.get(), { category: "sessions", displayCode: "session.revoked", id: "two", occurredAt: 2 }])
    expect(state.summaryValue()).toBe("2 events shown")
    dispose()
  })
})

test("activity card shows the loaded count and keeps read-only pagination inside the disclosure", async () => {
  const source = await Bun.file(new URL("./AccountSecurityHistorySection.tsx", import.meta.url)).text()
  expect(source).toContain("<AccountDisclosure")
  expect(source).toContain("icon={mdiHistory}")
  expect(source).toContain("value={state.summaryValue()}")
  expect(source.indexOf("<AccountDisclosure")).toBeLessThan(source.indexOf("account.securityHistory.description"))
  expect(source.indexOf("<AccountDisclosure")).toBeLessThan(source.indexOf("data-security-history-list"))
  expect(source.indexOf("data-security-history-list")).toBeLessThan(
    source.indexOf("onClick={props.state.securityHistoryLoadMore}"),
  )
  expect(source).not.toContain("AuthenticatedDialog")
})
