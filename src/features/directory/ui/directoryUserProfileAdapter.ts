import type { Result } from "#result"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { OrganizationMembershipCreateRequest } from "../../organizations/public/organizationMembershipCreateRequestSchema.js"
import type { OrganizationMembership } from "../../organizations/public/organizationMembershipSchema.js"
import type { OrganizationMembershipUpdateRequest } from "../../organizations/public/organizationMembershipUpdateRequestSchema.js"
import type { ProjectListItem } from "../../projects/public/projectListItemSchema.js"
import type { ProjectRole } from "../../projects/public/projectRoleSchema.js"
import type { ProjectUserAssignmentCreateRequest } from "../../projects/public/projectUserAssignmentCreateRequestSchema.js"
import type { ProjectUserAssignment } from "../../projects/public/projectUserAssignmentSchema.js"
import type { ProjectUserAssignmentUpdateRequest } from "../../projects/public/projectUserAssignmentUpdateRequestSchema.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import type { UserAuthenticationMethods } from "../../users/public/userAuthenticationMethodsSchema.js"
import type { UserLifecycleRequest } from "../../users/public/userLifecycleRequestSchema.js"
import type { UserProfileUpdateRequest } from "../../users/public/userProfileUpdateRequestSchema.js"
import type { User } from "../../users/public/userSchema.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import type { DirectoryProjectAssignment, DirectoryUserAccess } from "../public/directoryUserAccessSchema.js"

/** One user profile with the access payload the security and roles tabs need. */
export type DirectoryUserProfile = {
  /** Full user record when the admin surface may read it, otherwise the directory projection. */
  readonly access: DirectoryUserAccess | undefined
  readonly entry: DirectoryEntry | undefined
  readonly user: User | undefined
}

export type DirectoryUserProfilePasswordResult = { readonly changed: boolean }

/**
 * The single boundary separating the shared stateless user-profile views from their
 * production (network) and demo (fixture) data sources.
 */
export type DirectoryUserProfileAdapter = {
  readonly assignmentCreate: (
    projectId: string,
    input: ProjectUserAssignmentCreateRequest,
  ) => Promise<Result<ProjectUserAssignment>>
  readonly assignmentRemove: (projectId: string, assignmentId: string) => Promise<Result<{ readonly removed: boolean }>>
  readonly assignmentUpdate: (
    projectId: string,
    assignmentId: string,
    input: ProjectUserAssignmentUpdateRequest,
  ) => Promise<Result<ProjectUserAssignment>>
  readonly authenticationMethodsGet: (userId: string) => Promise<Result<UserAuthenticationMethods>>
  readonly membershipCreate: (
    organizationId: string,
    input: OrganizationMembershipCreateRequest,
  ) => Promise<Result<OrganizationMembership>>
  readonly membershipUpdate: (
    organizationId: string,
    membershipId: string,
    input: OrganizationMembershipUpdateRequest,
  ) => Promise<Result<OrganizationMembership>>
  readonly passwordSet: (userId: string, password: string) => Promise<Result<DirectoryUserProfilePasswordResult>>
  readonly projectList: () => Promise<Result<readonly ProjectListItem[]>>
  readonly projectRoleList: (projectId: string) => Promise<Result<readonly ProjectRole[]>>
  readonly realmAdministratorGrant: (userId: string) => Promise<Result<void>>
  readonly realmAdministratorRevoke: (userId: string) => Promise<Result<void>>
  readonly sessionRevoke: (userId: string, sessionId: string) => Promise<Result<void>>
  readonly sessionRevokeAll: (userId: string) => Promise<Result<void>>
  readonly sessionsList: (userId: string) => Promise<Result<readonly Session[]>>
  readonly userAccessGet: (userId: string) => Promise<Result<DirectoryUserAccess>>
  readonly userDelete: (userId: string) => Promise<Result<void>>
  readonly userGet: (userId: string) => Promise<Result<DirectoryUserProfile>>
  readonly userLifecycleSet: (userId: string, input: UserLifecycleRequest) => Promise<Result<DirectoryUserProfile>>
  readonly userProfileUpdate: (userId: string, input: UserProfileUpdateRequest) => Promise<Result<DirectoryUserProfile>>
}

export type DirectoryUserProfileAssignmentGroup = {
  readonly assignment: DirectoryProjectAssignment
  readonly owned: boolean
  readonly projectId: string
  readonly projectName: string
}

export type { ListQuery }
