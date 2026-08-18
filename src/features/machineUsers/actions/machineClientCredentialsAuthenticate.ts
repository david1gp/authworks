import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { machineSecretHashVerify } from "../domain/machineSecretHashVerify.js"
import { machineScopesParse } from "../domain/machineScopesParse.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"
import type { MachineClientCredentialsAuthentication } from "../domain/machineClientCredentialsAuthentication.js"
import {
  machineClientCredentialsRequestSchema,
  type MachineClientCredentialsRequest,
} from "../public/machineClientCredentialsRequestSchema.js"
import * as v from "valibot"

type MachineClientCredentialsAuthenticateOptions = {
  readonly database: StorageDatabase
  readonly input: MachineClientCredentialsRequest
  readonly realmId: string
}

export function machineClientCredentialsAuthenticate(
  options: MachineClientCredentialsAuthenticateOptions,
): Result<MachineClientCredentialsAuthentication> {
  const parsed = v.safeParse(machineClientCredentialsRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCreate(
      "machineClientCredentialsInvalidClient",
      "Client authentication failed.",
      "machine-users.invalid-client",
    )
  const repository = machineRepositoryCreate(options.database.db)
  const machineUser = repository.userGetByName(options.realmId, parsed.output.clientId.trim().toLowerCase())
  if (!machineUser.success) return machineUser
  if (machineUser.data === null || machineUser.data.status !== "active")
    return resultErrorCreate(
      "machineClientCredentialsInvalidClient",
      "Client authentication failed.",
      "machine-users.invalid-client",
    )
  const configuredScopes = machineScopesParse(machineUser.data.scopes)
  if (!configuredScopes.success) return configuredScopes
  const credentials = repository.credentialList(options.realmId, machineUser.data.id)
  if (!credentials.success) return credentials
  const clientCredential = credentials.data.find(
    (credential) => credential.kind === "client_secret" && credential.revokedAt === null,
  )
  if (clientCredential === undefined)
    return resultErrorCreate(
      "machineClientCredentialsInvalidClient",
      "Client authentication failed.",
      "machine-users.invalid-client",
    )
  const verified = machineSecretHashVerify(parsed.output.clientSecret, clientCredential.secretHash)
  if (!verified.success) return verified
  if (!verified.data)
    return resultErrorCreate(
      "machineClientCredentialsInvalidClient",
      "Client authentication failed.",
      "machine-users.invalid-client",
    )
  const scopes = parsed.output.scope ?? configuredScopes.data
  if (scopes.some((scope) => !configuredScopes.data.includes(scope)))
    return resultErrorCreate(
      "machineClientCredentialsInvalidScope",
      "The requested machine scopes are invalid.",
      "machine-users.invalid-scope",
    )
  return resultCreate({
    clientId: machineUser.data.userName,
    machineUserId: machineUser.data.id,
    scopes: [...new Set(scopes)],
  })
}
