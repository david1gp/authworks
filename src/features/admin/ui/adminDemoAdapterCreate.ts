import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import type { Event as TenantEvent } from "../../events/public/eventSchema.js"
import type { Realm } from "../../realms/public/realmSchema.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import type { User } from "../../users/public/userSchema.js"
import type { AdminAdapter } from "./adminAdapter.js"
import { adminDemoEventFixtures } from "./adminDemoEventFixtures.js"
import { adminDemoRealmFixtureCreate } from "./adminDemoRealmFixtureCreate.js"
import { adminDemoUserAuthenticationMethodsFixture } from "./adminDemoUserAuthenticationMethodsFixture.js"
import { adminDemoUserFixtures } from "./adminDemoUserFixtures.js"
import { adminDemoUserSessionsFixture } from "./adminDemoUserSessionsFixture.js"
import { adminSessionDemoAdapterCreate } from "./adminSessionDemoAdapterCreate.js"
import type { AdminUserSecurityAdapter } from "./adminUserSecurityAdapter.js"

/**
 * Deterministic in-memory administration adapter. Every response is produced locally so
 * `/demo/admin/**` requires no backend, authentication, or network access.
 */
export function adminDemoAdapterCreate(
  fixtureState: () => DemoFixtureState,
  options: { readonly signedInInitially?: boolean } = {},
): AdminAdapter & AdminUserSecurityAdapter {
  let realm: Realm = adminDemoRealmFixtureCreate()
  let users: User[] = structuredClone(adminDemoUserFixtures) as User[]
  const events: TenantEvent[] = structuredClone(adminDemoEventFixtures) as TenantEvent[]
  let userSessions: Session[] = structuredClone([...adminDemoUserSessionsFixture])
  const pending = <T>() => new Promise<T>(() => undefined)
  const readFailure = (op: string) => {
    if (fixtureState() === "error")
      return resultErrorCodedCreate(
        op,
        "The deterministic administration fixture is unavailable.",
        "realms.read-failed",
      )
    if (fixtureState() === "expired")
      return resultErrorCodedCreate(op, "The administrator session has expired.", "sessions.unauthorized")
    return undefined
  }
  const writeFailure = (op: string) => {
    if (fixtureState() === "permission-denied")
      return resultErrorCodedCreate(op, "You do not have permission to perform this action.", "realms.forbidden")
    return readFailure(op)
  }
  const userFind = (userId: string) => users.find((item) => item.id === userId)
  const userMissing = (op: string) => resultErrorCodedCreate(op, "The user could not be found.", "users.not-found")

  return {
    ...adminSessionDemoAdapterCreate({ fixtureState, signedInInitially: options.signedInInitially }),
    eventList: async () => {
      if (fixtureState() === "loading") return pending()
      const failed = readFailure("adminDemoEventList")
      if (failed !== undefined) return failed
      return resultCreate({ items: fixtureState() === "empty" ? [] : events })
    },
    realmGet: async () => {
      if (fixtureState() === "loading") return pending()
      const failed = readFailure("adminDemoRealmGet")
      if (failed !== undefined) return failed
      return resultCreate({ realm })
    },
    realmUpdate: async (input) => {
      const failed = writeFailure("adminDemoRealmUpdate")
      if (failed !== undefined) return failed
      realm = {
        ...realm,
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.domains === undefined || input.domains.length === 0
          ? {}
          : { domain: input.domains[0] as string, domains: [...input.domains] }),
        updatedAt: realm.updatedAt + 1_000,
      }
      return resultCreate({ realm })
    },
    userCreate: async (input) => {
      const failed = writeFailure("adminDemoUserCreate")
      if (failed !== undefined) return failed
      const template = users[0]
      if (template === undefined) return userMissing("adminDemoUserCreate")
      const created: User = {
        ...template,
        email: input.email,
        id: `01900000-0000-7000-8000-0000000${(users.length + 900).toString().padStart(5, "0")}`,
        profile: { ...template.profile, ...input.profile },
        userName: input.userName,
      }
      users = [...users, created]
      return resultCreate({ user: created })
    },
    userAuthenticationMethodsGet: async () => {
      if (fixtureState() === "loading") return pending()
      const failed = readFailure("adminDemoUserAuthenticationMethodsGet")
      if (failed !== undefined) return failed
      if (fixtureState() === "empty")
        return resultCreate({
          emailOtp: { available: false },
          passkeys: { credentials: [] },
          recoveryCodes: { available: false, generatedAt: null, remaining: 0 },
          totp: { enrolled: false, enrollments: [] },
        })
      return resultCreate(structuredClone(adminDemoUserAuthenticationMethodsFixture))
    },
    userDelete: async (userId) => {
      const failed = writeFailure("adminDemoUserDelete")
      if (failed !== undefined) return failed
      const current = userFind(userId)
      if (current === undefined) return userMissing("adminDemoUserDelete")
      const deleted: User = { ...current, state: "deleted" }
      users = users.map((item) => (item.id === userId ? deleted : item))
      return resultCreate({ user: deleted })
    },
    userGet: async (userId) => {
      if (fixtureState() === "loading") return pending()
      const failed = readFailure("adminDemoUserGet")
      if (failed !== undefined) return failed
      const current = userFind(userId) ?? users[0]
      if (current === undefined) return userMissing("adminDemoUserGet")
      return resultCreate({ user: current })
    },
    userLifecycleSet: async (userId, input) => {
      const failed = writeFailure("adminDemoUserLifecycleSet")
      if (failed !== undefined) return failed
      const current = userFind(userId)
      if (current === undefined) return userMissing("adminDemoUserLifecycleSet")
      const updated: User = { ...current, state: input.state }
      users = users.map((item) => (item.id === userId ? updated : item))
      return resultCreate({ user: updated })
    },
    userList: async () => {
      if (fixtureState() === "loading") return pending()
      const failed = readFailure("adminDemoUserList")
      if (failed !== undefined) return failed
      return resultCreate({ items: fixtureState() === "empty" ? [] : users })
    },
    userProfileUpdate: async (userId, input) => {
      const failed = writeFailure("adminDemoUserProfileUpdate")
      if (failed !== undefined) return failed
      const current = userFind(userId)
      if (current === undefined) return userMissing("adminDemoUserProfileUpdate")
      const updated: User = {
        ...current,
        profile: {
          ...current.profile,
          ...Object.fromEntries(Object.entries(input).filter((entry) => entry[1] !== null)),
        },
      }
      users = users.map((item) => (item.id === userId ? updated : item))
      return resultCreate({ user: updated })
    },
    userSessionRevoke: async (_userId, sessionId) => {
      const failed = writeFailure("adminDemoUserSessionRevoke")
      if (failed !== undefined) return failed
      userSessions = userSessions.filter((session) => session.id !== sessionId)
      return resultCreate({ revoked: true })
    },
    userSessionsList: async () => {
      if (fixtureState() === "loading") return pending()
      const failed = readFailure("adminDemoUserSessionsList")
      if (failed !== undefined) return failed
      return resultCreate({ items: fixtureState() === "empty" ? [] : userSessions })
    },
    userVerificationSet: async (userId, input) => {
      const failed = writeFailure("adminDemoUserVerificationSet")
      if (failed !== undefined) return failed
      const current = userFind(userId)
      if (current === undefined) return userMissing("adminDemoUserVerificationSet")
      const updated: User = { ...current, verificationState: input.state }
      users = users.map((item) => (item.id === userId ? updated : item))
      return resultCreate({ user: updated })
    },
  }
}
