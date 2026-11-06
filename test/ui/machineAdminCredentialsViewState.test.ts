import { describe, expect, mock, test } from "bun:test"

// The Solid runtime is not resolvable under the test condition, so signals are
// stubbed the same way the neighboring machine-admin state tests stub them.
mock.module("solid-js", () => ({
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
}))

import type { MachineAdminPageState } from "../../src/features/machineUsers/ui/machineAdminPageStateCreate.js"

const [{ machineAdminCredentialsViewStateCreate }] = await Promise.all([
  import("../../src/features/machineUsers/ui/machineAdminCredentialsViewStateCreate.js"),
])

const pageStub = (users: readonly { displayName: string; id: string }[]) =>
  ({
    machineUserName: (machineUserId: string) =>
      users.find((user) => user.id === machineUserId)?.displayName ?? machineUserId,
    machineUsers: () => users,
  }) as unknown as MachineAdminPageState

const viewStateCreate = (options: {
  basePath: string
  machineUserId: () => string | undefined
  users: readonly { displayName: string; id: string }[]
}) =>
  machineAdminCredentialsViewStateCreate({
    basePath: options.basePath,
    issueKind: () => "personal_access_token",
    issueKindSet: () => undefined,
    issueOpen: () => false,
    issueOpenSet: () => undefined,
    machineUserId: options.machineUserId,
    machineUserIdSet: () => undefined,
    page: pageStub(options.users),
  })

describe("machine admin credentials view cross-links", () => {
  test("builds service-accounts and machine-user detail hrefs from the production base path", () => {
    const state = viewStateCreate({
      basePath: "/admin",
      machineUserId: () => "machine-user-1",
      users: [{ displayName: "Billing sync", id: "machine-user-1" }],
    })

    expect(state.serviceAccountsHref()).toBe("/admin/users?tab=service-accounts")
    expect(state.machineUserDetailHref()).toBe("/admin/machine-users/machine-user-1")
  })

  test("builds demo hrefs from the demo base path", () => {
    const state = viewStateCreate({
      basePath: "/demo/admin",
      machineUserId: () => "machine-user-9",
      users: [{ displayName: "Demo service", id: "machine-user-9" }],
    })

    expect(state.serviceAccountsHref()).toBe("/demo/admin/users?tab=service-accounts")
    expect(state.machineUserDetailHref()).toBe("/demo/admin/machine-users/machine-user-9")
  })

  test("falls back to the first machine user when no subject is selected", () => {
    const state = viewStateCreate({
      basePath: "/admin",
      machineUserId: () => undefined,
      users: [
        { displayName: "Billing sync", id: "machine-user-1" },
        { displayName: "Report runner", id: "machine-user-2" },
      ],
    })

    expect(state.activeMachineUserId()).toBe("machine-user-1")
    expect(state.machineUserDetailHref()).toBe("/admin/machine-users/machine-user-1")
  })

  test("leaves no selected machine user when the list is empty", () => {
    const state = viewStateCreate({ basePath: "/admin", machineUserId: () => undefined, users: [] })

    expect(state.activeMachineUserId()).toBe("")
    expect(state.serviceAccountsHref()).toBe("/admin/users?tab=service-accounts")
  })
})
