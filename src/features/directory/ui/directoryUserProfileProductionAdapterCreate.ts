import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { mfaApiClientCreate } from "../../mfa/client/mfaApiClientCreate.js"
import { organizationApiClientCreate } from "../../organizations/client/organizationApiClientCreate.js"
import { passkeyApiClientCreate } from "../../passkeys/client/passkeyApiClientCreate.js"
import { passwordApiClientCreate } from "../../passwords/client/passwordApiClientCreate.js"
import { projectApiClientCreate } from "../../projects/client/projectApiClientCreate.js"
import { realmApiClientCreate } from "../../realms/client/realmApiClientCreate.js"
import { sessionApiClientCreate } from "../../sessions/client/sessionApiClientCreate.js"
import { sessionCsrfTokenGet } from "../../sessions/client/sessionCsrfTokenGet.js"
import { sessionBrowserModeHeaderName } from "../../sessions/public/sessionBrowserModeHeaderName.js"
import { userApiClientCreate } from "../../users/client/userApiClientCreate.js"
import { directoryApiClientCreate } from "../client/directoryApiClientCreate.js"
import type { DirectoryUserProfile, DirectoryUserProfileAdapter } from "./directoryUserProfileAdapter.js"

type DirectoryUserProfileFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

const pageSize = 100

/**
 * Production adapter. Every call is realm-scoped and cookie-authenticated, so tenant
 * boundaries and permissions are enforced by the server, not the view. Writes carry a
 * fresh realm-scoped CSRF token; reads reuse the session cookie.
 */
