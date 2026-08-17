import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationActorContextCreate } from "../../authorization/domain/authorizationActorContextCreate.js"
import { machineCredentialPublicViewCreate } from "../domain/machineCredentialPublicViewCreate.js"
import { machineSecretHashVerify } from "../domain/machineSecretHashVerify.js"
import { machineScopesParse } from "../domain/machineScopesParse.js"
import { machineUserPublicViewCreate } from "../domain/machineUserPublicViewCreate.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"
import type { MachineCredentialAuthentication } from "../domain/machineCredentialAuthentication.js"

type MachineCredentialAuthenticateOptions = {
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly requiredScope?: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
}

export function machineCredentialAuthenticate(
  options: MachineCredentialAuthenticateOptions,
): Result<MachineCredentialAuthentication> {
  const op = "machineCredentialAuthenticate"
  if (options.instanceId.length === 0 || options.token.length === 0)
    return resultErrorCreate(op, "Machine authorization is required.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "Machine authorization is invalid.")
  const repository = machineRepositoryCreate(options.database.db)
  const credentials = repository.credentialListForInstance(options.instanceId)
  if (!credentials.success) return credentials
  const tokenHashCandidates = []
  for (const credential of credentials.data) {
    if (
      credential.kind !== "api_key" &&
      credential.kind !== "personal_access_token" &&
      credential.kind !== "access_token"
    )
      continue
    const verified = machineSecretHashVerify(options.token, credential.secretHash)
    if (!verified.success) return verified
    if (!verified.data) continue
    tokenHashCandidates.push(credential)
  }
  const credential = tokenHashCandidates.find(
    (candidate) => candidate.revokedAt === null && (candidate.expiresAt === null || candidate.expiresAt > now),
  )
  if (credential === undefined) return resultErrorCreate(op, "Machine authorization is invalid.")
  const machineUser = repository.userGet(options.instanceId, credential.machineUserId)
  if (!machineUser.success) return machineUser
  if (machineUser.data === null || machineUser.data.status !== "active")
    return resultErrorCreate(op, "Machine authorization is invalid.")
  const scopes = machineScopesParse(credential.scopes)
  if (!scopes.success) return scopes
  if (options.requiredScope !== undefined && !scopes.data.includes(options.requiredScope))
    return resultErrorCreate(op, "The machine credential is not authorized for this permission.")
  const authenticationMethod =
    credential.kind === "api_key"
      ? "api_key"
      : credential.kind === "personal_access_token"
        ? "personal_access_token"
        : "oidc_access_token"
  const actor = authorizationActorContextCreate({
    actorId: machineUser.data.id,
    assurance: "authenticated",
    authenticationMethod,
    instanceId: options.instanceId,
    kind: "machine",
    scopes: scopes.data,
  })
  return resultCreate({
    actor,
    credential: machineCredentialPublicViewCreate(credential, scopes.data),
    machineUser: machineUserPublicViewCreate(machineUser.data, scopes.data),
    scopes: scopes.data,
  })
}
