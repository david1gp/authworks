import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { SessionMe } from "../../sessions/public/sessionMeSchema.js"
import { accountSessionsSectionStateCreate } from "./accountSessionsSectionStateCreate.js"

const session = (id: string, current: boolean): SessionMe => ({
  assurance: "authenticated",
  authenticationMethod: "password",
  createdAt: 1,
  current,
  device: {},
  expiresAt: 2,
  id,
  lastUsedAt: 1,
  revokedAt: null,
})

test("session detail dialogs select one visible session without changing session data", () => {
  createRoot((dispose) => {
    const sessions = createSignalObject([session("current", true), session("other", false)])
    const state = accountSessionsSectionStateCreate(sessions.get)

    expect(state.summaryValue()).toBe("2 active sessions")
    expect(state.summaryStatus()).toBe("Current session")
    state.dialogOpenChange("current", true)
    expect(state.dialogOpen("current")).toBe(true)
    state.dialogOpenChange("other", true)
    expect(state.dialogOpen("current")).toBe(false)
    expect(state.dialogOpen("other")).toBe(true)
    sessions.set([session("current", true)])
    expect(state.summaryValue()).toBe("1 active session")
    expect(state.dialogOpen("other")).toBe(false)
    state.dialogOpenChange("missing", true)
    expect(state.dialogOpen("missing")).toBe(false)
    state.dialogOpenChange("current", true)
    state.dialogOpenChange("current", false)
    expect(state.dialogOpen("current")).toBe(false)
    expect(sessions.get()).toHaveLength(1)
    dispose()
  })
})

test("revoke dispatch requires an open non-current session even when data changes", () => {
  createRoot((dispose) => {
    const sessions = createSignalObject([session("current", true), session("other", false)])
    const state = accountSessionsSectionStateCreate(sessions.get)
    const revoked: string[] = []
    const revoke = async (id: string) => {
      revoked.push(id)
    }

    state.sessionRevoke("other", revoke)
    state.dialogOpenChange("current", true)
    state.sessionRevoke("current", revoke)
    state.dialogOpenChange("other", true)
    state.sessionRevoke("other", revoke)
    sessions.set([session("current", true), session("other", true)])
    state.sessionRevoke("other", revoke)
    expect(revoked).toEqual(["other"])
    dispose()
  })
})

test("session card keeps detail and revoke controls in a labelled dialog, never for the current session", async () => {
  const source = await Bun.file(new URL("./AccountSessionsSection.tsx", import.meta.url)).text()
  expect(source).toContain("<AccountDisclosure")
  expect(source).toContain("icon={mdiDevices}")
  expect(source).toContain("value={state.summaryValue()}")
  expect(source.indexOf("<AccountDisclosure")).toBeLessThan(source.indexOf("account.sessions.description"))
  expect(source).toContain('title={messageTranslate("account.sessions.manage"')
  expect(source).toContain("open={state.dialogOpen(session.id)}")
  expect(source).toContain("<Show when={!session.current}>")
  expect(source.indexOf("<AuthenticatedDialog")).toBeLessThan(source.indexOf("state.sessionRevoke(session.id"))
  expect(source.indexOf("state.sessionRevoke(session.id")).toBeLessThan(source.indexOf("</AuthenticatedDialog>"))
  expect(source).not.toContain("AuthenticatedToolbar")
})
