import { describe, expect, mock, test } from "bun:test"

mock.module("solid-js", () => ({
  createEffect: (fn: () => void) => fn(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (_dependencies: unknown, fn: () => void) => fn,
}))

const [{ directoryUserProfilePageStateCreate }, { resultCreate }, { resultErrorCodedCreate }] = await Promise.all([
  import("../../src/features/directory/ui/directoryUserProfilePageStateCreate.js"),
  import("../../src/platform/errors/resultCreate.js"),
  import("../../src/platform/errors/resultErrorCodedCreate.js"),
])

type ProfileUser = {
  email: string
  emailVerified: boolean
  id: string
  profile: { displayName: string }
  state: "active" | "inactive" | "locked" | "suspended" | "deleted" | "initial"
  userName: string
}

function profileUserCreate(overrides: Partial<ProfileUser> = {}): ProfileUser {
  return {
    email: "ada@example.com",
    emailVerified: false,
    id: "01900000-0000-7000-8000-000000000021",
    profile: { displayName: "Ada Osei" },
    state: "active",
    userName: "ada",
    ...overrides,
  }
}

function fullUserCreate(user: ProfileUser) {
  return {
    createdAt: 1_755_782_400_000,
    email: user.email,
    emailVerified: user.emailVerified,
    id: user.id,
    profile: {
      displayName: user.profile.displayName,
      firstName: "Ada",
      lastName: "Osei",
      nickName: "ada",
      preferredLanguage: "en",
    },
    realmId: "01900000-0000-7000-8000-000000000001",
    state: user.state,
    updatedAt: 1_755_782_400_000,
    userName: user.userName,
    verificationState: user.emailVerified ? ("verified" as const) : ("unverified" as const),
  }
}

const emptyMethods = () => ({
  emailOtp: { available: false },
  passkeys: { credentials: [] },
  password: { available: false },
  recoveryCodes: { available: false, generatedAt: null, remaining: 0 },
  totp: { enrolled: false, enrollments: [] },
})

function adapterStubCreate(user: ProfileUser) {
  const calls: { args: unknown[]; name: string }[] = []
  const record = (name: string, args: unknown[] = []) => calls.push({ args, name })
  const profile = () => ({ access: undefined, entry: undefined, user: fullUserCreate(user) })
  let methodsCalls = 0
  return {
    calls,
    methodsCallsGet: () => methodsCalls,
    stub: {
      assignmentCreate: async (...args: unknown[]) => {
        record("assignmentCreate", args)
        return resultErrorCodedCreate("test", "unused", "test.unused")
      },
      assignmentRemove: async (...args: unknown[]) => {
        record("assignmentRemove", args)
        return resultCreate({ removed: true as const })
      },
      assignmentUpdate: async (...args: unknown[]) => {
        record("assignmentUpdate", args)
        return resultErrorCodedCreate("test", "unused", "test.unused")
      },
      authenticationMethodsGet: async (...args: unknown[]) => {
        record("authenticationMethodsGet", args)
        methodsCalls += 1
        return resultCreate(emptyMethods())
      },
      emailList: async (...args: unknown[]) => {
        record("emailList", args)
        return resultCreate({
          items: [
            {
              createdAt: 1,
              email: user.email,
              id: "email-1",
              isPrimary: true,
              updatedAt: 2,
              verified: user.emailVerified,
              verifiedAt: null,
              version: 1,
            },
          ],
        })
      },
      membershipCreate: async (...args: unknown[]) => {
        record("membershipCreate", args)
        return resultErrorCodedCreate("test", "unused", "test.unused")
      },
      membershipUpdate: async (...args: unknown[]) => {
        record("membershipUpdate", args)
        return resultErrorCodedCreate("test", "unused", "test.unused")
      },
      passkeyRevoke: async (...args: unknown[]) => {
        record("passkeyRevoke", args)
        return resultCreate(undefined)
      },
      passwordSet: async (...args: unknown[]) => {
        record("passwordSet", args)
        return resultCreate({ changed: true })
      },
      projectList: async (...args: unknown[]) => {
        record("projectList", args)
        return resultCreate([])
      },
      projectRoleList: async (...args: unknown[]) => {
        record("projectRoleList", args)
        return resultCreate([])
      },
      realmAdministratorGrant: async (...args: unknown[]) => {
        record("realmAdministratorGrant", args)
        return resultCreate(undefined)
      },
      realmAdministratorRevoke: async (...args: unknown[]) => {
        record("realmAdministratorRevoke", args)
        return resultCreate(undefined)
      },
      recoveryCodesInvalidate: async (...args: unknown[]) => {
        record("recoveryCodesInvalidate", args)
        return resultCreate(undefined)
      },
      resendVerification: async (...args: unknown[]) => {
        record("resendVerification", args)
        return resultCreate({ accepted: true as const, challengeId: "challenge-1", expiresAt: 7, retryAt: 8 })
      },
      sessionRevoke: async (...args: unknown[]) => {
        record("sessionRevoke", args)
        return resultCreate(undefined)
      },
      sessionRevokeAll: async (...args: unknown[]) => {
        record("sessionRevokeAll", args)
        return resultCreate(undefined)
      },
      sessionsList: async (...args: unknown[]) => {
        record("sessionsList", args)
        return resultCreate([])
      },
      totpRemove: async (...args: unknown[]) => {
        record("totpRemove", args)
        return resultCreate(undefined)
      },
      userAccessGet: async (...args: unknown[]) => {
        record("userAccessGet", args)
        return resultErrorCodedCreate("test", "unused", "test.unused")
      },
      userDelete: async (...args: unknown[]) => {
        record("userDelete", args)
        return resultCreate(undefined)
      },
      userGet: async (...args: unknown[]) => {
        record("userGet", args)
        return resultCreate(profile())
      },
      userLifecycleSet: async (_userId: string, input: { state: ProfileUser["state"] }) => {
        record("userLifecycleSet", [input])
        user.state = input.state
        return resultCreate(profile())
      },
      userProfileUpdate: async (...args: unknown[]) => {
        record("userProfileUpdate", args)
        return resultCreate(profile())
      },
      userPurge: async (...args: unknown[]) => {
        record("userPurge", args)
        return resultCreate(undefined)
      },
      verificationSet: async (_userId: string, input: { state: "verified" | "unverified" }) => {
        record("verificationSet", [input])
        user.emailVerified = input.state === "verified"
        return resultCreate(profile())
      },
    },
  }
}

const tick = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function stateCreate(user: ProfileUser, confirmResult = true) {
  const confirmed: { message: string; title?: string }[] = []
  const { stub, calls, methodsCallsGet } = adapterStubCreate(user)
  const state = directoryUserProfilePageStateCreate(stub as never, {
    actorOrganizationRoles: () => ["owner"],
    actorRealmAdministrator: () => true,
    confirm: async (request) => {
      confirmed.push({ message: request.message })
      return confirmResult
    },
    organizationId: () => "01900000-0000-7000-8000-000000000011",
    realmId: () => "01900000-0000-7000-8000-000000000001",
    userId: () => user.id,
  })
  return { calls, confirmed, methodsCallsGet, state }
}

describe("user profile lifecycle and purge state", () => {
  test("suspends an active user through the lifecycle adapter with a confirm", async () => {
    const user = profileUserCreate({ state: "active" })
    const { calls, confirmed, state } = stateCreate(user)
    await tick()
    await state.lifecycleSet("suspended")
    expect(calls.filter((call) => call.name === "userLifecycleSet")).toEqual([
      { args: [{ state: "suspended" }], name: "userLifecycleSet" },
    ])
    expect(confirmed[0]?.message).toContain("ada")
    expect(state.profileGet()?.user?.state).toBe("suspended")
    expect(state.noticeGet()).toContain("ada")
  })

  test("keeps reactivate for a suspended user", async () => {
    const user = profileUserCreate({ state: "suspended" })
    const { calls, state } = stateCreate(user)
    await tick()
    await state.lifecycleSet("active")
    expect(
      calls.some((call) => call.name === "userLifecycleSet" && (call.args[0] as { state: string }).state === "active"),
    ).toBe(true)
    expect(state.profileGet()?.user?.state).toBe("active")
    expect(state.noticeGet()).toContain("ada")
  })

  test("purge gates on the typed user name before calling the adapter", async () => {
    const user = profileUserCreate({ state: "deleted" })
    const { calls, state } = stateCreate(user)
    await tick()
    state.purgeConfirmSet("someone-else")
    expect(await state.purgeSubmit()).toBe(false)
    expect(state.formErrorGet()).not.toBeUndefined()
    expect(calls.some((call) => call.name === "userPurge")).toBe(false)
    state.purgeConfirmSet("ada")
    expect(await state.purgeSubmit()).toBe(true)
    expect(calls.filter((call) => call.name === "userPurge")).toHaveLength(1)
    expect(state.noticeGet()).toContain("ada")
  })
})

describe("user profile authentication reset state", () => {
  test("totp removal calls the adapter and refetches methods", async () => {
    const user = profileUserCreate()
    const { calls, confirmed, methodsCallsGet, state } = stateCreate(user)
    await tick()
    const before = methodsCallsGet()
    await state.totpRemove()
    expect(calls.some((call) => call.name === "totpRemove")).toBe(true)
    expect(confirmed[0]?.message).toContain("ada")
    expect(methodsCallsGet()).toBeGreaterThan(before)
    expect(state.noticeGet()).not.toBeUndefined()
  })

  test("recovery code invalidation calls the adapter and refetches methods", async () => {
    const user = profileUserCreate()
    const { calls, methodsCallsGet, state } = stateCreate(user)
    await tick()
    const before = methodsCallsGet()
    await state.recoveryCodesInvalidate()
    expect(calls.some((call) => call.name === "recoveryCodesInvalidate")).toBe(true)
    expect(methodsCallsGet()).toBeGreaterThan(before)
    expect(state.noticeGet()).not.toBeUndefined()
  })

  test("passkey revocation addresses the credential and refetches methods", async () => {
    const user = profileUserCreate()
    const { calls, methodsCallsGet, state } = stateCreate(user)
    await tick()
    const before = methodsCallsGet()
    await state.passkeyRevoke("credential-9")
    expect(calls.some((call) => call.name === "passkeyRevoke" && (call.args as string[])[1] === "credential-9")).toBe(
      true,
    )
    expect(methodsCallsGet()).toBeGreaterThan(before)
    expect(state.noticeGet()).not.toBeUndefined()
  })
})

describe("user profile verification state", () => {
  test("resend resolves the primary email and triggers the challenge adapter", async () => {
    const user = profileUserCreate({ emailVerified: false })
    const { calls, confirmed, state } = stateCreate(user)
    await tick()
    await state.verificationResend()
    expect(calls.some((call) => call.name === "emailList")).toBe(true)
    expect(
      calls.some(
        (call) =>
          call.name === "resendVerification" &&
          (call.args as string[])[0] === user.id &&
          (call.args as string[])[1] === "email-1",
      ),
    ).toBe(true)
    expect(confirmed[0]?.message).toContain("ada@example.com")
    expect(state.noticeGet()).toContain("ada@example.com")
  })

  test("verification override sets the state directly and reloads the profile", async () => {
    const user = profileUserCreate({ emailVerified: false })
    const { calls, state } = stateCreate(user)
    await tick()
    await state.verificationOverrideSet("verified")
    expect(calls.some((call) => call.name === "verificationSet")).toBe(true)
    expect(state.profileGet()?.user?.emailVerified).toBe(true)
    expect(state.noticeGet()).toContain("ada@example.com")
  })
})
