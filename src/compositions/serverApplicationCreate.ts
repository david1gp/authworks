import { Hono } from "hono"
import { emailOtpServerAppCreate } from "../features/emailOtp/server/emailOtpServerAppCreate.js"
import { externalIdentityServerAppCreate } from "../features/externalIdentities/server/externalIdentityServerAppCreate.js"
import { realmServerAppCreate } from "../features/realms/server/realmServerAppCreate.js"
import { organizationServerAppCreate } from "../features/organizations/server/organizationServerAppCreate.js"
import { passwordServerAppCreate } from "../features/passwords/server/passwordServerAppCreate.js"
import { projectServerAppCreate } from "../features/projects/server/projectServerAppCreate.js"
import { oidcServerAppCreate } from "../features/oidc/server/oidcServerAppCreate.js"
import { mfaServerAppCreate } from "../features/mfa/server/mfaServerAppCreate.js"
import { impersonationServerAppCreate } from "../features/impersonation/server/impersonationServerAppCreate.js"
import { machineUserServerAppCreate } from "../features/machineUsers/server/machineUserServerAppCreate.js"
import { passkeyServerAppCreate } from "../features/passkeys/server/passkeyServerAppCreate.js"
import { sessionPasswordCreate } from "../features/sessions/public/sessionPasswordCreate.js"
import { sessionServerAppCreate } from "../features/sessions/server/sessionServerAppCreate.js"
import { userServerAppCreate } from "../features/users/server/userServerAppCreate.js"
import { storageDatabaseOpen } from "../platform/storage/storageDatabaseOpen.js"

type ServerApplicationCreateOptions = {
  readonly databasePath: string
  readonly systemSecret?: string
  readonly passkeyOrigins?: readonly string[]
  readonly passkeyRpId?: string
  readonly passkeyRpName?: string
  readonly publicOrigin?: string
}

export function serverApplicationCreate(options: ServerApplicationCreateOptions) {
  const database = storageDatabaseOpen(options.databasePath)
  if (!database.success) return new Hono()
  const publicOrigin = options.publicOrigin ?? "http://127.0.0.1:3000"
  const passkeyRpId = options.passkeyRpId ?? new URL(publicOrigin).hostname
  const application = realmServerAppCreate({ database: database.data, systemSecret: options.systemSecret })
  application.route("/", sessionServerAppCreate({ database: database.data }))
  application.route("/", emailOtpServerAppCreate({ database: database.data }))
  application.route(
    "/",
    externalIdentityServerAppCreate({ database: database.data, systemSecret: options.systemSecret }),
  )
  application.route(
    "/",
    passkeyServerAppCreate({
      database: database.data,
      origins: options.passkeyOrigins ?? [publicOrigin],
      rpId: passkeyRpId,
      rpName: options.passkeyRpName ?? "ZITADEL",
    }),
  )
  application.route("/", organizationServerAppCreate({ database: database.data, systemSecret: options.systemSecret }))
  application.route("/", projectServerAppCreate({ database: database.data, systemSecret: options.systemSecret }))
  application.route("/", oidcServerAppCreate({ database: database.data, systemSecret: options.systemSecret }))
  application.route("/", machineUserServerAppCreate({ database: database.data, systemSecret: options.systemSecret }))
  application.route("/", impersonationServerAppCreate({ database: database.data }))
  application.route(
    "/",
    mfaServerAppCreate({
      database: database.data,
      encryptionSecret: options.systemSecret,
      systemSecret: options.systemSecret,
    }),
  )
  application.route("/", userServerAppCreate({ database: database.data, systemSecret: options.systemSecret }))
  application.route(
    "/",
    passwordServerAppCreate({
      database: database.data,
      sessionCreate: sessionPasswordCreate(),
      systemSecret: options.systemSecret,
    }),
  )
  return application
}
