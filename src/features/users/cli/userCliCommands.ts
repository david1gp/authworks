import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { connectionProfileCliCentralFlags } from "../../connectionProfiles/cli/connectionProfileCliCentralFlags.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliSystemTokenResolve } from "../../connectionProfiles/cli/connectionProfileCliSystemTokenResolve.js"
import { userApiClientCreate } from "../client/userApiClientCreate.js"
import type { UserCreateRequest } from "../public/userCreateRequestSchema.js"
import type { UserListQuery } from "../public/userListQuerySchema.js"
import type { UserMetadataListQuery } from "../public/userMetadataListQuerySchema.js"
import type { UserState } from "../public/userStateSchema.js"

type UserCliFlags = {
  readonly profile?: string
  readonly server?: string
  readonly systemToken?: string
  readonly token?: string
}
type UserListCliFlags = UserCliFlags & {
  readonly emailVerified?: boolean
  readonly pageSize?: number
  readonly pageToken?: string
  readonly search?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
  readonly state?: UserState
}

type UserIdCliFlags = UserCliFlags & {
  readonly realmId?: string
  readonly userId: string
}
type UserGetCliFlags = UserIdCliFlags & { readonly ifModifiedSince?: string }

const userCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: UserCliFlags & {
      displayName?: string
      email: string
      firstName?: string
      gender?: string
      lastName?: string
      nickName?: string
      phoneNumber?: string
      preferredLanguage?: string
      realmId?: string
      userName: string
    },
  ) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(this, await userCliClientCreate(connection).userCreate(realmId, userCreateInputCreate(flags)), [
      connection.token,
      connection.systemToken,
    ])
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userName: textFlag("User name"),
      email: textFlag("Email address"),
      phoneNumber: optionalTextFlag("Phone number"),
      displayName: optionalTextFlag("Display name"),
      firstName: optionalTextFlag("First name"),
      lastName: optionalTextFlag("Last name"),
      nickName: optionalTextFlag("Nickname"),
      gender: optionalTextFlag("Gender"),
      preferredLanguage: optionalTextFlag("Preferred language"),
    },
  },
  docs: { brief: "Create a user" },
})

const userListCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserListCliFlags & { realmId?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(this, await userCliClientCreate(connection).userList(realmId, userListQueryCreate(flags)), [
      connection.token,
      connection.systemToken,
    ])
  },
  parameters: { flags: { ...userCommonFlags(), ...userListFlags(), realmId: userRealmIdFlag() } },
  docs: { brief: "List users" },
})

const userGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserGetCliFlags) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userGet(
        realmId,
        flags.userId,
        flags.ifModifiedSince === undefined ? undefined : { ifModifiedSince: flags.ifModifiedSince },
      ),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userId: userIdFlag(),
      ifModifiedSince: ifModifiedSinceFlag(),
    },
  },
  docs: { brief: "Get a user" },
})

const userProfileCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags & { displayName?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userProfileUpdate(realmId, flags.userId, {
        displayName: flags.displayName,
      }),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userId: userIdFlag(),
      displayName: optionalTextFlag("Display name"),
    },
  },
  docs: { brief: "Update a user profile" },
})

const userLifecycleCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: UserIdCliFlags & { state: "active" | "inactive" | "initial" | "locked" | "suspended" },
  ) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userLifecycleSet(realmId, flags.userId, { state: flags.state }),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userId: userIdFlag(),
      state: userStateFlag(),
    },
  },
  docs: { brief: "Change a user lifecycle state" },
})

const userVerifyCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags & { state: "unverified" | "verified" }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userEmailVerificationSet(realmId, flags.userId, {
        state: flags.state,
      }),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userId: userIdFlag(),
      state: userVerificationStateFlag(),
    },
  },
  docs: { brief: "Change a user email verification state" },
})

const userDeleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(this, await userCliClientCreate(connection).userDelete(realmId, flags.userId), [
      connection.token,
      connection.systemToken,
    ])
  },
  parameters: { flags: { ...userCommonFlags(), realmId: userRealmIdFlag(), userId: userIdFlag() } },
  docs: { brief: "Delete a user account" },
})

const userMeCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserCliFlags & { ifModifiedSince?: string; realmId?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userMeGet(
        realmId,
        flags.ifModifiedSince === undefined ? undefined : { ifModifiedSince: flags.ifModifiedSince },
      ),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: { ...userCommonFlags(), realmId: userRealmIdFlag(), ifModifiedSince: ifModifiedSinceFlag() },
  },
  docs: { brief: "Read the current user" },
})

const userMeDeleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserCliFlags & { realmId?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(this, await userCliClientCreate(connection).userMeDelete(realmId), [
      connection.token,
      connection.systemToken,
    ])
  },
  parameters: { flags: { ...userCommonFlags(), realmId: userRealmIdFlag() } },
  docs: { brief: "Delete the current user account" },
})

const userMeProfileCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserCliFlags & { displayName?: string; realmId?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userMeProfileUpdate(realmId, { displayName: flags.displayName }),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: { ...userCommonFlags(), realmId: userRealmIdFlag(), displayName: optionalTextFlag("Display name") },
  },
  docs: { brief: "Update the current user profile" },
})

const userMeAuthMethodsCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserCliFlags & { realmId?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(this, await userCliClientCreate(connection).userMeAuthenticationMethodsGet(realmId), [
      connection.token,
      connection.systemToken,
    ])
  },
  parameters: { flags: { ...userCommonFlags(), realmId: userRealmIdFlag() } },
  docs: { brief: "Read the current user authentication methods" },
})

const userExportMeCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserCliFlags & { realmId?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(this, await userCliClientCreate(connection).userMeExportGet(realmId), [
      connection.token,
      connection.systemToken,
    ])
  },
  parameters: { flags: { ...userCommonFlags(), realmId: userRealmIdFlag() } },
  docs: { brief: "Export the current user data" },
})

const userEmailsListCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserCliFlags & { realmId?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(this, await userCliClientCreate(connection).userMeEmailAddressList(realmId), [
      connection.token,
      connection.systemToken,
    ])
  },
  parameters: { flags: { ...userCommonFlags(), realmId: userRealmIdFlag() } },
  docs: { brief: "List the current user email addresses" },
})

const userEmailsAddStartCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserCliFlags & { email: string; realmId?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userMeEmailAddressAddStart(realmId, { email: flags.email }),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: { ...userCommonFlags(), realmId: userRealmIdFlag(), email: textFlag("Email address") },
  },
  docs: { brief: "Start adding an email address to the current user" },
})

const userEmailsAddResendCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserCliFlags & { challengeId: string; email: string; realmId?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userMeEmailAddressAddResend(realmId, {
        challengeId: flags.challengeId,
        email: flags.email,
      }),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      challengeId: textFlag("Email challenge UUID"),
      email: textFlag("Email address"),
    },
  },
  docs: { brief: "Resend an email address verification code" },
})

const userEmailsAddVerifyCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: UserCliFlags & { challengeId: string; realmId?: string; verificationToken: string },
  ) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userMeEmailAddressAddVerify(realmId, {
        challengeId: flags.challengeId,
        token: flags.verificationToken,
      }),
      [connection.token, connection.systemToken, flags.verificationToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      challengeId: textFlag("Email challenge UUID"),
      verificationToken: textFlag("Verification token"),
    },
  },
  docs: { brief: "Verify an added email address" },
})

const userEmailsPrimarySetCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: UserCliFlags & { emailId: string; expectedVersion?: number; realmId?: string },
  ) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userMeEmailAddressPrimarySet(
        realmId,
        flags.emailId,
        flags.expectedVersion === undefined ? {} : { expectedVersion: flags.expectedVersion },
      ),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      emailId: textFlag("Email address UUID"),
      expectedVersion: optionalNumberFlag("Expected email list version"),
    },
  },
  docs: { brief: "Set the primary email address" },
})

const userEmailsRemoveCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserCliFlags & { emailId: string; realmId?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(this, await userCliClientCreate(connection).userMeEmailAddressRemove(realmId, flags.emailId), [
      connection.token,
      connection.systemToken,
    ])
  },
  parameters: {
    flags: { ...userCommonFlags(), realmId: userRealmIdFlag(), emailId: textFlag("Email address UUID") },
  },
  docs: { brief: "Remove an email address from the current user" },
})

const userEmailChangeStartCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserCliFlags & { email: string; realmId?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userMeEmailChangeStart(realmId, { email: flags.email }),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: { ...userCommonFlags(), realmId: userRealmIdFlag(), email: textFlag("New email address") },
  },
  docs: { brief: "Start changing the current user email address" },
})

const userEmailChangeResendCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserCliFlags & { challengeId: string; email: string; realmId?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userMeEmailChangeResend(realmId, {
        challengeId: flags.challengeId,
        email: flags.email,
      }),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      challengeId: textFlag("Email challenge UUID"),
      email: textFlag("Email address"),
    },
  },
  docs: { brief: "Resend an email change verification code" },
})

const userEmailChangeVerifyCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: UserCliFlags & { challengeId: string; realmId?: string; verificationToken: string },
  ) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userMeEmailChangeVerify(realmId, {
        challengeId: flags.challengeId,
        token: flags.verificationToken,
      }),
      [connection.token, connection.systemToken, flags.verificationToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      challengeId: textFlag("Email challenge UUID"),
      verificationToken: textFlag("Verification token"),
    },
  },
  docs: { brief: "Verify a current user email change" },
})

const userTenantListCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserListCliFlags & { realmId?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userTenantList(realmId, userListQueryCreate(flags)),
      [connection.token, connection.systemToken],
    )
  },
  parameters: { flags: { ...userCommonFlags(), ...userListFlags(), realmId: userRealmIdFlag() } },
  docs: { brief: "List tenant users" },
})

const userTenantGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(this, await userCliClientCreate(connection).userTenantGet(realmId, flags.userId), [
      connection.token,
      connection.systemToken,
    ])
  },
  parameters: { flags: { ...userCommonFlags(), realmId: userRealmIdFlag(), userId: userIdFlag() } },
  docs: { brief: "Get a tenant user" },
})

const userTenantCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: UserCliFlags & {
      displayName?: string
      email: string
      firstName?: string
      gender?: string
      lastName?: string
      nickName?: string
      phoneNumber?: string
      preferredLanguage?: string
      realmId?: string
      userName: string
    },
  ) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userTenantCreate(realmId, userCreateInputCreate(flags)),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userName: textFlag("User name"),
      email: textFlag("Email address"),
      phoneNumber: optionalTextFlag("Phone number"),
      displayName: optionalTextFlag("Display name"),
      firstName: optionalTextFlag("First name"),
      lastName: optionalTextFlag("Last name"),
      nickName: optionalTextFlag("Nickname"),
      gender: optionalTextFlag("Gender"),
      preferredLanguage: optionalTextFlag("Preferred language"),
    },
  },
  docs: { brief: "Create a tenant user" },
})

const userTenantProfileCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags & { displayName?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userTenantProfileUpdate(realmId, flags.userId, {
        displayName: flags.displayName,
      }),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userId: userIdFlag(),
      displayName: optionalTextFlag("Display name"),
    },
  },
  docs: { brief: "Update a tenant user profile" },
})

const userTenantLifecycleCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: UserIdCliFlags & { state: "active" | "inactive" | "initial" | "locked" | "suspended" },
  ) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userTenantLifecycleSet(realmId, flags.userId, { state: flags.state }),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userId: userIdFlag(),
      state: userStateFlag(),
    },
  },
  docs: { brief: "Change a tenant user lifecycle state" },
})

const userTenantVerifyCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags & { state: "unverified" | "verified" }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userTenantVerificationSet(realmId, flags.userId, { state: flags.state }),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userId: userIdFlag(),
      state: userVerificationStateFlag(),
    },
  },
  docs: { brief: "Change a tenant user email verification state" },
})

const userTenantAuthMethodsCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userTenantAuthenticationMethodsGet(realmId, flags.userId),
      [connection.token, connection.systemToken],
    )
  },
  parameters: { flags: { ...userCommonFlags(), realmId: userRealmIdFlag(), userId: userIdFlag() } },
  docs: { brief: "Read a tenant user authentication methods" },
})

const userTenantDeleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(this, await userCliClientCreate(connection).userTenantDelete(realmId, flags.userId), [
      connection.token,
      connection.systemToken,
    ])
  },
  parameters: { flags: { ...userCommonFlags(), realmId: userRealmIdFlag(), userId: userIdFlag() } },
  docs: { brief: "Delete a tenant user" },
})

const userTenantMetadataListCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags & UserListCliFlags & { keyPrefix?: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userTenantMetadataList(
        realmId,
        flags.userId,
        userMetadataListQueryCreate(flags),
      ),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      ...userListFlags(),
      realmId: userRealmIdFlag(),
      userId: userIdFlag(),
      keyPrefix: optionalTextFlag("Filter metadata keys by prefix"),
    },
  },
  docs: { brief: "List tenant user metadata" },
})

const userTenantMetadataGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags & { key: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userTenantMetadataGet(realmId, flags.userId, flags.key),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: { ...userCommonFlags(), realmId: userRealmIdFlag(), userId: userIdFlag(), key: textFlag("Metadata key") },
  },
  docs: { brief: "Get a tenant user metadata entry" },
})

const userTenantMetadataSetCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags & { key: string; value: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userTenantMetadataSet(realmId, flags.userId, flags.key, {
        value: flags.value,
      }),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userId: userIdFlag(),
      key: textFlag("Metadata key"),
      value: textFlag("Metadata value"),
    },
  },
  docs: { brief: "Set a tenant user metadata entry" },
})

const userTenantMetadataRemoveCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags & { key: string }) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userTenantMetadataRemove(realmId, flags.userId, flags.key),
      [connection.token, connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userId: userIdFlag(),
      key: textFlag("Metadata key"),
    },
  },
  docs: { brief: "Remove a tenant user metadata entry" },
})

const userTenantPurgeCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(this, await userCliClientCreate(connection).userTenantPurge(realmId, flags.userId), [
      connection.token,
      connection.systemToken,
    ])
  },
  parameters: { flags: { ...userCommonFlags(), realmId: userRealmIdFlag(), userId: userIdFlag() } },
  docs: { brief: "Purge a tenant user" },
})

export const userCliCommands = buildRouteMap({
  routes: {
    create: userCreateCommand,
    delete: userDeleteCommand,
    emailChangeResend: userEmailChangeResendCommand,
    emailChangeStart: userEmailChangeStartCommand,
    emailChangeVerify: userEmailChangeVerifyCommand,
    emailsAddResend: userEmailsAddResendCommand,
    emailsAddStart: userEmailsAddStartCommand,
    emailsAddVerify: userEmailsAddVerifyCommand,
    emailsList: userEmailsListCommand,
    emailsPrimarySet: userEmailsPrimarySetCommand,
    emailsRemove: userEmailsRemoveCommand,
    exportMe: userExportMeCommand,
    get: userGetCommand,
    list: userListCommand,
    lifecycle: userLifecycleCommand,
    me: userMeCommand,
    meAuthMethods: userMeAuthMethodsCommand,
    meDelete: userMeDeleteCommand,
    meProfile: userMeProfileCommand,
    profile: userProfileCommand,
    tenantAuthMethods: userTenantAuthMethodsCommand,
    tenantCreate: userTenantCreateCommand,
    tenantDelete: userTenantDeleteCommand,
    tenantGet: userTenantGetCommand,
    tenantLifecycle: userTenantLifecycleCommand,
    tenantList: userTenantListCommand,
    tenantMetadataGet: userTenantMetadataGetCommand,
    tenantMetadataList: userTenantMetadataListCommand,
    tenantMetadataRemove: userTenantMetadataRemoveCommand,
    tenantMetadataSet: userTenantMetadataSetCommand,
    tenantProfile: userTenantProfileCommand,
    tenantPurge: userTenantPurgeCommand,
    tenantVerify: userTenantVerifyCommand,
    verify: userVerifyCommand,
  },
  docs: { brief: "User administration" },
})

async function userCliConnectionResolve(
  context: ApplicationContext,
  flags: UserCliFlags & { readonly realmId?: string },
) {
  const result = await connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
  if (!result.success) {
    userCliResultWrite(context, result, [
      flags.systemToken,
      flags.token,
      context.process.env?.AUTHWORKS_SYSTEM_SECRET,
      context.process.env?.AUTHWORKS_TOKEN,
    ])
    return undefined
  }
  return {
    ...result.data,
    systemToken: connectionProfileCliSystemTokenResolve(flags.systemToken ?? flags.token, context.process.env),
  }
}

function userCliClientCreate(connection: {
  readonly server: string
  readonly systemToken?: string
  readonly token?: string
}) {
  return userApiClientCreate({
    baseUrl: connection.server,
    systemToken: connection.systemToken,
    token: connection.token,
  })
}

function userCliResultWrite(
  context: ApplicationContext,
  result: { data?: unknown; errorMessage?: string; status?: "current" | "unchanged"; success: boolean },
  secrets: readonly (string | undefined)[] = [],
) {
  if (!result.success) {
    context.process.stderr.write(
      `${connectionProfileCliOutputRedact(result.errorMessage ?? "The request failed.", secrets)}\n`,
    )
    context.process.exitCode = 1
    return
  }
  if (result.status === "unchanged") {
    context.process.stderr.write("304 Not Modified\n")
    return
  }
  context.process.stdout.write(
    `${connectionProfileCliOutputRedact(JSON.stringify(result.data) ?? "undefined", secrets)}\n`,
  )
}

