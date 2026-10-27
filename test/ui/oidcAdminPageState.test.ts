import { describe, expect, mock, test } from "bun:test"

// The Solid runtime is not resolvable under the test condition, so the effect is
// captured and re-run manually to simulate screen changes.
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

import type { OidcAdminAdapter } from "../../src/features/oidc/ui/oidcAdminAdapter.js"
import type { OidcAdminScreen } from "../../src/features/oidc/ui/oidcAdminScreenSchema.js"

const [{ oidcAdminPageStateCreate }, { resultCreate }] = await Promise.all([
  import("../../src/features/oidc/ui/oidcAdminPageStateCreate.js"),
  import("../../src/platform/errors/resultCreate.js"),
])

const flush = () => new Promise((resolve) => setTimeout(resolve, 10))
const rerunEffect = async () => {
  expect(capturedEffect).toBeDefined()
  capturedEffect?.()
  await flush()
}

describe("oidc admin page screen changes", () => {
  test("switching screens drops the previous page cursor", async () => {
    capturedEffect = undefined
    let currentScreen: OidcAdminScreen = "signing-keys"
    const keyCalls: (string | undefined)[] = []
    const clientCalls: (string | undefined)[] = []
    const adapter = {
      applicationList: () => Promise.resolve(resultCreate([])),
      clientCreate: () => Promise.resolve(resultCreate(undefined as never)),
      clientGet: () => Promise.resolve(resultCreate(undefined as never)),
      clientLifecycleSet: () => Promise.resolve(resultCreate(undefined as never)),
      clientList: (pageToken?: string) => {
        clientCalls.push(pageToken)
        return Promise.resolve(resultCreate({ items: [] }))
      },
      clientSecretRevoke: () => Promise.resolve(resultCreate(undefined as never)),
      clientSecretRotate: () => Promise.resolve(resultCreate(undefined as never)),
      clientUpdate: () => Promise.resolve(resultCreate(undefined as never)),
      consentList: () => Promise.resolve(resultCreate({ items: [] })),
      consentRevoke: () => Promise.resolve(resultCreate({ revoked: true as const })),
      discoveryGet: () => Promise.resolve(resultCreate(undefined as never)),
      jwksGet: () => Promise.resolve(resultCreate(undefined as never)),
      projectList: () => Promise.resolve(resultCreate([])),
      signingKeyCreate: () => Promise.resolve(resultCreate(undefined as never)),
      signingKeyList: (pageToken?: string) => {
        keyCalls.push(pageToken)
        return Promise.resolve(resultCreate({ items: [], nextPageToken: "keys-cursor" }))
      },
      signingKeyRetire: () => Promise.resolve(resultCreate(undefined as never)),
      signingKeyRotate: () => Promise.resolve(resultCreate(undefined as never)),
      users: () => Promise.resolve(resultCreate({ items: [] })),
    } satisfies OidcAdminAdapter
    const page = oidcAdminPageStateCreate({
      adapter,
      clientId: () => undefined,
      confirm: () => true,
      consentUserId: () => undefined,
      screen: () => currentScreen,
    })
    await flush()
    expect(keyCalls).toEqual([undefined])

    // Page the signing keys, then switch to the clients screen: the client list
    // must start from the first page instead of reusing the keys cursor.
    page.pageNext()
    expect(page.hasPreviousPage()).toBe(true)
    currentScreen = "oidc-clients"
    await rerunEffect()
    expect(page.hasPreviousPage()).toBe(false)
    expect(clientCalls).toEqual([])
    await rerunEffect()
    expect(clientCalls).toEqual([undefined])
    expect(keyCalls).toEqual([undefined])
  })
})
