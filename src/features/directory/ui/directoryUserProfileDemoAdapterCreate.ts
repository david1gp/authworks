import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { adminDemoUserAuthenticationMethodsFixture } from "../../admin/ui/adminDemoUserAuthenticationMethodsFixture.js"
import { adminDemoUserFixtures } from "../../admin/ui/adminDemoUserFixtures.js"
import { adminDemoUserSessionsFixture } from "../../admin/ui/adminDemoUserSessionsFixture.js"
import { demoAdminMemberships } from "../../demo/demoAdminMemberships.js"
import { demoAdminOrganizations } from "../../demo/demoAdminOrganizations.js"
import { demoAdminProjectRoles } from "../../demo/demoAdminProjectRoles.js"
import { demoAdminProjects } from "../../demo/demoAdminProjects.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoRealmId } from "../../demo/demoRealmId.js"
import { demoResourceIdGenerate } from "../../demo/demoResourceIdGenerate.js"
import type { OrganizationMembership } from "../../organizations/public/organizationMembershipSchema.js"
import type { ProjectListItem } from "../../projects/public/projectListItemSchema.js"
import type { ProjectRole } from "../../projects/public/projectRoleSchema.js"
import type { ProjectUserAssignment } from "../../projects/public/projectUserAssignmentSchema.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import type { User } from "../../users/public/userSchema.js"
import type { UserState } from "../../users/public/userStateSchema.js"
import type { DirectoryUserAccess } from "../public/directoryUserAccessSchema.js"
import type { DirectoryUserProfile, DirectoryUserProfileAdapter } from "./directoryUserProfileAdapter.js"

const neverResolves = <T>(): Promise<Result<T>> => new Promise<Result<T>>(() => undefined)

const activeOrganizationId = "01900000-0000-7000-8000-000000000011"
const demoNow = 1_755_782_400_000

const demoUsers: User[] = adminDemoUserFixtures.map((user, index) => {
  if (index === 0)
    return {
      ...user,
      emailVerifiedAt: undefined,
      lastSignInAt: demoNow - 5 * 60_000,
      profile: { ...user.profile, firstName: "Ada", lastName: "Osei", nickName: "ada" },
      state: user.state,
    }
  if (index === 1)
    return {
      ...user,
      lastSignInAt: undefined,
      profile: { ...user.profile, firstName: "Bruno", lastName: "Feld" },
      state: "active" as UserState,
      verificationState: "verified" as const,
    }
  return { ...user, lastSignInAt: demoNow - 3_600_000, state: "active" as UserState }
})

type DemoAssignment = {
  assignmentId: string
  projectId: string
  roleKeys: string[]
  userId: string
}

const demoAssignments: DemoAssignment[] = [
  {
    assignmentId: "01900000-0000-7000-8000-000000000151",
    projectId: demoAdminProjects[0]?.id ?? "",
    roleKeys: ["admin", "reader"],
    userId: demoUsers[0]?.id ?? "",
  },
  {
    assignmentId: "01900000-0000-7000-8000-000000000152",
    projectId: demoAdminProjects[1]?.id ?? "",
    roleKeys: ["support"],
    userId: demoUsers[0]?.id ?? "",
  },
  {
    assignmentId: "01900000-0000-7000-8000-000000000153",
    projectId: demoAdminProjects[0]?.id ?? "",
    roleKeys: ["reader"],
    userId: demoUsers[1]?.id ?? "",
  },
]

const demoMemberships: OrganizationMembership[] = [
  ...demoAdminMemberships.map((membership, index) => ({
    ...membership,
    roles: [...membership.roles] as OrganizationMembership["roles"],
    userId: demoUsers[index]?.id ?? membership.userId,
  })),
  {
    createdAt: demoNow - 86_400_000,
    id: "01900000-0000-7000-8000-000000000064",
    organizationId: "01900000-0000-7000-8000-000000000012",
    realmId: demoRealmId,
    roles: ["member"],
    updatedAt: demoNow - 86_400_000,
    userId: demoUsers[0]?.id ?? "",
  },
]

