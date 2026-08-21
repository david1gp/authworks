import type { Result } from "#result"
import type { SessionAssurance } from "../../sessions/public/sessionAssuranceSchema.js"
import type { User } from "../../users/public/userSchema.js"
import type { ImpersonationStartRequest } from "../public/impersonationStartRequestSchema.js"

/** What the acting administrator is allowed to do, as the guarded start form needs to present it. */
export type ImpersonationAdminEligibility = {
  readonly actorId: string
  readonly actorLabel: string
  readonly assurance: SessionAssurance
  /** True when the acting session is itself impersonated. Nested impersonation is prohibited. */
  readonly nested: boolean
  /** The client-side hint only. The server remains the authority and is checked on every start. */
  readonly permitted: boolean
}

/**
 * An impersonation session as the shared views render it. The issued session credential is
 * deliberately absent: it is never returned to, stored by, or displayed in the browser.
 */
export type ImpersonationAdminSession = {
  readonly actorId: string
  readonly actorLabel: string
  readonly expiresAt: number
  readonly organizationId?: string
  readonly reason?: string
  readonly sessionId: string
  readonly startedAt: number
  readonly subjectId: string
  readonly subjectLabel: string
}

export type ImpersonationAdminOrganizationOption = { readonly id: string; readonly name: string }

/**
 * The single boundary separating the shared stateless impersonation views from their
 * production (network) and demo (fixture) data sources.
 */
export type ImpersonationAdminAdapter = {
  /** The impersonation the acting browser session is currently inside, when any. */
  readonly activeGet: () => Promise<Result<ImpersonationAdminSession | null>>
  readonly eligibilityGet: () => Promise<Result<ImpersonationAdminEligibility>>
  readonly impersonationEnd: (
    sessionId: string,
  ) => Promise<Result<{ readonly ended: boolean; readonly sessionId: string }>>
  readonly impersonationStart: (input: ImpersonationStartRequest) => Promise<Result<ImpersonationAdminSession>>
  readonly organizationList: () => Promise<Result<readonly ImpersonationAdminOrganizationOption[]>>
  readonly userList: () => Promise<Result<readonly User[]>>
}
