import type { Result } from "#result"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { SessionAuthenticationMethod } from "../../sessions/public/sessionAuthenticationMethodSchema.js"
import type { MfaChallengeResponse } from "../public/mfaChallengeResponseSchema.js"
import { mfaLoginChallengeStart } from "./mfaLoginChallengeStart.js"

type MfaStepUpStartOptions = {
  readonly actorId?: string | null
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: { now: () => number; randomBytes: (length: number) => Uint8Array }
  readonly sessionId: string
  readonly userId: string
  readonly correlationId?: string
  readonly primaryAuthenticationMethod?: SessionAuthenticationMethod
}

export function mfaStepUpStart(options: MfaStepUpStartOptions): Result<MfaChallengeResponse> {
  return mfaLoginChallengeStart({
    actorId: options.actorId,
    correlationId: options.correlationId,
    database: options.database,
    realmId: options.realmId,
    primaryAuthenticationMethod: options.primaryAuthenticationMethod,
    purpose: "step_up",
    runtime: options.runtime,
    sessionId: options.sessionId,
    userId: options.userId,
  })
}