const demoSessions: Session[] = adminDemoUserSessionsFixture.map((session) => ({
  ...session,
  device: { ...session.device },
}))

const extraProject: ProjectListItem = {
  applicationCount: 1,
  authorizationRequired: false,
  createdAt: 1_754_918_400_000,
  id: "01900000-0000-7000-8000-000000000033",
  name: "Northwind API",
  organizationId: activeOrganizationId,
  projectAccessRequired: true,
  realmId: demoRealmId,
  roleCount: 2,
  status: "active",
  updatedAt: demoNow,
}

const demoProjects: ProjectListItem[] = [
  ...demoAdminProjects
    .filter((project) => project.organizationId === activeOrganizationId)
    .map((project) => ({
      applicationCount: 1,
      authorizationRequired: project.authorizationRequired,
      createdAt: project.createdAt,
      id: project.id,
      name: project.name,
      organizationId: project.organizationId,
      projectAccessRequired: project.projectAccessRequired,
      realmId: project.realmId,
      roleCount: demoAdminProjectRoles.filter((role) => role.projectId === project.id).length,
      status: project.status,
      updatedAt: project.updatedAt,
    })),
  extraProject,
]

const demoRoles: ProjectRole[] = [
  ...demoAdminProjectRoles.filter((role) => role.projectId === demoAdminProjects[0]?.id),
  {
    createdAt: 1_754_918_400_000,
    displayName: "Editor",
    group: "Operations",
    id: "01900000-0000-7000-8000-000000000044",
    key: "editor",
    projectId: extraProject.id,
    realmId: demoRealmId,
    updatedAt: demoNow,
  },
  {
    createdAt: 1_754_918_400_000,
    displayName: "Viewer",
    id: "01900000-0000-7000-8000-000000000045",
    key: "viewer",
    projectId: extraProject.id,
    realmId: demoRealmId,
    updatedAt: demoNow,
  },
]

const demoRealmAdministrators = new Set<string>([demoUsers[1]?.id ?? ""])
const demoTotpRemoved = new Set<string>()
const demoRecoveryInvalidated = new Set<string>()
const demoPasskeysRevoked = new Set<string>()

/**
 * Fixture-backed adapter. It performs no network access and derives every success, empty,
 * loading, error, and denied response from the URL-selected fixture state so the user
 * profile destination is deterministic. The `?as=` actor gates writes: admins never manage
 * owners, owners never touch realm administrators, and only realm administrators set
 * passwords or manage realm administrator status.
 */
