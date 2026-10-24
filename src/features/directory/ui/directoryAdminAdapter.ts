import type { Result } from "#result"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { MachineUserCreateRequest } from "../../machineUsers/public/machineUserCreateRequestSchema.js"
import type { MachineUserListResponse } from "../../machineUsers/public/machineUserListResponseSchema.js"
import type { MachineUser } from "../../machineUsers/public/machineUserSchema.js"
import type { OrganizationInvitationCreateRequest } from "../../organizations/public/organizationInvitationCreateRequestSchema.js"
import type { OrganizationInvitationCreateResponse } from "../../organizations/public/organizationInvitationCreateResponseSchema.js"
import type { OrganizationInvitationListResponse } from "../../organizations/public/organizationInvitationListResponseSchema.js"
import type { UserCreateRequest } from "../../users/public/userCreateRequestSchema.js"
import type { User } from "../../users/public/userSchema.js"
import type { DirectoryOrganizationUserSummary } from "../public/directoryOrganizationUserSummarySchema.js"
import type { DirectoryUserListQuery, DirectoryUserListResponse } from "../public/directoryUserListSchema.js"

/** A newly issued service-account credential, shown exactly once after creation. */
export type DirectoryAdminServiceAccountIssue = {
  readonly clientId: string
  readonly machineUser: MachineUser
  readonly secret: string
}

/**
 * The single boundary separating the shared stateless users views from their
 * production (network) and demo (fixture) data sources.
 */
export type DirectoryAdminAdapter = {
  /** Creates a human user in the current realm (realm administrators only). */
  readonly directoryUserCreate: (input: UserCreateRequest) => Promise<Result<{ readonly user: User }>>
  /** Creates a service account in the active organization, returning its one-time secret. */
  readonly invitationCreate: (
    input: OrganizationInvitationCreateRequest,
  ) => Promise<Result<OrganizationInvitationCreateResponse>>
  readonly invitationList: (query?: ListQuery) => Promise<Result<OrganizationInvitationListResponse>>
  readonly invitationRevoke: (invitationId: string) => Promise<Result<{ readonly revoked: boolean }>>
  readonly organizationUserList: (query?: DirectoryUserListQuery) => Promise<Result<DirectoryUserListResponse>>
  readonly organizationUserSummary: () => Promise<Result<DirectoryOrganizationUserSummary>>
  readonly realmUserList: (query?: DirectoryUserListQuery) => Promise<Result<DirectoryUserListResponse>>
  readonly serviceAccountCreate: (input: MachineUserCreateRequest) => Promise<Result<DirectoryAdminServiceAccountIssue>>
  readonly serviceAccountList: (query?: ListQuery) => Promise<Result<MachineUserListResponse>>
}