export function directoryUserProfileProductionAdapterCreate(options: {
  readonly baseUrl: string
  readonly fetch?: DirectoryUserProfileFetch
  readonly organizationId: () => string
  readonly realmId: () => string
}): DirectoryUserProfileAdapter {
  const browserFetch: DirectoryUserProfileFetch = (input, init) =>
    (options.fetch ?? fetch)(input, { ...init, credentials: "include" })
  const realm = () => options.realmId()
  const organization = () => options.organizationId()
  const readClients = () => ({
    directory: directoryApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
    organizations: organizationApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
    passwords: passwordApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
    projects: projectApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
    realms: realmApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
    sessions: sessionApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
    users: userApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
  })
  /**
   * Cookie-authenticated fetch for the MFA and passkey client surfaces. Those clients send
   * bearer tokens by default and never attach the session cookie or CSRF header themselves,
   * so the adapter binds the fresh realm-scoped token exactly like `sessionBrowserRequest`
   * does for the users tenant surface.
   */
  const adminFactorFetch =
    (csrfToken: string): DirectoryUserProfileFetch =>
    (input, init) => {
      const headers = new Headers(init?.headers)
      headers.set("x-csrf-token", csrfToken)
      headers.set(sessionBrowserModeHeaderName, "true")
      return browserFetch(input, { ...init, credentials: "include", headers })
    }
  const factorClients = (csrfToken: string) => ({
    mfa: mfaApiClientCreate({ baseUrl: options.baseUrl, fetch: adminFactorFetch(csrfToken) }),
    passkeys: passkeyApiClientCreate({ baseUrl: options.baseUrl, fetch: adminFactorFetch(csrfToken) }),
  })
  const mutate = async <T>(
    operation: (
      clients: ReturnType<typeof readClients>,
      factors: ReturnType<typeof factorClients>,
    ) => Promise<Result<T>>,
    op: string,
  ): Promise<Result<T>> => {
    const csrf = await sessionCsrfTokenGet({ baseUrl: options.baseUrl, fetch: options.fetch, realmId: realm() })
    if (!csrf.success) return csrf
    // Users, directory, organization, project, and password writes bind the fresh token;
    // the realm and session clients sign their own CSRF exchange through
    // `sessionBrowserRequest` and the ambient session cookie. MFA and passkey writes bind
    // the same token through the cookie-authenticated factor fetch.
    return operation(
      {
        directory: directoryApiClientCreate({ baseUrl: options.baseUrl, csrfToken: csrf.data, fetch: browserFetch }),
        organizations: organizationApiClientCreate({
          baseUrl: options.baseUrl,
          csrfToken: csrf.data,
          fetch: browserFetch,
        }),
        passwords: passwordApiClientCreate({ baseUrl: options.baseUrl, csrfToken: csrf.data, fetch: browserFetch }),
        projects: projectApiClientCreate({ baseUrl: options.baseUrl, csrfToken: csrf.data, fetch: browserFetch }),
        realms: realmApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
        sessions: sessionApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
        users: userApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
      },
      factorClients(csrf.data),
    )
  }
  return {
    assignmentCreate: (projectId, input) =>
      mutate(async (clients) => {
        const result = await clients.projects.projectTenantUserAssignmentCreate(realm(), projectId, input)
        if (!result.success) return result
        return resultCreate(result.data.assignment)
      }, "directoryUserProfileProductionAssignmentCreate"),
    assignmentRemove: (projectId, assignmentId) =>
      mutate(async (clients) => {
        const result = await clients.projects.projectTenantUserAssignmentRemove(realm(), projectId, assignmentId)
        if (!result.success) return result
        return resultCreate({ removed: true as const })
      }, "directoryUserProfileProductionAssignmentRemove"),
    assignmentUpdate: (projectId, assignmentId, input) =>
      mutate(async (clients) => {
        const result = await clients.projects.projectTenantUserAssignmentUpdate(realm(), projectId, assignmentId, input)
        if (!result.success) return result
        return resultCreate(result.data.assignment)
      }, "directoryUserProfileProductionAssignmentUpdate"),
    authenticationMethodsGet: (userId) => readClients().users.userTenantAuthenticationMethodsGet(realm(), userId),
    emailList: (userId) => readClients().users.userTenantEmailAddressList(realm(), userId),
    membershipCreate: (organizationId, input) =>
      mutate(async (clients) => {
        const result = await clients.organizations.organizationTenantMembershipCreate(realm(), organizationId, input)
        if (!result.success) return result
        return resultCreate(result.data.membership)
      }, "directoryUserProfileProductionMembershipCreate"),
    membershipUpdate: (organizationId, membershipId, input) =>
      mutate(async (clients) => {
        const result = await clients.organizations.organizationTenantMembershipUpdate(
          realm(),
          organizationId,
          membershipId,
          input,
        )
        if (!result.success) return result
        return resultCreate(result.data.membership)
      }, "directoryUserProfileProductionMembershipUpdate"),
    passkeyRevoke: (userId, credentialId) =>
      mutate(async (_clients, factors) => {
        const result = await factors.passkeys.passkeyCredentialAdministratorRevoke(realm(), userId, credentialId)
        if (!result.success) return result
        return resultCreate(undefined)
      }, "directoryUserProfileProductionPasskeyRevoke"),
    passwordSet: (userId, password) =>
      mutate(async (clients) => {
        const result = await clients.passwords.passwordUserTenantSet(realm(), userId, { password })
        if (!result.success) return result
        return resultCreate({ changed: result.data.changed })
      }, "directoryUserProfileProductionPasswordSet"),
    projectList: async () => {
      const result = await readClients().projects.projectTenantList(realm(), {
        organizationId: organization(),
        pageSize,
      })
      if (!result.success) return result
      return resultCreate(result.data.items)
    },
    projectRoleList: async (projectId) => {
      const result = await readClients().projects.projectTenantRoleList(realm(), projectId, { pageSize })
      if (!result.success) return result
      return resultCreate(result.data.items)
    },
    realmAdministratorGrant: (userId) =>
      mutate(async (clients) => {
        const result = await clients.realms.realmTenantAdministratorGrant(realm(), { userId })
        if (!result.success) return result
        return resultCreate(undefined)
      }, "directoryUserProfileProductionRealmAdministratorGrant"),
    realmAdministratorRevoke: (userId) =>
      mutate(async (clients) => {
        const result = await clients.realms.realmTenantAdministratorRevoke(realm(), userId)
        if (!result.success) return result
        return resultCreate(undefined)
      }, "directoryUserProfileProductionRealmAdministratorRevoke"),
    recoveryCodesInvalidate: (userId) =>
      mutate(async (_clients, factors) => {
        const result = await factors.mfa.mfaRecoveryCodesAdministratorInvalidate(realm(), userId)
        if (!result.success) return result
        return resultCreate(undefined)
      }, "directoryUserProfileProductionRecoveryCodesInvalidate"),
    resendVerification: (userId, emailId) =>
      mutate(async (clients) => {
        const result = await clients.users.userTenantEmailVerificationResend(realm(), userId, emailId)
        if (!result.success) return result
        return resultCreate(result.data)
      }, "directoryUserProfileProductionResendVerification"),
    sessionRevoke: (userId, sessionId) =>
      mutate(async (clients) => {
        void clients
        const result = await readClients().sessions.sessionUserRevoke(realm(), userId, sessionId)
        if (!result.success) return result as unknown as Result<void>
        return resultCreate(undefined)
      }, "directoryUserProfileProductionSessionRevoke"),
    sessionRevokeAll: (userId) =>
      mutate(async () => {
        const listed = await readClients().sessions.sessionUserList(realm(), userId, { pageSize })
        if (!listed.success) return listed as unknown as Result<void>
        for (const session of listed.data.items) {
          if (session.revokedAt !== null) continue
          const revoked = await readClients().sessions.sessionUserRevoke(realm(), userId, session.id)
          if (!revoked.success) return revoked as unknown as Result<void>
        }
        return resultCreate(undefined)
      }, "directoryUserProfileProductionSessionRevokeAll"),
    sessionsList: async (userId) => {
      const result = await readClients().sessions.sessionUserList(realm(), userId, { pageSize })
      if (!result.success) return result
      return resultCreate(result.data.items)
    },
    totpRemove: (userId) =>
      mutate(async (_clients, factors) => {
        const result = await factors.mfa.mfaTotpAdministratorRemove(realm(), userId)
        if (!result.success) return result
        return resultCreate(undefined)
      }, "directoryUserProfileProductionTotpRemove"),
    userAccessGet: (userId) => readClients().directory.directoryUserAccess(realm(), userId),
    userDelete: (userId) =>
      mutate(async (clients) => {
        const result = await clients.users.userTenantDelete(realm(), userId)
        if (!result.success) return result
        return resultCreate(undefined)
      }, "directoryUserProfileProductionUserDelete"),
    userGet: async (userId) => {
      const [userResult, accessResult] = await Promise.all([
        readClients().users.userTenantGet(realm(), userId),
        readClients().directory.directoryUserAccess(realm(), userId),
      ])
      if (!userResult.success) return userResult as unknown as Result<DirectoryUserProfile>
      return resultCreate({
        access: accessResult.success ? accessResult.data : undefined,
        entry: undefined,
        user: userResult.data.user,
      })
    },
    userLifecycleSet: (userId, input) =>
      mutate(async (clients) => {
        const result = await clients.users.userTenantLifecycleSet(realm(), userId, input)
        if (!result.success) return result as unknown as Result<DirectoryUserProfile>
        const access = await readClients().directory.directoryUserAccess(realm(), userId)
        return resultCreate({
          access: access.success ? access.data : undefined,
          entry: undefined,
          user: result.data.user,
        })
      }, "directoryUserProfileProductionUserLifecycleSet"),
    userProfileUpdate: (userId, input) =>
      mutate(async (clients) => {
        const result = await clients.users.userTenantProfileUpdate(realm(), userId, input)
        if (!result.success) return result as unknown as Result<DirectoryUserProfile>
        const access = await readClients().directory.directoryUserAccess(realm(), userId)
        return resultCreate({
          access: access.success ? access.data : undefined,
          entry: undefined,
          user: result.data.user,
        })
      }, "directoryUserProfileProductionUserProfileUpdate"),
    userPurge: (userId) =>
      mutate(async (clients) => {
        const result = await clients.users.userTenantPurge(realm(), userId)
        if (!result.success) return result
        return resultCreate(undefined)
      }, "directoryUserProfileProductionUserPurge"),
    verificationSet: (userId, input) =>
      mutate(async (clients) => {
        const result = await clients.users.userTenantVerificationSet(realm(), userId, input)
        if (!result.success) return result as unknown as Result<DirectoryUserProfile>
        const access = await readClients().directory.directoryUserAccess(realm(), userId)
        return resultCreate({
          access: access.success ? access.data : undefined,
          entry: undefined,
          user: result.data.user,
        })
      }, "directoryUserProfileProductionVerificationSet"),
  }
}

export type { ListQuery }