export function directoryUserProfileDemoAdapterCreate(
  fixtureState: () => DemoFixtureState,
  demoAccess: () => "owner" | "admin" | "realm-admin",
): DirectoryUserProfileAdapter {
  const gate = <T>(op: string, value: () => Result<T>): Promise<Result<T>> => {
    const state = fixtureState()
    if (state === "loading") return neverResolves<T>()
    if (state === "permission-denied") {
      const denied = resultErrorCodedCreate(op, "You do not have permission to view this user.", "directory.forbidden")
      denied.statusCode = 403
      return Promise.resolve(denied as unknown as Result<T>)
    }
    if (state === "error" || state === "expired")
      return Promise.resolve(
        resultErrorCodedCreate(op, "The deterministic user fixture failed.", "directory.read-failed"),
      )
    return Promise.resolve(value())
  }
  const forbidden = <T>(op: string): Result<T> => {
    const denied = resultErrorCodedCreate(op, "You do not manage this user.", "organizations.forbidden")
    denied.statusCode = 403
    return denied as unknown as Result<T>
  }
  const targetOwner = (userId: string): boolean =>
    demoMemberships.some((membership) => membership.userId === userId && membership.roles.includes("owner"))
  const mayManage = (userId: string): boolean => {
    if (demoRealmAdministrators.has(userId)) return demoAccess() === "realm-admin"
    if (demoAccess() === "realm-admin") return true
    if (demoAccess() === "owner") return true
    return !targetOwner(userId)
  }
  const accessOf = (userId: string): DirectoryUserAccess => ({
    memberships: demoMemberships
      .filter((membership) => membership.userId === userId)
      .map((membership) => ({
        createdAt: membership.createdAt,
        membershipId: membership.id,
        organizationId: membership.organizationId,
        organizationName:
          demoAdminOrganizations.find((organization) => organization.id === membership.organizationId)?.name ??
          membership.organizationId,
        roles: [...membership.roles],
      })),
    projectAssignments: demoAssignments
      .filter((assignment) => assignment.userId === userId)
      .map((assignment) => {
        const project = demoProjects.find((item) => item.id === assignment.projectId)
        return {
          assignmentId: assignment.assignmentId,
          projectId: assignment.projectId,
          projectName: project?.name ?? assignment.projectId,
          projectOrganizationId: project?.organizationId ?? activeOrganizationId,
          roleKeys: [...assignment.roleKeys],
          roles: assignment.roleKeys.map((key) => ({
            displayName: demoRoles.find((role) => role.key === key)?.displayName ?? key,
            key,
          })),
        }
      }),
    realmAdministrator: demoRealmAdministrators.has(userId),
  })
  const profileOf = (userId: string): Result<DirectoryUserProfile> => {
    const user = demoUsers.find((item) => item.id === userId)
    if (user === undefined)
      return resultErrorCodedCreate("directoryUserProfileDemoUserGet", "The user was not found.", "users.not-found")
    return resultCreate({ access: accessOf(userId), entry: undefined, user: { ...user, profile: { ...user.profile } } })
  }

  return {
    assignmentCreate: (projectId, input) =>
      gate("directoryUserProfileDemoAssignmentCreate", () => {
        if (demoAccess() !== "realm-admin" && !mayManage(input.userId))
          return forbidden("directoryUserProfileDemoAssignmentCreate")
        const assignment: ProjectUserAssignment = {
          createdAt: demoNow,
          id: demoResourceIdGenerate(),
          projectId,
          realmId: demoRealmId,
          roleKeys: input.roleKeys === undefined ? [] : [...input.roleKeys],
          updatedAt: demoNow,
          userId: input.userId,
        }
        demoAssignments.push({
          assignmentId: assignment.id,
          projectId,
          roleKeys: [...assignment.roleKeys],
          userId: assignment.userId,
        })
        return resultCreate(assignment)
      }),
    assignmentRemove: (projectId, assignmentId) =>
      gate("directoryUserProfileDemoAssignmentRemove", () => {
        const assignment = demoAssignments.find((item) => item.assignmentId === assignmentId)
        if (assignment === undefined || assignment.projectId !== projectId)
          return resultErrorCodedCreate(
            "directoryUserProfileDemoAssignmentRemove",
            "The assignment was not found.",
            "projects.not-found",
          )
        if (!mayManage(assignment.userId)) return forbidden("directoryUserProfileDemoAssignmentRemove")
        const index = demoAssignments.indexOf(assignment)
        demoAssignments.splice(index, 1)
        return resultCreate({ removed: true as const })
      }),
    assignmentUpdate: (projectId, assignmentId, input) =>
      gate("directoryUserProfileDemoAssignmentUpdate", () => {
        const assignment = demoAssignments.find((item) => item.assignmentId === assignmentId)
        if (assignment === undefined || assignment.projectId !== projectId)
          return resultErrorCodedCreate(
            "directoryUserProfileDemoAssignmentUpdate",
            "The assignment was not found.",
            "projects.not-found",
          )
        if (!mayManage(assignment.userId)) return forbidden("directoryUserProfileDemoAssignmentUpdate")
        if (input.roleKeys !== undefined) assignment.roleKeys = [...input.roleKeys]
        return resultCreate({
          createdAt: demoNow - 86_400_000,
          id: assignment.assignmentId,
          projectId: assignment.projectId,
          realmId: demoRealmId,
          roleKeys: [...assignment.roleKeys],
          updatedAt: demoNow,
          userId: assignment.userId,
        })
      }),
    authenticationMethodsGet: (userId) =>
      gate("directoryUserProfileDemoAuthenticationMethodsGet", () => {
        if (fixtureState() === "empty")
          return resultCreate({
            emailOtp: { available: false },
            passkeys: { credentials: [] },
            password: { available: false },
            recoveryCodes: { available: false, generatedAt: null, remaining: 0 },
            totp: { enrolled: false, enrollments: [] },
          })
        const fixture = adminDemoUserAuthenticationMethodsFixture
        return resultCreate({
          ...fixture,
          passkeys: {
            credentials: fixture.passkeys.credentials.filter(
              (credential) => !demoPasskeysRevoked.has(`${userId}:${credential.id}`),
            ),
          },
          recoveryCodes: demoRecoveryInvalidated.has(userId)
            ? { available: false, generatedAt: fixture.recoveryCodes.generatedAt, remaining: 0 }
            : fixture.recoveryCodes,
          totp: demoTotpRemoved.has(userId) ? { enrolled: false, enrollments: [] } : fixture.totp,
        })
      }),
    emailList: (userId) =>
      gate("directoryUserProfileDemoEmailList", () => {
        const user = demoUsers.find((item) => item.id === userId)
        if (user === undefined)
          return resultErrorCodedCreate(
            "directoryUserProfileDemoEmailList",
            "The user was not found.",
            "users.not-found",
          )
        return resultCreate({
          items: [
            {
              createdAt: user.createdAt,
              email: user.email,
              id: `${user.id}-email`,
              isPrimary: true,
              updatedAt: user.updatedAt,
              verified: user.emailVerifiedAt !== null && user.emailVerifiedAt !== undefined,
              ...(user.emailVerifiedAt === undefined || user.emailVerifiedAt === null
                ? { verifiedAt: null }
                : { verifiedAt: user.emailVerifiedAt }),
              version: 1,
            },
          ],
        })
      }),
    membershipCreate: (organizationId, input) =>
      gate("directoryUserProfileDemoMembershipCreate", () => {
        if (!mayManage(input.userId)) return forbidden("directoryUserProfileDemoMembershipCreate")
        if (input.roles.includes("owner") && demoAccess() === "admin")
          return resultErrorCodedCreate(
            "directoryUserProfileDemoMembershipCreate",
            "The membership request is invalid.",
            "organizations.invalid",
          )
        const membership: OrganizationMembership = {
          createdAt: demoNow,
          id: demoResourceIdGenerate(),
          organizationId,
          realmId: demoRealmId,
          roles: [...input.roles],
          updatedAt: demoNow,
          userId: input.userId,
        }
        demoMemberships.push(membership)
        return resultCreate(membership)
      }),
    membershipUpdate: (organizationId, membershipId, input) =>
      gate("directoryUserProfileDemoMembershipUpdate", () => {
        const membership = demoMemberships.find(
          (item) => item.id === membershipId && item.organizationId === organizationId,
        )
        if (membership === undefined)
          return resultErrorCodedCreate(
            "directoryUserProfileDemoMembershipUpdate",
            "The membership was not found.",
            "organizations.not-found",
          )
        if (!mayManage(membership.userId)) return forbidden("directoryUserProfileDemoMembershipUpdate")
        if (input.roles.includes("owner") && demoAccess() === "admin")
          return resultErrorCodedCreate(
            "directoryUserProfileDemoMembershipUpdate",
            "The last owner cannot be removed.",
            "organizations.must-retain",
          )
        const owners = demoMemberships.filter(
          (item) => item.organizationId === organizationId && item.roles.includes("owner") && item.id !== membership.id,
        )
        if (membership.roles.includes("owner") && !input.roles.includes("owner") && owners.length === 0)
          return resultErrorCodedCreate(
            "directoryUserProfileDemoMembershipUpdate",
            "The last owner cannot be removed.",
            "organizations.must-retain",
          )
        membership.roles = [...input.roles]
        membership.updatedAt = demoNow
        return resultCreate({ ...membership, roles: [...membership.roles] })
      }),
    passkeyRevoke: (userId, credentialId) =>
      gate("directoryUserProfileDemoPasskeyRevoke", () => {
        if (!mayManage(userId)) return forbidden("directoryUserProfileDemoPasskeyRevoke")
        demoPasskeysRevoked.add(`${userId}:${credentialId}`)
        return resultCreate(undefined)
      }),
    passwordSet: (userId, password) =>
      gate("directoryUserProfileDemoPasswordSet", () => {
        if (demoAccess() !== "realm-admin") return forbidden("directoryUserProfileDemoPasswordSet")
        if (password.trim().length < 8)
          return resultErrorCodedCreate(
            "directoryUserProfileDemoPasswordSet",
            "The password is too short.",
            "passwords.invalid",
          )
        void userId
        return resultCreate({ changed: true })
      }),
    projectList: () =>
      gate("directoryUserProfileDemoProjectList", () =>
        resultCreate(fixtureState() === "empty" ? [] : [...demoProjects]),
      ),
    projectRoleList: (projectId) =>
      gate("directoryUserProfileDemoProjectRoleList", () =>
        resultCreate(fixtureState() === "empty" ? [] : demoRoles.filter((role) => role.projectId === projectId)),
      ),
    realmAdministratorGrant: (userId) =>
      gate("directoryUserProfileDemoRealmAdministratorGrant", () => {
        if (demoAccess() !== "realm-admin") return forbidden("directoryUserProfileDemoRealmAdministratorGrant")
        demoRealmAdministrators.add(userId)
        return resultCreate(undefined)
      }),
    realmAdministratorRevoke: (userId) =>
      gate("directoryUserProfileDemoRealmAdministratorRevoke", () => {
        if (demoAccess() !== "realm-admin") return forbidden("directoryUserProfileDemoRealmAdministratorRevoke")
        if (demoRealmAdministrators.size <= 1 && demoRealmAdministrators.has(userId))
          return resultErrorCodedCreate(
            "directoryUserProfileDemoRealmAdministratorRevoke",
            "The last administrator cannot be removed.",
            "realms.administrator-last",
          )
        demoRealmAdministrators.delete(userId)
        return resultCreate(undefined)
      }),
    recoveryCodesInvalidate: (userId) =>
      gate("directoryUserProfileDemoRecoveryCodesInvalidate", () => {
        if (!mayManage(userId)) return forbidden("directoryUserProfileDemoRecoveryCodesInvalidate")
        demoRecoveryInvalidated.add(userId)
        return resultCreate(undefined)
      }),
    resendVerification: (userId, emailId) =>
      gate("directoryUserProfileDemoResendVerification", () => {
        if (!mayManage(userId)) return forbidden("directoryUserProfileDemoResendVerification")
        if (emailId.length === 0)
          return resultErrorCodedCreate(
            "directoryUserProfileDemoResendVerification",
            "The email address was not found.",
            "users.not-found",
          )
        return resultCreate({
          accepted: true as const,
          challengeId: demoResourceIdGenerate(),
          expiresAt: demoNow + 600_000,
          retryAt: demoNow + 60_000,
        })
      }),
    sessionRevoke: (userId, sessionId) =>
      gate("directoryUserProfileDemoSessionRevoke", () => {
        if (!mayManage(userId)) return forbidden("directoryUserProfileDemoSessionRevoke")
        const index = demoSessions.findIndex((session) => session.id === sessionId)
        if (index >= 0) demoSessions.splice(index, 1)
        return resultCreate(undefined)
      }),
    sessionRevokeAll: (userId) =>
      gate("directoryUserProfileDemoSessionRevokeAll", () => {
        if (!mayManage(userId)) return forbidden("directoryUserProfileDemoSessionRevokeAll")
        for (let index = demoSessions.length - 1; index >= 0; index -= 1) demoSessions.splice(index, 1)
        return resultCreate(undefined)
      }),
    sessionsList: (userId) =>
      gate("directoryUserProfileDemoSessionsList", () => {
        void userId
        return resultCreate(fixtureState() === "empty" ? [] : [...demoSessions])
      }),
    userAccessGet: (userId) =>
      gate("directoryUserProfileDemoUserAccessGet", () => profileOf(userId)).then((result) => {
        if (!result.success) return result
        return resultCreate(result.data.access ?? accessOf(userId))
      }),
    totpRemove: (userId) =>
      gate("directoryUserProfileDemoTotpRemove", () => {
        if (!mayManage(userId)) return forbidden("directoryUserProfileDemoTotpRemove")
        demoTotpRemoved.add(userId)
        return resultCreate(undefined)
      }),
    userDelete: (userId) =>
      gate("directoryUserProfileDemoUserDelete", () => {
        if (!mayManage(userId)) return forbidden("directoryUserProfileDemoUserDelete")
        return resultCreate(undefined)
      }),
    userGet: (userId) => gate("directoryUserProfileDemoUserGet", () => profileOf(userId)),
    userLifecycleSet: (userId, input) =>
      gate("directoryUserProfileDemoUserLifecycleSet", () => {
        if (!mayManage(userId)) return forbidden("directoryUserProfileDemoUserLifecycleSet")
        const index = demoUsers.findIndex((user) => user.id === userId)
        if (index < 0)
          return resultErrorCodedCreate(
            "directoryUserProfileDemoUserLifecycleSet",
            "The user was not found.",
            "users.not-found",
          )
        demoUsers[index] = { ...demoUsers[index]!, state: input.state, updatedAt: demoNow }
        return profileOf(userId)
      }),
    userProfileUpdate: (userId, input) =>
      gate("directoryUserProfileDemoUserProfileUpdate", () => {
        if (!mayManage(userId)) return forbidden("directoryUserProfileDemoUserProfileUpdate")
        const index = demoUsers.findIndex((user) => user.id === userId)
        if (index < 0)
          return resultErrorCodedCreate(
            "directoryUserProfileDemoUserProfileUpdate",
            "The user was not found.",
            "users.not-found",
          )
        const current = demoUsers[index]!
        demoUsers[index] = {
          ...current,
          profile: {
            ...current.profile,
            displayName: input.displayName ?? current.profile.displayName,
            firstName: input.firstName ?? current.profile.firstName,
            lastName: input.lastName ?? current.profile.lastName,
            nickName: input.nickName ?? current.profile.nickName,
            preferredLanguage: input.preferredLanguage ?? current.profile.preferredLanguage,
          },
          updatedAt: demoNow,
        }
        return profileOf(userId)
      }),
    userPurge: (userId) =>
      gate("directoryUserProfileDemoUserPurge", () => {
        if (demoAccess() !== "realm-admin") return forbidden("directoryUserProfileDemoUserPurge")
        void userId
        return resultCreate(undefined)
      }),
    verificationSet: (userId, input) =>
      gate("directoryUserProfileDemoVerificationSet", () => {
        if (demoAccess() !== "realm-admin") return forbidden("directoryUserProfileDemoVerificationSet")
        const index = demoUsers.findIndex((user) => user.id === userId)
        if (index < 0)
          return resultErrorCodedCreate(
            "directoryUserProfileDemoVerificationSet",
            "The user was not found.",
            "users.not-found",
          )
        const verified = input.state === "verified"
        demoUsers[index] = {
          ...demoUsers[index]!,
          ...(verified ? { emailVerifiedAt: demoNow } : { emailVerifiedAt: undefined }),
          updatedAt: demoNow,
          verificationState: verified ? "verified" : "unverified",
        }
        return profileOf(userId)
      }),
  }
}
