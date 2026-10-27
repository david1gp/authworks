import { describe, expect, mock, test } from "bun:test"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { DirectoryAdminAdapter } from "./directoryAdminAdapter.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"

// Plain `bun test` resolves Solid's server runtime, whose effects do not run.
// Use the real client runtime so the reactive list reload is exercised.
const solidRuntimePath = "../../../../node_modules/solid-js/dist/solid.js"
const solidRuntime = await import(solidRuntimePath)
mock.module("solid-js", () => solidRuntime)
const [{ createRoot, createSignal }, { directoryAdminUsersPageStateCreate }] = await Promise.all([
  import("solid-js"),
  import("./directoryAdminUsersPageStateCreate.js"),
])

const entryFixture: DirectoryEntry = {
  memberships: [
    {
      createdAt: 1_755_782_400_000,
      membershipId: "membership-one",
      organizationId: "organization-one",
      organizationName: "Acme",
      roles: ["member"],
    },
  ],
  user: {
    createdAt: 1_755_782_400_000,
    email: "ada.osei@acme.example",
    emailVerified: true,
    id: "user-one",
    state: "active",
    userName: "ada.osei",
    verificationState: "verified",
  },
}

const adapterStubCreate = (calls: { list: number }): DirectoryAdminAdapter =>
  ({
    directoryUserCreate: async () => resultCreate({ user: undefined as never }),
    invitationCreate: async () => ({ errorMessage: "unused", success: false }) as never,
    invitationList: async () => resultCreate({ items: [] }),
    invitationRevoke: async () => resultCreate({ revoked: true }),
    organizationUserList: async () => {
      calls.list += 1
      return resultCreate({ items: [entryFixture] })
    },
    organizationUserSummary: async () => resultCreate({ roles: { admin: 0, guest: 0, member: 1, owner: 0 }, total: 1 }),
    realmUserList: async () => {
      calls.list += 1
      return resultCreate({ items: [entryFixture] })
    },
    serviceAccountCreate: async () => ({ errorMessage: "unused", success: false }) as never,
    serviceAccountList: async () => resultCreate({ items: [] }),
  }) as DirectoryAdminAdapter

const flush = async () => {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await Promise.resolve()
}

describe("directory admin users page reload", () => {
  test("opening and closing a dialog does not reload the people list", async () => {
    const calls = { list: 0 }
    const { search, setSearch, dispose } = createRoot((dispose) => {
      const [search, setSearch] = createSignal("")
      const page = directoryAdminUsersPageStateCreate({
        adapter: adapterStubCreate(calls),
        confirm: () => false,
        organizationId: "organization-one",
        realmAdministrator: false,
        realmId: "realm-one",
        search,
      })
      return { dispose, page, search, setSearch }
    })
    expect(search()).toBe("")
    await flush()
    expect(calls.list).toBe(1)

    // Opening the invite dialog only adds `?dialog=`; the list must stay put.
    setSearch("?dialog=invite")
    await flush()
    expect(calls.list).toBe(1)

    // Same for the create-user dialog and for closing the dialog again.
    setSearch("?dialog=create-user")
    await flush()
    expect(calls.list).toBe(1)
    setSearch("")
    await flush()
    expect(calls.list).toBe(1)
    dispose()
  })

  test("changing the search filter still reloads the people list", async () => {
    const calls = { list: 0 }
    const { setSearch, dispose } = createRoot((dispose) => {
      const [search, setSearch] = createSignal("")
      const page = directoryAdminUsersPageStateCreate({
        adapter: adapterStubCreate(calls),
        confirm: () => false,
        organizationId: "organization-one",
        realmAdministrator: false,
        realmId: "realm-one",
        search,
      })
      return { dispose, page, search, setSearch }
    })
    await flush()
    expect(calls.list).toBe(1)

    setSearch("?q=ada")
    await flush()
    expect(calls.list).toBe(2)
    dispose()
  })
})
