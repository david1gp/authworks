import * as v from "valibot"
import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import type { SessionDeviceMetadata } from "../../sessions/public/sessionDeviceMetadataSchema.js"
import { userEmailNormalize } from "../../users/domain/userEmailNormalize.js"
import { userNameNormalize } from "../../users/domain/userNameNormalize.js"
import { userCreatedEventPayloadSchema } from "../../users/events/userCreatedEventPayloadSchema.js"
import { userEventTypes } from "../../users/events/userEventTypes.js"
import { userProfileTable } from "../../users/persistence/userProfileTable.js"
import { userTable } from "../../users/persistence/userTable.js"
import { externalIdentityEventPayloadSchema } from "../events/externalIdentityEventPayloadSchema.js"
import { externalIdentityEventTypes } from "../events/externalIdentityEventTypes.js"
import { externalIdentityOpaqueSecretCreate } from "../domain/externalIdentityOpaqueSecretCreate.js"
import type { ExternalIdentityProviderIdentity } from "../domain/externalIdentityProviderIdentity.js"
import type { ExternalIdentityProviderPorts } from "../domain/externalIdentityProviderPort.js"
import { externalIdentitySecretHashCreate } from "../domain/externalIdentitySecretHashCreate.js"
import { externalIdentityViewCreate } from "../domain/externalIdentityViewCreate.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import type { ExternalIdentityOAuthTransactionRow } from "../persistence/externalIdentityOAuthTransactionTable.js"
import type { ExternalIdentityProviderRow } from "../persistence/externalIdentityProviderTable.js"
import type { ExternalIdentityCallbackResponse } from "../public/externalIdentityCallbackResponseSchema.js"
import { mfaPrimaryAuthenticationComplete } from "../../mfa/actions/mfaPrimaryAuthenticationComplete.js"
import { organizationLoginPolicyEnforce } from "../../organizations/actions/organizationLoginPolicyEnforce.js"

const externalIdentityTransactionExpiryMessage = "The external identity callback is invalid."

