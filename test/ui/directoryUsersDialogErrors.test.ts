import { describe, expect, mock, test } from "bun:test"

// The Solid runtime is not resolvable under the test condition, so the primitives the
// users page state creator uses are replaced with equivalent non-reactive behaviour.
mock.module("solid-js", () => ({
  createEffect: (effect: (previous?: unknown) => unknown) => effect(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (dependency: () => unknown, handler: (value: unknown) => unknown) => () => handler(dependency()),
}))

import type { DirectoryAdminAdapter } from "../../src/features/directory/ui/directoryAdminAdapter.js"

const [{ directoryAdminUsersPageStateCreate }, { resultErrorCreate }, { resultCreate }, { englishCatalog }] =
  await Promise.all([
    import("../../src/features/directory/ui/directoryAdminUsersPageStateCreate.js"),
    import("../../src/platform/errors/resultErrorCreate.js"),
    import("../../src/platform/errors/resultCreate.js"),
    import("../../src/ui/i18n/model/englishCatalog.js"),
  ])

const emptySummary = { roles: { admin: 0, guest: 0, member: 0, owner: 0 }, total: 0 }

const listOk = <T>(data: T) => Promise.resolve(resultCreate(data))

const failingServiceAccountCreate = () =>
  Promise.resolve(resultErrorCreate("serviceAccountCreate", "The service account was not created."))

const baseAdapter = (
  overrides?: Partial<Pick<DirectoryAdminAdapter, "serviceAccountCreate">>,
): DirectoryAdminAdapter => ({
  directoryUserCreate: () => Promise.resolve(resultErrorCreate("directoryUserCreate", "The user was not created.")),
  invitationCreate: () => Promise.resolve(resultErrorCreate("invitationCreate", "The invitation was not sent.")),
  invitationList: () => listOk({ items: [] }),
  invitationRevoke: () => listOk({ revoked: true }),
  organizationUserList: () => listOk({ items: [] }),
  organizationUserSummary: () => listOk(emptySummary),
  realmUserList: () => listOk({ items: [] }),
  serviceAccountCreate: failingServiceAccountCreate,
  serviceAccountList: () => listOk({ items: [] }),
  ...overrides,
})

const pageCreate = (adapter: ReturnType<typeof baseAdapter>) =>
  directoryAdminUsersPageStateCreate({
    adapter,
    confirm: () => true,
    organizationId: "org-1",
    realmAdministrator: true,
    realmId: "realm-1",
    search: () => "",
  })

describe("users page dialog failures", () => {
  test("a rejected service account create surfaces the reason in the dialog", async () => {
    const page = pageCreate(baseAdapter())
    await Promise.resolve()

    const created = await page.serviceAccountCreateSubmit({ displayName: "Sync", scopes: "", userName: "sync" })

    expect(created).toBe(false)
    expect(page.validationMessage()).toBe("The service account was not created.")
    expect(page.serviceSecret()).toBeUndefined()
  })

  test("a rejected invitation create surfaces the reason in the dialog", async () => {
    const page = pageCreate(baseAdapter())
    await Promise.resolve()

    await page.invitationCreateSubmit({ email: "ada@example.com", roles: ["member"] })

    expect(page.validationMessage()).toBe("The invitation was not sent.")
    expect(page.invitationToken()).toBeUndefined()
  })

  test("a rejected human user create surfaces the reason in the dialog", async () => {
    const page = pageCreate(baseAdapter())
    await Promise.resolve()

    await page.userCreateSubmit({ email: "ada@example.com", profile: {}, userName: "ada" })

    expect(page.validationMessage()).toBe("The user was not created.")
    expect(page.createdUser()).toBeUndefined()
  })

  test("a created service account clears the dialog error channel", async () => {
    const page = pageCreate(
      baseAdapter({
        serviceAccountCreate: () =>
          listOk({
            clientId: "sync",
            machineUser: {
              createdAt: 0,
              displayName: "Sync",
              id: "01900000-0000-7000-8000-000000000071",
              realmId: "01900000-0000-7000-8000-000000000072",
              scopes: [],
              status: "active",
              updatedAt: 0,
              userName: "sync",
            },
            secret: "secret",
          }),
      }),
    )
    await Promise.resolve()

    const created = await page.serviceAccountCreateSubmit({ displayName: "Sync", scopes: "", userName: "sync" })

    expect(created).toBe(true)
    expect(page.validationMessage()).toBeUndefined()
    expect(page.serviceSecret()?.secret).toBe("secret")
  })

  test("the mirrored fallback message exists in the English catalog", () => {
    expect(englishCatalog["common.error"]).toBeString()
  })
})
