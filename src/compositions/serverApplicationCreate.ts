import { Hono } from "hono"
import { type Result } from "#result"
import type { MailDeliveryPort } from "../features/email/domain/mailDeliveryPort.js"
import { emailDeliveryCallbacksCreate } from "../features/email/server/emailDeliveryCallbacksCreate.js"
import type { EmailGeneratorServerConfiguration } from "../features/email/server/emailGeneratorServerConfiguration.js"
import { emailOtpServerAppCreate } from "../features/emailOtp/server/emailOtpServerAppCreate.js"
import { accountServerAppCreate } from "../features/account/server/accountServerAppCreate.js"
import { eventServerAppCreate } from "../features/events/server/eventServerAppCreate.js"
import type { ExternalIdentityProviderPorts } from "../features/externalIdentities/domain/externalIdentityProviderPort.js"
import { externalIdentityServerAppCreate } from "../features/externalIdentities/server/externalIdentityServerAppCreate.js"
import { impersonationServerAppCreate } from "../features/impersonation/server/impersonationServerAppCreate.js"
import { machineUserServerAppCreate } from "../features/machineUsers/server/machineUserServerAppCreate.js"
import { mfaServerAppCreate } from "../features/mfa/server/mfaServerAppCreate.js"
import { oidcServerAppCreate } from "../features/oidc/server/oidcServerAppCreate.js"
import type { OrganizationDomainDnsVerificationPort } from "../features/organizations/domain/organizationDomainDnsVerificationPort.js"
import { organizationServerAppCreate } from "../features/organizations/server/organizationServerAppCreate.js"
import { passkeyServerAppCreate } from "../features/passkeys/server/passkeyServerAppCreate.js"
import { passwordRegistrationRateLimitSecretValidate } from "../features/passwords/domain/passwordRegistrationRateLimitSecretValidate.js"
import type { PasswordWhatsappDeliveryPort } from "../features/passwords/domain/passwordWhatsappDeliveryPort.js"
import type { PasswordRecoveryDelivery } from "../features/passwords/public/passwordRecoveryDeliverySchema.js"
import type { PasswordRegistrationDelivery } from "../features/passwords/public/passwordRegistrationDeliverySchema.js"
import { passwordServerAppCreate } from "../features/passwords/server/passwordServerAppCreate.js"
import { projectServerAppCreate } from "../features/projects/server/projectServerAppCreate.js"
import { realmServerAppCreate } from "../features/realms/server/realmServerAppCreate.js"
import { sessionPasswordCreate } from "../features/sessions/actions/sessionPasswordCreate.js"
import { sessionServerAppCreate } from "../features/sessions/server/sessionServerAppCreate.js"
import { userServerAppCreate } from "../features/users/server/userServerAppCreate.js"
import type { WahaDeliveryPort } from "../features/waha/domain/wahaDeliveryPort.js"
import { wahaHealthCandidateRepositoryCreate } from "../features/waha/persistence/wahaHealthCandidateRepositoryCreate.js"
import type { WahaConfiguration } from "../features/waha/server/wahaConfiguration.js"
import { wahaDeliveryPortCreate } from "../features/waha/server/wahaDeliveryPortCreate.js"
import { wahaHealthCandidateReaderCreate } from "../features/waha/server/wahaHealthCandidateReaderCreate.js"
import { wahaHealthPortCreate } from "../features/waha/server/wahaHealthPortCreate.js"
import { wahaHealthRefreshLifecycleCreate } from "../features/waha/server/wahaHealthRefreshLifecycleCreate.js"
import { wahaHealthRegistryCreate } from "../features/waha/server/wahaHealthRegistryCreate.js"
import { wahaTextDeliveryCreate } from "../features/waha/server/wahaTextDeliveryCreate.js"
import type { WhatsappOtpAvailabilityPort } from "../features/whatsappOtp/domain/whatsappOtpAvailabilityPort.js"
import { whatsappOtpAvailabilityCreate } from "../features/whatsappOtp/server/whatsappOtpAvailabilityCreate.js"
import { whatsappOtpServerAppCreate } from "../features/whatsappOtp/server/whatsappOtpServerAppCreate.js"
import { resultCreate } from "../platform/errors/resultCreate.js"
import { healthServerAppCreate } from "../platform/http/healthServerAppCreate.js"
import { uiStaticServerAppCreate } from "../platform/http/uiStaticServerAppCreate.js"
import { runtimeCreate } from "../platform/runtime/runtimeCreate.js"
import { storageDatabaseOpen } from "../platform/storage/storageDatabaseOpen.js"