type ExternalIdentityCallbackOptions = {
  readonly code: string
  readonly database: StorageDatabase
  readonly deviceMetadata?: SessionDeviceMetadata
  readonly realmId: string
  readonly providerId: string
  readonly providerPorts: ExternalIdentityProviderPorts
  readonly state: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export async function externalIdentityCallback(
  options: ExternalIdentityCallbackOptions,
): Promise<Result<ExternalIdentityCallbackResponse>> {
  const op = "externalIdentityCallback"
  if (
    options.code.length === 0 ||
    options.code.length > 4096 ||
    options.state.length < 20 ||
    options.state.length > 4096
  )
    return resultErrorCreate(op, externalIdentityTransactionExpiryMessage, "external-identities.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, externalIdentityTransactionExpiryMessage, "external-identities.invalid")
  const repository = externalIdentityRepositoryCreate(options.database.db)
  const transaction = repository.externalIdentityOAuthTransactionGetByState(
    options.realmId,
    externalIdentitySecretHashCreate(options.state),
  )
  if (!transaction.success) return transaction
  if (
    transaction.data === null ||
    transaction.data.providerId !== options.providerId ||
    transaction.data.consumedAt !== null ||
    transaction.data.expiresAt <= now ||
    (transaction.data.intent === "link" && transaction.data.callbackValidatedAt !== null)
  )
    return resultErrorCreate(op, externalIdentityTransactionExpiryMessage, "external-identities.invalid")
  const transactionRow = transaction.data
  const provider = repository.externalIdentityProviderGet(options.realmId, options.providerId)
  if (!provider.success) return provider
  if (provider.data === null || !provider.data.enabled || provider.data.redirectUri !== transactionRow.redirectUri)
    return resultErrorCreate(op, externalIdentityTransactionExpiryMessage, "external-identities.invalid")
  const providerRow = provider.data
  const port = options.providerPorts[providerRow.type as keyof ExternalIdentityProviderPorts]
  if (port === undefined)
    return resultErrorCreate(op, externalIdentityTransactionExpiryMessage, "external-identities.invalid")
  const identity = await port.callbackExchange(
    {
      clientId: providerRow.clientId,
      clientSecret: providerRow.clientSecret,
      redirectUri: transactionRow.redirectUri,
      scopes: externalIdentityScopesParse(providerRow.scopes),
      type: providerRow.type as keyof ExternalIdentityProviderPorts,
    },
    {
      code: options.code,
      ...(transactionRow.nonce === null ? {} : { nonce: transactionRow.nonce }),
      pkceVerifier: transactionRow.pkceVerifier,
    },
  )
  if (!identity.success)
    return resultErrorCreate(op, externalIdentityTransactionExpiryMessage, "external-identities.invalid")
  if (!externalIdentityClaimsValidate(identity.data, providerRow.type, transactionRow.nonceHash))
    return resultErrorCreate(op, externalIdentityTransactionExpiryMessage, "external-identities.invalid")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  if (transactionRow.intent === "link") {
    const confirmationToken = externalIdentityOpaqueSecretCreate(runtime)
    const committed = storageTransactionRun(options.database, (executor) =>
      externalIdentityLinkCallbackCommit({
        correlationId,
        database: executor,
        identity: identity.data,
        now,
        providerId: options.providerId,
        providerType: providerRow.type,
        runtime,
        token: confirmationToken,
        transaction: transactionRow,
      }),
    )
    if (!committed.success) return committed
    return resultCreate({ confirmationToken, expiresAt: transactionRow.expiresAt, kind: "link_confirmation" })
  }
  const policy = organizationLoginPolicyEnforce({
    database: options.database,
    realmId: options.realmId,
    method: "external_identity",
    organizationId: transactionRow.organizationId ?? undefined,
    providerId: options.providerId,
  })
  if (!policy.success)
    return resultErrorCreate(op, externalIdentityTransactionExpiryMessage, "external-identities.invalid")
  const committed = storageTransactionRun(options.database, (executor) =>
    externalIdentitySignInCommit({
      correlationId,
      database: executor,
      deviceMetadata: options.deviceMetadata,
      identity: identity.data,
      realmId: options.realmId,
      now,
      provider: providerRow,
      runtime,
      transaction: transactionRow,
    }),
  )
  if (!committed.success) return committed
  return resultCreate(committed.data)
}

type ExternalIdentityLinkCallbackCommitOptions = {
  readonly correlationId: string
  readonly database: Parameters<typeof externalIdentityRepositoryCreate>[0]
  readonly identity: ExternalIdentityProviderIdentity
  readonly now: number
  readonly providerId: string
  readonly providerType: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
  readonly transaction: ExternalIdentityOAuthTransactionRow
}

function externalIdentityLinkCallbackCommit(
  options: ExternalIdentityLinkCallbackCommitOptions & { readonly transaction: ExternalIdentityOAuthTransactionRow },
): Result<void> {
  const repository = externalIdentityRepositoryCreate(options.database)
  const updated = repository.externalIdentityOAuthTransactionValidateAndStore(
    options.transaction.id,
    options.transaction.version,
    {
      callbackValidatedAt: options.now,
      confirmationTokenHash: externalIdentitySecretHashCreate(options.token),
      externalDisplayName: options.identity.displayName ?? null,
      externalEmail: options.identity.email ?? null,
      externalEmailVerified: options.identity.emailVerified,
      externalIssuer: options.identity.issuer ?? null,
      externalSubject: options.identity.externalSubject,
      externalUsername: options.identity.username ?? null,
    },
  )
  if (!updated.success) return updated
  if (updated.data === null)
    return resultErrorCreate(
      "externalIdentityCallback",
      externalIdentityTransactionExpiryMessage,
      "external-identities.invalid",
    )
  const payload = v.safeParse(externalIdentityEventPayloadSchema, {
    action: "authentication_succeeded",
    externalSubject: options.identity.externalSubject,
    providerId: options.providerId,
    providerType: options.providerType,
    userId: options.transaction.userId ?? undefined,
  })
  if (!payload.success)
    return resultErrorCreate(
      "externalIdentityCallback",
      "The external identity event payload is invalid.",
      "external-identities.event-invalid",
    )
  const event = storageEventAppend(
    options.database,
    {
      actorId: options.transaction.userId,
      aggregateId: options.transaction.id,
      aggregateType: "external_identity_oauth",
      aggregateVersion: 2,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: externalIdentityEventTypes.authenticationSucceeded,
      realmId: options.transaction.realmId,
      metadata: { auditSafe: true, source: "external_identities" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultCreate(undefined)
}

type ExternalIdentitySignInCommitOptions = {
  readonly correlationId: string
  readonly database: Parameters<typeof externalIdentityRepositoryCreate>[0]
  readonly deviceMetadata?: SessionDeviceMetadata
  readonly identity: ExternalIdentityProviderIdentity
  readonly realmId: string
  readonly now: number
  readonly provider: ExternalIdentityProviderRow
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly transaction: ExternalIdentityOAuthTransactionRow
}

function externalIdentitySignInCommit(
  options: ExternalIdentitySignInCommitOptions,
): Result<ExternalIdentityCallbackResponse> {
  const op = "externalIdentityCallback"
  const repository = externalIdentityRepositoryCreate(options.database)
  const existing = repository.externalIdentityGetByProviderSubject(
    options.provider.id,
    options.identity.externalSubject,
  )
  if (!existing.success) return existing
  let userId: string
  let identityRow = existing.data
  if (identityRow !== null) {
    if (identityRow.realmId !== options.realmId)
      return resultErrorCreate(op, externalIdentityTransactionExpiryMessage, "external-identities.invalid")
    const user = options.database
      .select({ id: userTable.id, state: userTable.state, deletedAt: userTable.deletedAt })
      .from(userTable)
      .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, identityRow.userId)))
      .get()
    if (user === undefined || user.state !== "active" || user.deletedAt !== null)
      return resultErrorCreate(
        op,
        "The external identity could not authenticate this account.",
        "external-identities.unauthorized",
      )
    userId = user.id
  } else {
    if (!options.provider.allowAccountCreation)
      return resultErrorCreate(
        op,
        "External account creation is disabled for this provider.",
        "external-identities.conflict",
      )
    const email =
      options.identity.email === undefined
        ? resultErrorCreate(
            "externalIdentityCallback",
            "The external identity did not provide a verified email address.",
            "external-identities.invalid",
          )
        : userEmailNormalize(options.identity.email)
    if (!email.success || !options.identity.emailVerified)
      return resultErrorCreate(
        op,
        "The external identity did not provide a verified email address.",
        "external-identities.invalid",
      )
    const existingEmail = options.database
      .select({ id: userTable.id })
      .from(userTable)
      .where(and(eq(userTable.realmId, options.realmId), eq(userTable.email, email.data)))
      .get()
    if (existingEmail !== undefined)
      return resultErrorCreate(
        op,
        "An account already exists for this email. Sign in and link this provider.",
        "external-identities.already-exists",
      )
    userId = uuidv7Create(options.runtime)
    const userName = externalIdentityUserNameCreate(options.database, options.realmId, options.identity, email.data)
    if (!userName.success) return userName
    const user = options.database
      .insert(userTable)
      .values({
        createdAt: options.now,
        deletedAt: null,
        email: email.data,
        emailVerifiedAt: options.now,
        id: userId,
        realmId: options.realmId,
        state: "active",
        updatedAt: options.now,
        userName: userName.data,
        version: 1,
      })
      .returning()
      .get()
    if (user === undefined)
      return resultErrorCreate(op, "The external account could not be created.", "external-identities.write-failed")
    const profile = options.database
      .insert(userProfileTable)
      .values({
        displayName: options.identity.displayName ?? null,
        firstName: null,
        gender: null,
        realmId: options.realmId,
        lastName: null,
        nickName: null,
        preferredLanguage: null,
        updatedAt: options.now,
        userId,
      })
      .returning()
      .get()
    if (profile === undefined)
      return resultErrorCreate(op, "The external account could not be created.", "external-identities.write-failed")
    const userPayload = v.safeParse(userCreatedEventPayloadSchema, { emailVerified: true, state: "active" })
    if (!userPayload.success)
      return resultErrorCreate(op, "The user event payload is invalid.", "external-identities.event-invalid")
    const userEvent = storageEventAppend(
      options.database,
      {
        actorId: null,
        aggregateId: userId,
        aggregateType: "user",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId: options.correlationId,
        eventType: userEventTypes.created,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "external_identities" },
        occurredAt: options.now,
        payload: userPayload.output,
      },
      options.runtime,
    )
    if (!userEvent.success) return userEvent
  }
  const consumed = repository.externalIdentityOAuthTransactionConsume(
    options.transaction.id,
    options.transaction.version,
    options.now,
  )
  if (!consumed.success) return consumed
  if (consumed.data === null)
    return resultErrorCreate(op, externalIdentityTransactionExpiryMessage, "external-identities.invalid")
  if (identityRow === null) {
    const created = repository.externalIdentityCreate({
      createdAt: options.now,
      displayName: options.identity.displayName ?? null,
      email: options.identity.email ?? null,
      emailVerified: options.identity.emailVerified,
      externalSubject: options.identity.externalSubject,
      id: uuidv7Create(options.runtime),
      realmId: options.realmId,
      providerId: options.provider.id,
      updatedAt: options.now,
      userId,
      username: options.identity.username ?? null,
      version: 1,
    })
    if (!created.success)
      return resultErrorCreate(op, "The external identity could not be linked.", "external-identities.write-failed")
    identityRow = created.data
    const identityPayload = v.safeParse(externalIdentityEventPayloadSchema, {
      action: "account_created",
      externalSubject: options.identity.externalSubject,
      identityId: identityRow.id,
      providerId: options.provider.id,
      providerType: options.provider.type,
      userId,
    })
    if (!identityPayload.success)
      return resultErrorCreate(
        op,
        "The external identity event payload is invalid.",
        "external-identities.event-invalid",
      )
    const identityEvent = storageEventAppend(
      options.database,
      {
        actorId: null,
        aggregateId: identityRow.id,
        aggregateType: "external_identity",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId: options.correlationId,
        eventType: externalIdentityEventTypes.accountCreated,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "external_identities" },
        occurredAt: options.now,
        payload: identityPayload.output,
      },
      options.runtime,
    )
    if (!identityEvent.success) return identityEvent
  }
  const authPayload = v.safeParse(externalIdentityEventPayloadSchema, {
    action: "authentication_succeeded",
    externalSubject: options.identity.externalSubject,
    identityId: identityRow.id,
    providerId: options.provider.id,
    providerType: options.provider.type,
    userId,
  })
  if (!authPayload.success)
    return resultErrorCreate(op, "The external identity event payload is invalid.", "external-identities.event-invalid")
  const authEvent = storageEventAppend(
    options.database,
    {
      actorId: null,
      aggregateId: options.transaction.id,
      aggregateType: "external_identity_oauth",
      aggregateVersion: options.transaction.version + 1,
      commandIndex: 1,
      correlationId: options.correlationId,
      eventType: externalIdentityEventTypes.authenticationSucceeded,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "external_identities" },
      occurredAt: options.now,
      payload: authPayload.output,
    },
    options.runtime,
  )
  if (!authEvent.success) return authEvent
  const authenticationResult = mfaPrimaryAuthenticationComplete({
    actorId: null,
    deviceMetadata: options.deviceMetadata,
    executor: options.database,
    realmId: options.realmId,
    primaryAuthenticationMethod: "external_identity",
    runtime: options.runtime,
    sessionCreate: () =>
      sessionIssue({
        actorId: null,
        assurance: "authenticated",
        authenticationMethod: "external_identity",
        commandIndex: 2,
        correlationId: options.correlationId,
        deviceMetadata: options.deviceMetadata,
        executor: options.database,
        realmId: options.realmId,
        runtime: options.runtime,
        userId,
      }),
    userId,
  })
  if (!authenticationResult.success)
    return resultErrorCreate(op, "The authenticated session could not be created.", "external-identities.write-failed")
  return resultCreate({
    authentication: { authenticatedAt: options.now, realmId: options.realmId, userId },
    identity: externalIdentityViewCreate(identityRow, options.provider.type),
    kind: "authenticated",
    ...authenticationResult.data,
  })
}

