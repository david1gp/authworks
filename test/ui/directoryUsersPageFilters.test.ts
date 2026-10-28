import { describe, expect, mock, test } from "bun:test"

// The Solid runtime is not resolvable under the test condition, so the effect is
// captured and re-run manually to simulate URL and pagination changes.
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

import type { DirectoryUserListQuery } from "../../src/features/directory/public/directoryUserListSchema.js"
import type { DirectoryAdminAdapter } from "../../src/features/directory/ui/directoryAdminAdapter.js"

const [{ directoryAdminUsersPageStateCreate }, { resultCreate }, { directoryAdminDemoAdapterCreate }] =
  await Promise.all([
    import("../../src/features/directory/ui/directoryAdminUsersPageStateCreate.js"),
    import("../../src/platform/errors/resultCreate.js"),
    import("../../src/features/directory/ui/directoryAdminDemoAdapterCreate.js"),
  ])

const flush = () => new Promise((resolve) => setTimeout(resolve, 10))
const rerunEffect = async () => {
  expect(capturedEffect).toBeDefined()
  capturedEffect?.()
  await flush()
}

describe("users page people filter and pagination", () => {
  test("changing the role filter drops the previous page cursor", async () => {
    capturedEffect = undefined
    let currentSearch = ""
    const seenQueries: (DirectoryUserListQuery | undefined)[] = []
    const adapter: DirectoryAdminAdapter = {
      directoryUserCreate: () => Promise.resolve(resultCreate({ user: undefined as never })),
      invitationCreate: () => Promise.resolve(resultCreate({ invitation: undefined as never, token: "" })),
      invitationList: () => Promise.resolve(resultCreate({ items: [] })),
      invitationRevoke: () => Promise.resolve(resultCreate({ revoked: true as const })),
      organizationUserList: (query) => {
        seenQueries.push(query === undefined ? undefined : { ...query })
        return Promise.resolve(resultCreate({ items: [], nextPageToken: "cursor-1" }))
      },
      organizationUserSummary: () =>
        Promise.resolve(resultCreate({ roles: { admin: 0, guest: 0, member: 0, owner: 0 }, total: 0 })),
      realmUserList: () => Promise.resolve(resultCreate({ items: [] })),
      serviceAccountCreate: () =>
        Promise.resolve(resultCreate({ clientId: "", machineUser: undefined as never, secret: "" })),
      serviceAccountList: () => Promise.resolve(resultCreate({ items: [] })),
    }
    const page = directoryAdminUsersPageStateCreate({
      adapter,
      confirm: () => true,
      invitationOrigin: "https://auth.example",
      organizationId: () => "org-1",
      realmAdministrator: () => false,
      realmId: () => "realm-1",
      search: () => currentSearch,
    })
    await flush()
    expect(seenQueries).toHaveLength(1)
    expect(seenQueries[0]?.pageToken).toBeUndefined()

    // Move to the second page, then re-run with the same filter: the cursor is kept.
    page.pageNext()
    expect(page.previousPageAvailable()).toBe(true)
    await rerunEffect()
    expect(seenQueries).toHaveLength(2)
    expect(seenQueries[1]).toMatchObject({ pageToken: "cursor-1" })

    // Change the role filter: the stale cursor must be dropped before the next load.
    currentSearch = "?role=admin"
    await rerunEffect()
    expect(page.previousPageAvailable()).toBe(false)
    expect(seenQueries).toHaveLength(2)
    await rerunEffect()
    expect(seenQueries).toHaveLength(3)
    expect(seenQueries[2]).toMatchObject({ role: "admin" })
    expect(seenQueries[2]?.pageToken).toBeUndefined()
    expect(page.peopleQuery()).toMatchObject({ role: "admin" })
  })
})

describe("directory demo adapter role filter", () => {
  test("the organization list matches only roles of the demo organization", async () => {
    const adapter = directoryAdminDemoAdapterCreate(
      () => "success",
      () => "owner",
    )
    const admins = await adapter.organizationUserList({ role: "admin" })
    expect(admins.success).toBe(true)
    if (!admins.success) return
    // Bruno Feld and Hana Sato administer Acme; Lena Fischer administers Globex only.
    expect(new Set(admins.data.items.map((item) => item.user.id))).toEqual(
      new Set(["01900000-0000-7000-8000-000000000102", "01900000-0000-7000-8000-000000000108"]),
    )
    const summary = await adapter.organizationUserSummary()
    expect(summary).toMatchObject({ success: true, data: { roles: { admin: 2 } } })
  })

  test("the realm list keeps anywhere semantics for realm administrators", async () => {
    const adapter = directoryAdminDemoAdapterCreate(
      () => "success",
      () => "realm-admin",
    )
    const admins = await adapter.realmUserList({ role: "admin" })
    expect(admins.success).toBe(true)
    if (!admins.success) return
    expect(admins.data.items.map((item) => item.user.id)).toContain("01900000-0000-7000-8000-000000000112")
  })
})