type ServerApplicationCreateOptions = {
  readonly accountUiOrigin?: string
  readonly browserMode?: boolean
  readonly databasePath: string
  readonly emailGenerator?: EmailGeneratorServerConfiguration
  readonly externalIdentityProviderPorts?: ExternalIdentityProviderPorts
  readonly mailDelivery?: MailDeliveryPort
  readonly production?: boolean
  readonly systemSecret?: string
  readonly passkeyOrigins?: readonly string[]
  readonly passkeyRpId?: string
  readonly passkeyRpName?: string
  readonly publicOrigin?: string
  readonly clientIpResolve?: (request: Request) => string | undefined
  readonly trustedProxyAddresses?: readonly string[]
  readonly uiDirectory?: string
  readonly wahaConfiguration?: WahaConfiguration
  readonly wahaDeliveryPort?: WahaDeliveryPort
  readonly whatsappDelivery?: PasswordWhatsappDeliveryPort
  readonly whatsappAvailability?: WhatsappOtpAvailabilityPort
  readonly organizationDomainVerificationPort?: OrganizationDomainDnsVerificationPort
  readonly onRecoveryToken?: (delivery: PasswordRecoveryDelivery) => void
  readonly onVerificationToken?: (delivery: PasswordRegistrationDelivery) => void
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

export function serverApplicationCreate(
  options: ServerApplicationCreateOptions,
): Result<Hono & { readonly stop: () => void }> {
  const whatsappConfigurationEnabled = (options.wahaConfiguration?.endpoints.length ?? 0) > 0
  if (whatsappConfigurationEnabled) {
    const rateLimitSecret = passwordRegistrationRateLimitSecretValidate(options.systemSecret)
    if (!rateLimitSecret.success) return rateLimitSecret
  }
  const database = storageDatabaseOpen(options.databasePath, options.runtime)
  if (!database.success) return database
  const publicOrigin = options.publicOrigin ?? "http://127.0.0.1:3000"
  const accountUiOrigin = options.accountUiOrigin ?? (options.production === true ? undefined : publicOrigin)
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
  const wahaRepository = wahaHealthCandidateRepositoryCreate(database.data.db)
  const wahaCandidateReader = wahaHealthCandidateReaderCreate({ repository: wahaRepository })
  const whatsappAvailability =
    options.whatsappAvailability ??
    whatsappOtpAvailabilityCreate({
      configuration: options.wahaConfiguration,
      database: database.data,
      reader: wahaCandidateReader,
      runtime: options.runtime,
    })
  const wahaRegistry =
    options.wahaConfiguration === undefined || options.wahaConfiguration.endpoints.length === 0
      ? undefined
      : wahaHealthRegistryCreate({
          configuration: options.wahaConfiguration,
          healthPort: wahaHealthPortCreate({ configuration: options.wahaConfiguration }),
          repository: wahaRepository,
          runtime: options.runtime,
        })
  const wahaHealthLifecycle =
    wahaRegistry === undefined || options.wahaConfiguration === undefined
      ? undefined
      : wahaHealthRefreshLifecycleCreate({
          intervalMs: options.wahaConfiguration.refreshIntervalMs,
          refresh: wahaRegistry.refresh,
        })
  const whatsappDelivery =
    options.whatsappDelivery ??
    (wahaRegistry === undefined || options.wahaConfiguration === undefined
      ? undefined
      : wahaTextDeliveryCreate({
          deliveryPort:
            options.wahaDeliveryPort ?? wahaDeliveryPortCreate({ configuration: options.wahaConfiguration }),
          healthRegistry: wahaRegistry,
          repository: wahaRepository,
          runtime: options.runtime,
        }))
  application.route("/", healthServerAppCreate())
  application.route(
    "/",
    realmServerAppCreate({
      database: database.data,
      publicOrigin,
      systemSecret: options.systemSecret,
    }),
  )
  application.route("/", sessionServerAppCreate({ database: database.data, publicOrigin }))
  application.route("/", accountServerAppCreate({ database: database.data, publicOrigin }))
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
    whatsappOtpServerAppCreate({
      browserMode: options.browserMode,
      clientIpResolve:
        options.clientIpResolve === undefined ? undefined : (context) => options.clientIpResolve?.(context.req.raw),
      database: database.data,
      delivery: whatsappDelivery,
      publicOrigin,
      rateLimitSecret: options.systemSecret,
      trustedProxyAddresses: options.trustedProxyAddresses,
      availability: whatsappAvailability,
    }),
  )
  application.route(
    "/",
    externalIdentityServerAppCreate({
      accountUiOrigin,
      browserMode: options.browserMode,
      database: database.data,
      providerPorts: options.externalIdentityProviderPorts,
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
      domainVerificationPort: options.organizationDomainVerificationPort,
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
      clientIpResolve:
        options.clientIpResolve === undefined ? undefined : (context) => options.clientIpResolve?.(context.req.raw),
      database: database.data,
      onEmailAddressVerificationDelivery: emailDeliveryCallbacks?.onEmailAddressVerificationDelivery,
      onEmailChangeDelivery: emailDeliveryCallbacks?.onEmailChangeDelivery,
      onEmailChangeNotification: emailDeliveryCallbacks?.onEmailChangeNotification,
      publicOrigin,
      rateLimitSecret: options.systemSecret,
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
      clientIpResolve:
        options.clientIpResolve === undefined ? undefined : (context) => options.clientIpResolve?.(context.req.raw),
      database: database.data,
      publicOrigin,
      sessionCreate: sessionPasswordCreate(),
      systemSecret: options.systemSecret,
      onRecoveryToken: options.onRecoveryToken ?? emailDeliveryCallbacks?.onRecoveryToken,
      onVerificationToken: options.onVerificationToken ?? emailDeliveryCallbacks?.onVerificationToken,
      rateLimitSecret: options.systemSecret,
      trustedProxyAddresses: options.trustedProxyAddresses,
      whatsappDelivery,
      whatsappAvailability,
    }),
  )
  application.route("/", uiStaticServerAppCreate({ production: options.production, uiDirectory: options.uiDirectory }))
  let stopped = false
  const stop = (): void => {
    if (stopped) return
    stopped = true
    wahaHealthLifecycle?.stop()
    database.data.close()
  }
  const serverApplication = Object.assign(application, { stop })
  void wahaHealthLifecycle?.start().then(
    (started) => {
      if (!started.success) console.error(started.errorMessage)
    },
    () => console.error("The WAHA health refresh failed."),
  )
  return resultCreate(serverApplication)
}
