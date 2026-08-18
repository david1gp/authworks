import type { Result } from "#result"
import type { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import type { SessionCredentialResponse } from "../../sessions/public/sessionCredentialResponseSchema.js"
import type { SessionDeviceMetadata } from "../../sessions/public/sessionDeviceMetadataSchema.js"
import type { PasswordAuthentication } from "../public/passwordAuthenticationSchema.js"

type PasswordSessionCreateOptions = {
  readonly actorId?: string | null
  readonly commandIndex: number
  readonly correlationId: string
  readonly deviceMetadata?: SessionDeviceMetadata
  readonly executor: StorageExecutor
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

export type PasswordSessionCreate = (
  authentication: PasswordAuthentication,
  options: PasswordSessionCreateOptions,
) => Result<SessionCredentialResponse>
