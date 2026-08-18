import type { Result } from "#result"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { MfaChallengeCompleteRequest } from "../public/mfaChallengeCompleteRequestSchema.js"
import type { MfaLoginResponse } from "../public/mfaLoginResponseSchema.js"
import { mfaChallengeComplete } from "./mfaChallengeComplete.js"

type MfaStepUpCompleteOptions = {
  readonly actorId?: string | null
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly input: MfaChallengeCompleteRequest
  readonly realmId: string
  readonly runtime?: { now: () => number; randomBytes: (length: number) => Uint8Array }
  readonly sessionToken: string
  readonly correlationId?: string
}

export function mfaStepUpComplete(options: MfaStepUpCompleteOptions): Result<MfaLoginResponse> {
  return mfaChallengeComplete({
    actorId: options.actorId,
    correlationId: options.correlationId,
    database: options.database,
    encryptionSecret: options.encryptionSecret,
    input: options.input,
    realmId: options.realmId,
    runtime: options.runtime,
    sessionToken: options.sessionToken,
  })
}