function externalIdentityClaimsValidate(
  identity: ExternalIdentityProviderIdentity,
  providerType: string,
  nonceHash: string | null,
): boolean {
  if (identity.providerType !== providerType || identity.externalSubject.length === 0) return false
  if (nonceHash === null) return identity.nonce === undefined
  return identity.nonce !== undefined && externalIdentitySecretHashCreate(identity.nonce) === nonceHash
}

function externalIdentityScopesParse(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed) && parsed.every((scope) => typeof scope === "string")) return parsed
  } catch (_error) {}
  return []
}

function externalIdentityUserNameCreate(
  database: Parameters<typeof externalIdentityRepositoryCreate>[0],
  realmId: string,
  identity: ExternalIdentityProviderIdentity,
  email: string,
): Result<string> {
  const base = userNameNormalize(identity.username ?? email.split("@", 1)[0] ?? "external-user")
  if (!base.success) return base
  let candidate = base.data.slice(0, 128)
  for (let suffix = 1; suffix <= 1000; suffix += 1) {
    const existing = database
      .select({ id: userTable.id })
      .from(userTable)
      .where(and(eq(userTable.realmId, realmId), eq(userTable.userName, candidate)))
      .get()
    if (existing === undefined) return resultCreate(candidate)
    const ending = `-${suffix}`
    candidate = `${base.data.slice(0, 128 - ending.length)}${ending}`
  }
  return resultErrorCreate(
    "externalIdentityCallback",
    "The external account name could not be allocated.",
    "external-identities.write-failed",
  )
}
