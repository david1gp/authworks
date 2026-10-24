import type { Result } from "#result"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { EventListResponse } from "../../events/public/eventListResponseSchema.js"
import type { RealmResponse } from "../../realms/public/realmResponseSchema.js"
import type { RealmUpdateRequest } from "../../realms/public/realmUpdateRequestSchema.js"
import type { SessionListResponse } from "../../sessions/public/sessionListResponseSchema.js"
import type { SessionSubjectType } from "../../sessions/public/sessionSubjectTypeSchema.js"

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
  readonly sessionList: (query?: ListQuery) => Promise<Result<SessionListResponse>>
  readonly eventList: (query?: ListQuery) => Promise<Result<EventListResponse>>
  readonly realmGet: () => Promise<Result<RealmResponse>>
  readonly realmUpdate: (input: RealmUpdateRequest) => Promise<Result<RealmResponse>>
}
