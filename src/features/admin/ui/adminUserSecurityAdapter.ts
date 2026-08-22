import type { Result } from "#result"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { SessionListResponse } from "../../sessions/public/sessionListResponseSchema.js"
import type { SessionRevocationResponse } from "../../sessions/public/sessionRevocationResponseSchema.js"
import type { UserAuthenticationMethods } from "../../users/public/userAuthenticationMethodsSchema.js"

/** Browser administration operations for a user's sessions and authentication metadata. */
export type AdminUserSecurityAdapter = {
  readonly userAuthenticationMethodsGet: (userId: string) => Promise<Result<UserAuthenticationMethods>>
  readonly userSessionRevoke: (userId: string, sessionId: string) => Promise<Result<SessionRevocationResponse>>
  readonly userSessionsList: (userId: string, query?: ListQuery) => Promise<Result<SessionListResponse>>
}