function userCommonFlags() {
  return {
    ...connectionProfileCliCentralFlags(),
    server: {
      brief: "Authworks server URL",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "URL",
    },
    token: {
      brief: "Bearer token",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
    },
    systemToken: {
      brief: "System bearer token",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
    },
  }
}

function userListFlags() {
  return {
    emailVerified: {
      brief: "Filter by email verification",
      kind: "boolean" as const,
      optional: true as const,
    },
    state: {
      brief: "Filter by lifecycle state",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value as UserState,
      placeholder: "STATE",
    },
    pageSize: {
      brief: "Maximum items per page",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => Number(value),
      placeholder: "NUMBER",
    },
    pageToken: {
      brief: "Opaque page token",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
    },
    search: {
      brief: "Case-insensitive user search",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TEXT",
    },
    sortBy: {
      brief: "Sort field",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "FIELD",
    },
    sortDirection: {
      brief: "Sort direction",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value as "asc" | "desc",
      placeholder: "DIRECTION",
    },
  }
}

function userMetadataListQueryCreate(
  flags: UserListCliFlags & { readonly keyPrefix?: string },
): UserMetadataListQuery | undefined {
  const base = userListQueryCreate(flags)
  if (base === undefined && flags.keyPrefix === undefined) return undefined
  return {
    ...(base ?? {}),
    ...(flags.keyPrefix === undefined ? {} : { keyPrefix: flags.keyPrefix }),
  }
}

function userCreateInputCreate(
  flags: Readonly<{
    displayName?: string
    email: string
    firstName?: string
    gender?: string
    lastName?: string
    nickName?: string
    phoneNumber?: string
    preferredLanguage?: string
    userName: string
  }>,
): UserCreateRequest {
  return {
    email: flags.email,
    ...(flags.phoneNumber === undefined ? {} : { phoneNumber: flags.phoneNumber }),
    profile: {
      ...(flags.displayName === undefined ? {} : { displayName: flags.displayName }),
      ...(flags.firstName === undefined ? {} : { firstName: flags.firstName }),
      ...(flags.gender === undefined ? {} : { gender: flags.gender }),
      ...(flags.lastName === undefined ? {} : { lastName: flags.lastName }),
      ...(flags.nickName === undefined ? {} : { nickName: flags.nickName }),
      ...(flags.preferredLanguage === undefined ? {} : { preferredLanguage: flags.preferredLanguage }),
    },
    userName: flags.userName,
  }
}

function userListQueryCreate(flags: UserListCliFlags): UserListQuery | undefined {
  if (
    flags.emailVerified === undefined &&
    flags.pageSize === undefined &&
    flags.pageToken === undefined &&
    flags.search === undefined &&
    flags.sortBy === undefined &&
    flags.sortDirection === undefined &&
    flags.state === undefined
  )
    return undefined
  return {
    ...(flags.emailVerified === undefined ? {} : { emailVerified: flags.emailVerified }),
    ...(flags.pageSize === undefined ? {} : { pageSize: flags.pageSize }),
    ...(flags.pageToken === undefined ? {} : { pageToken: flags.pageToken }),
    ...(flags.search === undefined ? {} : { search: flags.search }),
    ...(flags.sortBy === undefined ? {} : { sortBy: flags.sortBy }),
    ...(flags.sortDirection === undefined ? {} : { sortDirection: flags.sortDirection }),
    ...(flags.state === undefined ? {} : { state: flags.state }),
  }
}

function userRealmIdFlag() {
  return {
    brief: "Realm UUID",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "REALM_ID",
  }
}

function userIdFlag() {
  return { brief: "User UUID", kind: "parsed" as const, parse: (value: string) => value, placeholder: "USER_ID" }
}

function ifModifiedSinceFlag() {
  return {
    brief: "HTTP If-Modified-Since date",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "HTTP-DATE",
  }
}

function optionalNumberFlag(brief: string) {
  return {
    brief,
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => Number(value),
    placeholder: "NUMBER",
  }
}

function textFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

function optionalTextFlag(brief: string) {
  return { ...textFlag(brief), optional: true as const }
}

function userStateFlag() {
  return {
    brief: "Lifecycle state",
    kind: "parsed" as const,
    parse: (value: string) => value as "active" | "inactive" | "initial" | "locked" | "suspended",
    placeholder: "STATE",
  }
}

function userVerificationStateFlag() {
  return {
    brief: "Verification state",
    kind: "parsed" as const,
    parse: (value: string) => value as "unverified" | "verified",
    placeholder: "STATE",
  }
}
