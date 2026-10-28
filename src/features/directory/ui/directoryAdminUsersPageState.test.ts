import { describe, expect, mock, test } from "bun:test"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import type { DirectoryUserListResponse } from "../public/directoryUserListSchema.js"
import type { DirectoryAdminAdapter } from "./directoryAdminAdapter.js"

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
        invitationOrigin: "https://auth.example",
        organizationId: () => "organization-one",
        realmAdministrator: () => false,
        realmId: () => "realm-one",
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
        invitationOrigin: "https://auth.example",
        organizationId: () => "organization-one",
        realmAdministrator: () => false,
        realmId: () => "realm-one",
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

test("invitation creation exposes an encoded redemption link until acknowledged", async () => {
  let acknowledged = false
  const adapter = adapterStubCreate({ list: 0 })
  const { page, dispose } = createRoot((dispose) => ({
    dispose,
    page: directoryAdminUsersPageStateCreate({
      adapter: {
        ...adapter,
        invitationCreate: async () => resultCreate({ token: "a+b/& ?#", invitation: {} as never }),
      },
      confirm: () => false,
      invitationOrigin: "https://auth.example",
      onInvitationTokenAcknowledge: () => {
        acknowledged = true
      },
      organizationId: () => "organization-one",
      realmAdministrator: () => false,
      realmId: () => "realm-one",
      search: () => "",
    }),
  }))
  await page.invitationCreateSubmit({ email: "user@example.com", roles: ["member"] })
  expect(page.invitationLink()).toBe("https://auth.example/invitations/accept?token=a%2Bb%2F%26+%3F%23")
  page.invitationTokenAcknowledge()
  expect(page.invitationLink()).toBeUndefined()
  expect(page.invitationToken()).toBeUndefined()
  expect(acknowledged).toBe(true)
  dispose()
})

