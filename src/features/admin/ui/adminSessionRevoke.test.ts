import { describe, expect, mock, test } from "bun:test"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { adminDemoAdapterCreate } from "./adminDemoAdapterCreate.js"
import { adminDemoUserSessionsFixture } from "./adminDemoUserSessionsFixture.js"

// Plain `bun test` resolves Solid's server runtime, whose effects do not run.
// Use the real client runtime so the initial load and the post-revoke refetch are exercised.
const solidRuntimePath = "../../../../node_modules/solid-js/dist/solid.js"
const solidRuntime = await import(solidRuntimePath)
mock.module("solid-js", () => solidRuntime)
const [{ createRoot }, { adminPageStateCreate }] = await Promise.all([
  import("solid-js"),
  import("./adminPageStateCreate.js"),
])

const flushEffects = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe("administrator session revoke", () => {
  test("a confirmed revoke calls the adapter, refetches the list, and shows a notice", async () => {
    const revoked: { readonly userId: string; readonly sessionId: string }[] = []
    const listed: Session[] = structuredClone([...adminDemoUserSessionsFixture])
    const { page, dispose } = createRoot((dispose) => ({
      dispose,
      page: adminPageStateCreate({
        adapter: {
          ...adminDemoAdapterCreate(() => "success"),
          sessionList: async () => resultCreate({ items: structuredClone(listed) }),
          sessionRevoke: async (userId, sessionId) => {
            revoked.push({ sessionId, userId })
            const remaining = listed.filter((item) => item.id !== sessionId)
            listed.splice(0, listed.length, ...remaining)
            return resultCreate({ revoked: true })
          },
        },
        confirm: () => true,
        screen: () => "sessions",
      }),
    }))
    await flushEffects()
    expect(page.sessions()).toHaveLength(2)

    const target = adminDemoUserSessionsFixture[0]
    if (target === undefined) throw new Error("The revoke target fixture is missing.")
    await page.sessionRevoke(target.userId ?? target.subjectId, target.id)
    await flushEffects()

    expect(revoked).toEqual([{ sessionId: target.id, userId: target.userId ?? target.subjectId }])
    expect(page.sessions().map((session) => session.id)).toEqual(
      adminDemoUserSessionsFixture.filter((session) => session.id !== target.id).map((session) => session.id),
    )
    expect(page.notice()).toBe("The session was revoked.")
    expect(page.pendingId()).toBeUndefined()
    dispose()
  })

  test("a declined confirmation never reaches the adapter", async () => {
    let revokeCalls = 0
    const { page, dispose } = createRoot((dispose) => ({
      dispose,
      page: adminPageStateCreate({
        adapter: {
          ...adminDemoAdapterCreate(() => "success"),
          sessionRevoke: async () => {
            revokeCalls += 1
            return resultCreate({ revoked: true })
          },
        },
        confirm: () => false,
        screen: () => "sessions",
      }),
    }))
    await flushEffects()
    const target = adminDemoUserSessionsFixture[0]
    if (target === undefined) throw new Error("The revoke target fixture is missing.")
    await page.sessionRevoke(target.userId ?? target.subjectId, target.id)

    expect(revokeCalls).toBe(0)
    expect(page.notice()).toBeUndefined()
    expect(page.sessions()).toHaveLength(2)
    dispose()
  })
})
