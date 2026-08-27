import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { sessionReturnPathValidate } from "../../sessions/domain/sessionReturnPathValidate.js"
import { oidcHashCreate } from "../domain/oidcHashCreate.js"
import { oidcOpaqueSecretCreate } from "../domain/oidcOpaqueSecretCreate.js"
import { oidcRedirectUriMatches } from "../domain/oidcRedirectUriMatches.js"
import { oidcValueEncrypt } from "../domain/oidcValueEncrypt.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcAuthorizationRequest } from "../public/oidcAuthorizationRequestSchema.js"
import { oidcAuthorizationRequestSchema } from "../public/oidcAuthorizationRequestSchema.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"
import { oidcClientContextValidate } from "../server/oidcClientContextValidate.js"

const oidcAuthorizationInteractionLifetimeMs = 10 * 60 * 1_000

type OidcAuthorizationInteractionCreateOptions = {
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly input: OidcAuthorizationRequest
  readonly publicOrigin: string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

export function oidcAuthorizationInteractionCreate(options: OidcAuthorizationInteractionCreateOptions): Result<{
  readonly binding: string
  readonly expiresAt: number
  readonly handle: string
  readonly resumePath: string
}> {
  const op = "oidcAuthorizationInteractionCreate"
  const parsed = v.safeParse(oidcAuthorizationRequestSchema, options.input)
  if (!parsed.success || options.realmId.length === 0)
    return resultErrorCreate(op, "The OIDC authorization request is invalid.")
  const realm = realmGet({ context: realmSystemContextCreate(), database: options.database, realmId: options.realmId })
  if (!realm.success) return realm
  if (realm.data.realm.status !== "active") return resultErrorCreate(op, "The realm is not active.")
  const repository = oidcRepositoryCreate(options.database.db)
  const client = repository.clientGet(options.realmId, parsed.output.client_id)
  if (!client.success) return client
  if (client.data === null || client.data.status !== "active")
    return resultErrorCreate(op, "The OIDC client was not found.")
  const clientContext = oidcClientContextValidate({
    applicationId: client.data.applicationId,
    executor: options.database.db,
    projectId: client.data.projectId,
    realmId: options.realmId,
  })
  if (!clientContext.success) return resultErrorCreate(op, "The OIDC authorization request is invalid.")
  const redirectUris = oidcStringArrayParse(client.data.redirectUris)
  if (!redirectUris.success) return resultErrorCreate(op, "The OIDC client configuration is invalid.")
  if (!oidcRedirectUriMatches(parsed.output.redirect_uri, redirectUris.data).success)
    return resultErrorCreate(op, "The redirect URI is not registered.")
  const allowedScopes = oidcStringArrayParse(client.data.allowedScopes)
  if (!allowedScopes.success) return resultErrorCreate(op, "The OIDC client configuration is invalid.")
  const scope = oidcAuthorizationScopeParse(parsed.output.scope, allowedScopes.data)
  if (!scope.success) return scope

  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The OIDC authorization timestamp is invalid.", undefined, "oidc.invalid-timestamp")
  const expiresAt = now + oidcAuthorizationInteractionLifetimeMs
  if (!Number.isSafeInteger(expiresAt)) return resultErrorCreate(op, "The OIDC authorization expiry is invalid.")
  const handle = oidcOpaqueSecretCreate(runtime)
  const binding = oidcOpaqueSecretCreate(runtime)
  const encrypted = oidcValueEncrypt(JSON.stringify(parsed.output), options.realmId, options.encryptionSecret)
  if (!encrypted.success) return encrypted
  const resumePath = `/oauth2/authorize?interaction=${encodeURIComponent(handle)}`
  const validatedResumePath = sessionReturnPathValidate(resumePath, options.publicOrigin)
  if (!validatedResumePath.success) return validatedResumePath

  return storageTransactionRun(options.database, (transaction) => {
    const created = oidcRepositoryCreate(transaction).interactionCreate({
      authorizationRequestId: null,
      bindingHash: oidcHashCreate(binding),
      completedAt: null,
      createdAt: now,
      expiresAt,
      handleHash: oidcHashCreate(handle),
      id: uuidv7Create(runtime),
      organizationId: null,
      realmId: options.realmId,
      requestEncrypted: encrypted.data,
      resumePath: validatedResumePath.data,
      sessionId: null,
      userId: null,
    })
    if (!created.success) return created
    return resultCreate({ binding, expiresAt, handle, resumePath: validatedResumePath.data })
  })
}

function oidcAuthorizationScopeParse(scope: string, allowedScopes: readonly string[]): Result<string[]> {
  const values = scope.split(" ")
  if (values.length === 0 || values.some((value) => value.length === 0))
    return resultErrorCreate("oidcAuthorizationScopeParse", "The OIDC scope is invalid.")
  const parsed = v.safeParse(v.array(oidcScopeSchema), values)
  if (!parsed.success || new Set(parsed.output).size !== parsed.output.length)
    return resultErrorCreate("oidcAuthorizationScopeParse", "The OIDC scope is invalid.")
  if (!parsed.output.includes("openid") || parsed.output.some((value) => !allowedScopes.includes(value)))
    return resultErrorCreate("oidcAuthorizationScopeParse", "The requested scope is not allowed.")
  return resultCreate(parsed.output)
}

function oidcStringArrayParse(value: string): Result<string[]> {
  try {
    const parsed = v.safeParse(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))), JSON.parse(value))
    if (!parsed.success) return resultErrorCreate("oidcStringArrayParse", "The OIDC client configuration is invalid.")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate("oidcStringArrayParse", "The OIDC client configuration is invalid.")
  }
}
