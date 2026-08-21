import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmBootstrapAdminAuthenticate } from "../../realms/actions/realmBootstrapAdminAuthenticate.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import type { SessionBootstrapAdminSignInResponse } from "../public/sessionBootstrapAdminSignInResponseSchema.js"
import type { SessionCredentialResponse } from "../public/sessionCredentialResponseSchema.js"
import type { SessionDeviceMetadata } from "../public/sessionDeviceMetadataSchema.js"
import { sessionIssue } from "./sessionIssue.js"

type SessionBootstrapAdminSignInOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly deviceMetadata?: SessionDeviceMetadata
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly secret: string
}

type SessionBootstrapAdminSignInResult = SessionBootstrapAdminSignInResponse & {
  readonly session: SessionCredentialResponse
}

const sessionBootstrapAdminLifetimeMs = 15 * 60 * 1_000

export function sessionBootstrapAdminSignIn(
  options: SessionBootstrapAdminSignInOptions,
): Result<SessionBootstrapAdminSignInResult> {
  const op = "sessionBootstrapAdminSignIn"
  if (options.secret.length === 0)
    return resultErrorCreate(op, "The bootstrap administrator credentials are invalid.", "sessions.unauthorized")
  const authenticated = realmBootstrapAdminAuthenticate({
    context: options.context,
    database: options.database,
    secret: options.secret,
  })
  if (!authenticated.success) return authenticated
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The session timestamp is invalid.", "sessions.invalid-timestamp")
  const expiresAt = now + sessionBootstrapAdminLifetimeMs
  if (!Number.isSafeInteger(expiresAt))
    return resultErrorCreate(op, "The session expiry is invalid.", "sessions.invalid")
  const session = sessionIssue({
    actorId: authenticated.data.actorId,
    assurance: "authenticated",
    authenticationMethod: "bootstrap_admin",
    database: options.database,
    deviceMetadata: options.deviceMetadata,
    expiresAt,
    realmId: authenticated.data.realmId,
    runtime,
    subjectId: authenticated.data.actorId,
    subjectType: "bootstrap_admin",
  })
  if (!session.success) return session
  return resultCreate({
    adminId: authenticated.data.actorId,
    expiresAt,
    realmId: authenticated.data.realmId,
    session: session.data,
    sessionId: session.data.session.id,
  })
}
