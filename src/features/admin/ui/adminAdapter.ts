import type { Result } from "#result"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { EventListResponse } from "../../events/public/eventListResponseSchema.js"
import type { RealmResponse } from "../../realms/public/realmResponseSchema.js"
import type { RealmUpdateRequest } from "../../realms/public/realmUpdateRequestSchema.js"
import type { SessionSubjectType } from "../../sessions/public/sessionSubjectTypeSchema.js"
import type { UserCreateRequest } from "../../users/public/userCreateRequestSchema.js"
import type { UserLifecycleRequest } from "../../users/public/userLifecycleRequestSchema.js"
import type { UserListResponse } from "../../users/public/userListResponseSchema.js"
import type { UserProfileUpdateRequest } from "../../users/public/userProfileUpdateRequestSchema.js"
import type { UserResponse } from "../../users/public/userResponseSchema.js"
import type { UserVerificationRequest } from "../../users/public/userVerificationRequestSchema.js"

/** Administrator session as the shared administration views need to render it. */
export type AdminSession = {
  readonly expiresAt: number
  readonly sessionId: string
  readonly subjectId: string
  readonly subjectType: SessionSubjectType
}

/** The transport-free administration boundary shared by the production and demo adapters. */
export type AdminAdapter = {
  /** Exchanges a bootstrap credential for a short browser session. The secret is never stored. */
  readonly adminSignIn: (secret: string) => Promise<Result<AdminSession>>
  readonly adminSignOut: () => Promise<Result<{ readonly revoked: boolean }>>
  readonly sessionCurrent: () => Promise<Result<AdminSession>>
  readonly eventList: (query?: ListQuery) => Promise<Result<EventListResponse>>
  readonly realmGet: () => Promise<Result<RealmResponse>>
  readonly realmUpdate: (input: RealmUpdateRequest) => Promise<Result<RealmResponse>>
  readonly userCreate: (input: UserCreateRequest) => Promise<Result<UserResponse>>
  readonly userDelete: (userId: string) => Promise<Result<UserResponse>>
  readonly userGet: (userId: string) => Promise<Result<UserResponse>>
  readonly userLifecycleSet: (userId: string, input: UserLifecycleRequest) => Promise<Result<UserResponse>>
  readonly userList: (query?: ListQuery) => Promise<Result<UserListResponse>>
  readonly userProfileUpdate: (userId: string, input: UserProfileUpdateRequest) => Promise<Result<UserResponse>>
  readonly userVerificationSet: (userId: string, input: UserVerificationRequest) => Promise<Result<UserResponse>>
}