describe("directory admin users organization context", () => {
  const orgEntry = (organizationId: string, userName: string): DirectoryEntry => ({
    memberships: [
      {
        createdAt: 1_755_782_400_000,
        membershipId: `membership-${organizationId}`,
        organizationId,
        organizationName: organizationId,
        roles: ["member"],
      },
    ],
    user: {
      createdAt: 1_755_782_400_000,
      email: `${userName}@example.com`,
      emailVerified: true,
      id: `user-${organizationId}`,
      state: "active",
      userName,
      verificationState: "verified",
    },
  })

  test("late invitation and service account lists cannot replace the new organization or retain its cursors", async () => {
    for (const tab of ["invitations", "service-accounts"] as const) {
      let activeOrg = "a"
      let delay = false
      let resolveA: ((value: Result<{ items: never[]; nextPageToken?: string }>) => void) | undefined
      const calls: { org: string; query: unknown }[] = []
      const list = (query: unknown) => {
        calls.push({ org: activeOrg, query })
        if (activeOrg === "a" && delay)
          return new Promise<Result<{ items: never[]; nextPageToken?: string }>>((resolve) => {
            resolveA = resolve
          })
        return Promise.resolve(resultCreate({ items: [{ id: activeOrg }] as never[], nextPageToken: "cursor-a" }))
      }
      const { page, organizationSet, dispose } = createRoot((dispose) => {
        const [organizationId, organizationSet] = createSignal("a")
        return {
          dispose,
          organizationSet,
          page: directoryAdminUsersPageStateCreate({
            adapter: {
              ...adapterStubCreate({ list: 0 }),
              invitationList: list,
              serviceAccountList: list,
            } as DirectoryAdminAdapter,
            confirm: () => false,
            invitationOrigin: "https://auth.example",
            organizationId,
            realmAdministrator: () => false,
            realmId: () => "realm-one",
            search: () => `?tab=${tab}`,
          }),
        }
      })
      await flush()
      delay = true
      if (tab === "service-accounts") {
        page.servicePageNext()
        await flush()
        expect(page.servicePreviousPageAvailable()).toBe(true)
      } else {
        page.reload()
        await flush()
      }
      activeOrg = "b"
      organizationSet("b")
      await flush()
      expect(calls.at(-1)).toEqual({ org: "b", query: undefined })
      expect(page.servicePreviousPageAvailable()).toBe(false)
      resolveA?.(resultCreate({ items: [{ id: "a" }] as never[] }))
      await flush()
      expect((tab === "invitations" ? page.invitations() : page.serviceAccounts()).map((item) => item.id)).toEqual([
        "b",
      ])
      dispose()
    }
  })

  test("late organization summary cannot replace the new context and invitation secret is cleared", async () => {
    let activeOrg = "a"
    let resolveSummary:
      | ((value: Awaited<ReturnType<DirectoryAdminAdapter["organizationUserSummary"]>>) => void)
      | undefined
    const { page, organizationSet, adminSet, dispose } = createRoot((dispose) => {
      const [organizationId, organizationSet] = createSignal("a")
      const [realmAdministrator, adminSet] = createSignal(false)
      return {
        dispose,
        organizationSet,
        adminSet,
        page: directoryAdminUsersPageStateCreate({
          adapter: {
            ...adapterStubCreate({ list: 0 }),
            invitationCreate: async () => resultCreate({ token: "secret-a", invitation: {} as never }),
            organizationUserSummary: () =>
              activeOrg === "a"
                ? new Promise((resolve) => {
                    resolveSummary = resolve
                  })
                : Promise.resolve(resultCreate({ roles: { admin: 0, guest: 0, member: 2, owner: 0 }, total: 2 })),
          },
          confirm: () => false,
          invitationOrigin: "https://auth.example",
          organizationId,
          realmAdministrator,
          realmId: () => "realm-one",
          search: () => "?scope=all",
        }),
      }
    })
    await flush()
    // Creation starts a reload whose summary remains pending; the token is already visible.
    void page.invitationCreateSubmit({ email: "a@example.com", roles: ["member"] })
    await flush()
    expect(page.invitationToken()).toBe("secret-a")
    expect(page.scope()).toBe("organization")
    activeOrg = "b"
    organizationSet("b")
    adminSet(true)
    await flush()
    expect(page.realmAdministrator()).toBe(true)
    expect(page.scope()).toBe("all")
    expect(page.invitationToken()).toBeUndefined()
    expect(page.invitationLink()).toBeUndefined()
    expect(page.summary()?.total).toBe(2)
    resolveSummary?.(resultCreate({ roles: { admin: 0, guest: 0, member: 99, owner: 0 }, total: 99 }))
    await flush()
    expect(page.summary()?.total).toBe(2)
    dispose()
  })

  test("a confirmation opened in one organization cannot revoke its invitation in another", async () => {
    let confirmResolve: ((confirmed: boolean) => void) | undefined
    const revoked: string[] = []
    const { page, organizationSet, dispose } = createRoot((dispose) => {
      const [organizationId, organizationSet] = createSignal("a")
      return {
        dispose,
        organizationSet,
        page: directoryAdminUsersPageStateCreate({
          adapter: {
            ...adapterStubCreate({ list: 0 }),
            invitationRevoke: async (id) => {
              revoked.push(id)
              return resultCreate({ revoked: true })
            },
          },
          confirm: () =>
            new Promise((resolve) => {
              confirmResolve = resolve
            }),
          invitationOrigin: "https://auth.example",
          organizationId,
          realmAdministrator: () => false,
          realmId: () => "realm-one",
          search: () => "?tab=invitations",
        }),
      }
    })
    await flush()
    const action = page.invitationRevoke("invitation-a", "a@example.com")
    organizationSet("b")
    await flush()
    confirmResolve?.(true)
    await action
    expect(revoked).toEqual([])
    dispose()
  })

  test("switching organizations rejects the delayed previous response and resets cursors", async () => {
    let resolveOrgA: ((value: Result<DirectoryUserListResponse>) => void) | undefined
    const seenOrgs: string[] = []
    let activeOrg = "organization-a"
    const adapter: DirectoryAdminAdapter = {
      ...adapterStubCreate({ list: 0 }),
      organizationUserList: () => {
        const requested = activeOrg
        seenOrgs.push(requested)
        if (requested === "organization-a")
          return new Promise((resolve) => {
            resolveOrgA = resolve
          })
        return Promise.resolve(resultCreate({ items: [orgEntry("organization-b", "beya.asante")] }))
      },
    }
    const { organizationSet, page, dispose } = createRoot((dispose) => {
      const [organizationId, organizationSet] = createSignal("organization-a")
      const page = directoryAdminUsersPageStateCreate({
        adapter,
        confirm: () => false,
        invitationOrigin: "https://auth.example",
        organizationId,
        realmAdministrator: () => false,
        realmId: () => "realm-one",
        search: () => "",
      })
      return { dispose, organizationSet, page }
    })
    await flush()
    expect(seenOrgs).toEqual(["organization-a"])
    expect(page.status()).toBe("loading")

    // The operator switches organizations while the first list is still in flight.
    activeOrg = "organization-b"
    organizationSet("organization-b")
    await flush()
    expect(seenOrgs).toEqual(["organization-a", "organization-b"])
    expect(page.status()).toBe("ready")
    expect(page.people().map((entry) => entry.user.userName)).toEqual(["beya.asante"])
    expect(page.previousPageAvailable()).toBe(false)

    // The delayed organization A response arrives last and must not repaint organization B.
    resolveOrgA?.(resultCreate({ items: [{ ...orgEntry("organization-a", "ada.osei") }] }))
    await flush()
    expect(page.status()).toBe("ready")
    expect(page.people().map((entry) => entry.user.userName)).toEqual(["beya.asante"])
    dispose()
  })

  test("switching organizations clears cursors and replaces rows", async () => {
    const perOrg = (organizationId: string) =>
      resultCreate({ items: [orgEntry(organizationId, "ada.osei")], nextPageToken: "cursor-1" })
    let activeOrg = "organization-a"
    const adapter: DirectoryAdminAdapter = {
      ...adapterStubCreate({ list: 0 }),
      organizationUserList: async () => perOrg(activeOrg),
    }
    const { organizationSet, page, dispose } = createRoot((dispose) => {
      const [organizationId, organizationSet] = createSignal("organization-a")
      const page = directoryAdminUsersPageStateCreate({
        adapter,
        confirm: () => false,
        invitationOrigin: "https://auth.example",
        organizationId,
        realmAdministrator: () => false,
        realmId: () => "realm-one",
        search: () => "",
      })
      return { dispose, organizationSet, page }
    })
    await flush()
    expect(page.people()).toHaveLength(1)
    page.pageNext()
    expect(page.previousPageAvailable()).toBe(true)

    activeOrg = "organization-b"
    organizationSet("organization-b")
    await flush()
    expect(page.previousPageAvailable()).toBe(false)
    expect(page.people().map((entry) => entry.user.userName)).toEqual(["ada.osei"])
    dispose()
  })

  test("service account and invitation list failures surface explicit tab states with retry", async () => {
    let recovered = false
    const serviceAccounts: DirectoryAdminAdapter["serviceAccountList"] = async () =>
      recovered
        ? resultCreate({ items: [] })
        : resultErrorCreate("directoryAdminUsersServiceAccountsLoad", "The service accounts could not be loaded.")
    const invitations: DirectoryAdminAdapter["invitationList"] = async () => {
      const denied = resultErrorCodedCreate(
        "directoryAdminUsersInvitationsLoad",
        "You do not manage this organization.",
        "organizations.forbidden",
      )
      denied.statusCode = 403
      return denied
    }
    const { searchSet, page, dispose } = createRoot((dispose) => {
      const [search, searchSet] = createSignal("?tab=service-accounts")
      const page = directoryAdminUsersPageStateCreate({
        adapter: {
          ...adapterStubCreate({ list: 0 }),
          invitationList: invitations,
          serviceAccountList: serviceAccounts,
        },
        confirm: () => false,
        invitationOrigin: "https://auth.example",
        organizationId: () => "organization-one",
        realmAdministrator: () => false,
        realmId: () => "realm-one",
        search,
      })
      return { dispose, page, searchSet }
    })
    await flush()
    expect(page.status()).toBe("error")
    expect(page.error()).toBe("The service accounts could not be loaded.")

    searchSet("?tab=invitations")
    await flush()
    expect(page.status()).toBe("permission-denied")
    expect(page.error()).toBe("You do not manage this organization.")
    expect(page.invitations()).toHaveLength(0)

    // Retry after the outage recovers: the tab shows the empty state instead of the error.
    searchSet("?tab=service-accounts")
    await flush()
    expect(page.status()).toBe("error")
    recovered = true
    page.reload()
    await flush()
    expect(page.status()).toBe("empty")
    expect(page.error()).toBeUndefined()
    dispose()
  })
})
