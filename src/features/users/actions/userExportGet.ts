import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { externalIdentityList } from "../../externalIdentities/actions/externalIdentityList.js"
import { oidcConsentList } from "../../oidc/actions/oidcConsentList.js"
import { organizationMeList } from "../../organizations/actions/organizationMeList.js"
import type { RealmTenantContext } from "../../realms/server/index.js"
import { sessionMeList } from "../../sessions/actions/sessionMeList.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import type { UserExportResponse } from "../public/userExportResponseSchema.js"
import { userAuthenticationMethodsGet } from "./userAuthenticationMethodsGet.js"
import { userEmailAddressList } from "./userEmailAddressList.js"
import { userGet } from "./userGet.js"

type UserExportGetOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly session: Session
  readonly userId: string
}

/** Assembles the self-service data export from existing read surfaces. Emits metadata only. */
export function userExportGet(options: UserExportGetOptions): Result<UserExportResponse> {
  const op = "userExportGet"
  if (options.context.kind !== "tenant" || options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The user export is not available in this tenant context.", "users.tenant-mismatch")
  if (
    options.context.actor.kind !== "user" ||
    options.context.actor.actorId !== options.userId ||
    options.context.actor.realmId !== options.realmId
  )
    return resultErrorCreate(op, "The user export is only available to the session user.", "users.forbidden")

  const user = userGet({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!user.success) return user
  const emails = userEmailAddressList({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!emails.success) return emails
  const methods = userAuthenticationMethodsGet({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!methods.success) return methods
  const memberships = organizationMeList({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
  })
  if (!memberships.success) return memberships
  const identities = externalIdentityList({
    database: options.database,
    realmId: options.realmId,
    session: options.session,
    userId: options.userId,
  })
  if (!identities.success) return identities
  const sessions = sessionMeList({
    currentSessionId: options.session.id,
    database: options.database,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!sessions.success) return sessions
  const consents = oidcConsentList({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!consents.success) return consents

  return resultCreate({
    consents: consents.data.items.map((consent) => ({
      clientId: consent.clientId,
      createdAt: consent.createdAt,
      scopes: [...consent.scope],
      updatedAt: consent.updatedAt,
    })),
    emails: emails.data.items.map((email) => ({
      address: email.email,
      primary: email.isPrimary,
      verified: email.verified,
    })),
    externalIdentities: identities.data.items.map((identity) => ({
      displayName: identity.displayName ?? null,
      providerId: identity.providerId,
      providerType: identity.providerType,
    })),
    memberships: memberships.data.items.map((item) => ({
      organizationId: item.organization.id,
      organizationName: item.organization.name,
      roles: [...item.membership.roles],
    })),
    mfa: {
      emailOtp: methods.data.emailOtp.available,
      passkeyCount: methods.data.passkeys.credentials.length,
      password: methods.data.password.available,
      recoveryCodesAvailable: methods.data.recoveryCodes.available,
      totpEnrolled: methods.data.totp.enrolled,
    },
    passkeys: methods.data.passkeys.credentials.map((credential) => ({
      createdAt: credential.createdAt,
      lastUsedAt: credential.lastUsedAt,
      nickname: credential.nickname,
    })),
    phone:
      user.data.user.phoneNumber === undefined
        ? null
        : {
            number: user.data.user.phoneNumber,
            verified: user.data.user.phoneNumberVerifiedAt !== undefined,
          },
    profile: user.data.user.profile,
    sessions: sessions.data.items.map((session) => ({
      assurance: session.assurance,
      countryCode: session.device.countryCode ?? null,
      createdAt: session.createdAt,
      current: session.current,
      lastUsedAt: session.lastUsedAt,
      region: session.device.region ?? null,
    })),
    state: user.data.user.state,
    userId: user.data.user.id,
    userName: user.data.user.userName,
  })
}
