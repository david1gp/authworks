import { describe, expect, mock, test } from "bun:test"

// The Solid runtime is not resolvable under the test condition, so the effect is
// captured and re-run manually to simulate screen and subject changes.
let capturedEffect: (() => void) | undefined
mock.module("solid-js", () => ({
  createEffect: (effect: () => void) => {
    capturedEffect = effect
    effect()
  },
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (dependency: () => unknown, handler: (value: unknown) => unknown) => () => handler(dependency()),
}))

import type { MachineAdminAdapter } from "../../src/features/machineUsers/ui/machineAdminAdapter.js"
import type { MachineAdminScreen } from "../../src/features/machineUsers/ui/machineAdminScreenSchema.js"

const [{ machineAdminPageStateCreate }, { resultCreate }] = await Promise.all([
  import("../../src/features/machineUsers/ui/machineAdminPageStateCreate.js"),
  import("../../src/platform/errors/resultCreate.js"),
])

const flush = () => new Promise((resolve) => setTimeout(resolve, 10))
const rerunEffect = async () => {
  expect(capturedEffect).toBeDefined()
  capturedEffect?.()
  await flush()
}

describe("machine admin page subject and screen changes", () => {
  test("switching the service account drops the previous page cursor", async () => {
    capturedEffect = undefined
    let currentScreen: MachineAdminScreen = "machine-users"
    let currentMachineUserId: string | undefined
    const credentialCalls: { machineUserId: string; pageToken: string | undefined }[] = []
    const directoryCalls: (string | undefined)[] = []
    const adapter = {
      apiKeyCreate: () => Promise.resolve(resultCreate({ credential: undefined as never, secret: "" })),
      clientSecretRotate: () =>
        Promise.resolve(resultCreate({ clientId: "", clientSecret: "", machineUser: undefined as never })),
      credentialList: (machineUserId: string, pageToken?: string) => {
        credentialCalls.push({ machineUserId, pageToken })
        return Promise.resolve(resultCreate({ items: [], nextPageToken: "cred-cursor" }))
      },
      credentialRevoke: () => Promise.resolve(resultCreate(undefined as never)),
      machineUserCreate: () =>
        Promise.resolve(resultCreate({ clientId: "", clientSecret: "", machineUser: undefined as never })),
      machineUserGet: (machineUserId: string) =>
        Promise.resolve(
          resultCreate({ displayName: machineUserId, id: machineUserId, userName: machineUserId } as never),
        ),
      machineUserLifecycleSet: () => Promise.resolve(resultCreate(undefined as never)),
      machineUserList: (pageToken?: string) => {
        directoryCalls.push(pageToken)
        return Promise.resolve(resultCreate({ items: [], nextPageToken: "dir-cursor" }))
      },
      machineUserUpdate: () => Promise.resolve(resultCreate(undefined as never)),
      personalAccessTokenCreate: () => Promise.resolve(resultCreate({ credential: undefined as never, secret: "" })),
    } satisfies MachineAdminAdapter
    const page = machineAdminPageStateCreate({
      adapter,
      confirm: () => true,
      machineUserId: () => currentMachineUserId,
      now: () => 0,
      screen: () => currentScreen,
    })
    await flush()
    expect(directoryCalls).toEqual([undefined])

    // Page the directory, then open another service account: its credentials must
    // start from the first page instead of reusing the directory cursor.
    page.pageNext()
    expect(page.hasPreviousPage()).toBe(true)
    currentScreen = "machine-user-detail"
    currentMachineUserId = "mu-b"
    await rerunEffect()
    expect(page.hasPreviousPage()).toBe(false)
    expect(credentialCalls).toEqual([])
    await rerunEffect()
    expect(credentialCalls).toEqual([{ machineUserId: "mu-b", pageToken: undefined }])

    // Paging within the same subject keeps its own cursor.
    page.pageNext()
    await rerunEffect()
    expect(credentialCalls).toEqual([
      { machineUserId: "mu-b", pageToken: undefined },
      { machineUserId: "mu-b", pageToken: "cred-cursor" },
    ])
  })
})
