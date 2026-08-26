import type { Result } from "#result"
import type { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import type { SessionCredentialResponse } from "../../sessions/public/sessionCredentialResponseSchema.js"
import type { SessionDeviceMetadata } from "../../sessions/public/sessionDeviceMetadataSchema.js"
import type { PasswordAuthentication } from "../public/passwordAuthenticationSchema.js"

type PasswordSessionCreateOptions = {
  readonly actorId?: string | null
  readonly commandIndex: number
  readonly correlationId: string
  readonly database?: StorageDatabase
  readonly deviceMetadata?: SessionDeviceMetadata
  readonly executor: StorageTransaction
  readonly organizationId?: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

export type PasswordSessionCreate = (
  authentication: PasswordAuthentication,
  options: PasswordSessionCreateOptions,
) => Result<SessionCredentialResponse>
