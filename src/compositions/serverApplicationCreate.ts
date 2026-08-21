import { Hono } from "hono"
import { type Result } from "#result"
import type { MailDeliveryPort } from "../features/email/domain/mailDeliveryPort.js"
import { emailDeliveryCallbacksCreate } from "../features/email/server/emailDeliveryCallbacksCreate.js"
import type { EmailGeneratorServerConfiguration } from "../features/email/server/emailGeneratorServerConfiguration.js"
import { emailOtpServerAppCreate } from "../features/emailOtp/server/emailOtpServerAppCreate.js"
import { eventServerAppCreate } from "../features/events/server/eventServerAppCreate.js"
import { externalIdentityServerAppCreate } from "../features/externalIdentities/server/externalIdentityServerAppCreate.js"
import { impersonationServerAppCreate } from "../features/impersonation/server/impersonationServerAppCreate.js"
import { machineUserServerAppCreate } from "../features/machineUsers/server/machineUserServerAppCreate.js"
import { mfaServerAppCreate } from "../features/mfa/server/mfaServerAppCreate.js"
import { oidcServerAppCreate } from "../features/oidc/server/oidcServerAppCreate.js"
import { organizationServerAppCreate } from "../features/organizations/server/organizationServerAppCreate.js"
import { passkeyServerAppCreate } from "../features/passkeys/server/passkeyServerAppCreate.js"
import { passwordServerAppCreate } from "../features/passwords/server/passwordServerAppCreate.js"
import { projectServerAppCreate } from "../features/projects/server/projectServerAppCreate.js"
import { realmServerAppCreate } from "../features/realms/server/realmServerAppCreate.js"
import { sessionPasswordCreate } from "../features/sessions/actions/sessionPasswordCreate.js"
import { sessionServerAppCreate } from "../features/sessions/server/sessionServerAppCreate.js"
import { userServerAppCreate } from "../features/users/server/userServerAppCreate.js"
import { resultCreate } from "../platform/errors/resultCreate.js"
import { uiStaticServerAppCreate } from "../platform/http/uiStaticServerAppCreate.js"
import { storageDatabaseOpen } from "../platform/storage/storageDatabaseOpen.js"

type ServerApplicationCreateOptions = {
  readonly browserMode?: boolean
  readonly databasePath: string
  readonly emailGenerator?: EmailGeneratorServerConfiguration
  readonly mailDelivery?: MailDeliveryPort
  readonly production?: boolean
  readonly systemSecret?: string
  readonly passkeyOrigins?: readonly string[]
  readonly passkeyRpId?: string
  readonly passkeyRpName?: string
  readonly publicOrigin?: string
  readonly uiDirectory?: string
}

export function serverApplicationCreate(options: ServerApplicationCreateOptions): Result<Hono> {
  const database = storageDatabaseOpen(options.databasePath)
  if (!database.success) return database
  const publicOrigin = options.publicOrigin ?? "http://127.0.0.1:3000"
  const passkeyRpId = options.passkeyRpId ?? new URL(publicOrigin).hostname
  const emailDeliveryCallbacks =
    options.emailGenerator === undefined || options.mailDelivery === undefined
      ? undefined
      : emailDeliveryCallbacksCreate({
          emailGenerator: options.emailGenerator,
          mailDelivery: options.mailDelivery,
          publicOrigin,
        })
  const application = new Hono()
  application.route(
    "/",
    realmServerAppCreate({
      database: database.data,
      publicOrigin,
      systemSecret: options.systemSecret,
    }),
  )
  application.route("/", sessionServerAppCreate({ database: database.data, publicOrigin }))
  application.route(
    "/",
    emailOtpServerAppCreate({
      browserMode: options.browserMode,
      database: database.data,
      onDelivery: emailDeliveryCallbacks?.onOtpDelivery,
    }),
  )
  application.route(
    "/",
    externalIdentityServerAppCreate({
      browserMode: options.browserMode,
      database: database.data,
      publicOrigin,
      systemSecret: options.systemSecret,
    }),
  )
  application.route(
    "/",
    passkeyServerAppCreate({
      browserMode: options.browserMode,
      database: database.data,
      origins: options.passkeyOrigins ?? [publicOrigin],
      publicOrigin,
      rpId: passkeyRpId,
      rpName: options.passkeyRpName ?? "Authworks",
    }),
  )
  application.route(
    "/",
    organizationServerAppCreate({
      database: database.data,
      onInvitationDelivery: emailDeliveryCallbacks?.onInvitationDelivery,
      publicOrigin,
      systemSecret: options.systemSecret,
    }),
  )
  application.route(
    "/",
    projectServerAppCreate({ database: database.data, publicOrigin, systemSecret: options.systemSecret }),
  )
  application.route(
    "/",
    oidcServerAppCreate({ database: database.data, publicOrigin, systemSecret: options.systemSecret }),
  )
  application.route(
    "/",
    machineUserServerAppCreate({ database: database.data, publicOrigin, systemSecret: options.systemSecret }),
  )
  application.route("/", impersonationServerAppCreate({ database: database.data, publicOrigin }))
  application.route(
    "/",
    mfaServerAppCreate({
      browserMode: options.browserMode,
      database: database.data,
      encryptionSecret: options.systemSecret,
      publicOrigin,
      systemSecret: options.systemSecret,
    }),
  )
  application.route(
    "/",
    userServerAppCreate({
      database: database.data,
      publicOrigin,
      systemSecret: options.systemSecret,
    }),
  )
  application.route(
    "/",
    eventServerAppCreate({ database: database.data, publicOrigin, systemSecret: options.systemSecret }),
  )
  application.route(
    "/",
    passwordServerAppCreate({
      browserMode: options.browserMode,
      database: database.data,
      onRecoveryToken: emailDeliveryCallbacks?.onRecoveryToken,
      publicOrigin,
      sessionCreate: sessionPasswordCreate(),
      systemSecret: options.systemSecret,
      onVerificationToken: emailDeliveryCallbacks?.onVerificationToken,
    }),
  )
  application.route("/", uiStaticServerAppCreate({ production: options.production, uiDirectory: options.uiDirectory }))
  return resultCreate(application)
}
