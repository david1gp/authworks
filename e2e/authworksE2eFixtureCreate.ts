import { createHmac } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Hono } from "hono"
import type { Result } from "#result"
import { serverApplicationCreate } from "../src/compositions/serverApplicationCreate.js"
import type { MailDeliveryMessage } from "../src/features/email/domain/mailDeliveryMessage.js"
import { mailDeliveryPortFakeCreate } from "../src/features/email/domain/mailDeliveryPortFakeCreate.js"
import { emailPreviewFooterFixture } from "../src/features/email/fixtures/emailPreviewFooterFixture.js"
import { externalIdentityApiClientCreate } from "../src/features/externalIdentities/client/externalIdentityApiClientCreate.js"
import type { ExternalIdentityProviderPorts } from "../src/features/externalIdentities/domain/externalIdentityProviderPort.js"
import { machineUserApiClientCreate } from "../src/features/machineUsers/client/machineUserApiClientCreate.js"
import { mfaApiClientCreate } from "../src/features/mfa/client/mfaApiClientCreate.js"
import { oidcApiClientCreate } from "../src/features/oidc/client/oidcApiClientCreate.js"
import { organizationApiClientCreate } from "../src/features/organizations/client/organizationApiClientCreate.js"
import type { OrganizationDomainDnsVerificationPort } from "../src/features/organizations/domain/organizationDomainDnsVerificationPort.js"
import { passwordApiClientCreate } from "../src/features/passwords/client/passwordApiClientCreate.js"
import type { PasswordRecoveryDelivery } from "../src/features/passwords/public/passwordRecoveryDeliverySchema.js"
import type { PasswordRegistrationDelivery } from "../src/features/passwords/public/passwordRegistrationDeliverySchema.js"
import { projectApiClientCreate } from "../src/features/projects/client/projectApiClientCreate.js"
import { realmApiClientCreate } from "../src/features/realms/client/realmApiClientCreate.js"
import { userApiClientCreate } from "../src/features/users/client/userApiClientCreate.js"
import { resultCreate } from "../src/platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../src/platform/errors/resultErrorCodedCreate.js"
import { resultErrorCreate } from "../src/platform/errors/resultErrorCreate.js"
import { runtimeCreate } from "../src/platform/runtime/runtimeCreate.js"

const fixtureOrigin = "https://e2e.authworks.test"
const fixtureDomain = "e2e.authworks.test"
const fixtureDiscoveryDomain = "login.e2e.authworks.test"
const fixtureSystemSecret = "authworks-e2e-system-secret"
const fixturePassword = "E2E Password 123!"
const fixtureExternalProviderSecret = "authworks-e2e-external-provider-secret"

type AuthworksE2eFixtureClients = {
  readonly externalIdentities: ReturnType<typeof externalIdentityApiClientCreate>
  readonly machines: ReturnType<typeof machineUserApiClientCreate>
  readonly mfa: ReturnType<typeof mfaApiClientCreate>
  readonly oidc: ReturnType<typeof oidcApiClientCreate>
  readonly organizations: ReturnType<typeof organizationApiClientCreate>
  readonly passwords: ReturnType<typeof passwordApiClientCreate>
  readonly projects: ReturnType<typeof projectApiClientCreate>
  readonly realms: ReturnType<typeof realmApiClientCreate>
  readonly users: ReturnType<typeof userApiClientCreate>
}

type AuthworksE2eFixture = {
  readonly app: Hono
  readonly application: {
    readonly id: string
    readonly name: string
  }
  readonly bootstrapAdmin: {
    readonly adminId: string
    readonly secret: string
  }
  readonly clients: AuthworksE2eFixtureClients
  readonly databaseDirectory: string
  readonly externalProvider: {
    readonly clientSecret: string
    readonly id: string
  }
  readonly fetchFromServer: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  readonly machineUser: {
    readonly clientId: string
    readonly clientSecret: string
    readonly id: string
    readonly userName: string
  }
  readonly mailMessages?: readonly MailDeliveryMessage[]
  readonly member: {
    readonly email: string
    readonly id: string
    readonly password: string
    readonly userName: string
  }
  readonly organization: {
    readonly id: string
    readonly name: string
  }
  readonly secondaryOrganization: {
    readonly id: string
    readonly name: string
  }
  readonly project: {
    readonly id: string
    readonly name: string
  }
  readonly realm: {
    readonly domain: string
    readonly id: string
    readonly name: string
  }
  readonly oidcClients: {
    readonly approve: { readonly id: string }
    readonly reject: { readonly id: string }
  }
  readonly close: () => Promise<Result<void>>
  readonly origin: string
  readonly discoveryDomain: string
  readonly recoveryCode?: string
  readonly administratorRecoveryCode?: string
  readonly administrator: {
    readonly email: string
    readonly id: string
    readonly password: string
    readonly userName: string
  }
}

type AuthworksE2eAuthenticationUser = "administrator" | "member"

export async function authworksE2eFixtureCreate(
  options: {
    readonly advancedAuthentication?: boolean
    readonly advancedAuthenticationUsers?: readonly AuthworksE2eAuthenticationUser[]
    readonly emailDelivery?: boolean
    readonly onRecoveryToken?: (delivery: PasswordRecoveryDelivery) => void
    readonly passkeyOrigins?: readonly string[]
    readonly passkeyRpId?: string
    readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  } = {},
): Promise<Result<AuthworksE2eFixture>> {
  let databaseDirectory: string
  try {
    databaseDirectory = await mkdtemp(join(tmpdir(), "authworks-e2e-"))
  } catch (error) {
    return resultErrorCreate("authworksE2eFixtureCreate", errorMessageGet(error))
  }

  try {
    const verificationTokens = new Map<string, string>()
    const recoveryTokens = new Map<string, string>()
    const fakeMail = options.emailDelivery === true ? mailDeliveryPortFakeCreate() : undefined
    let domainVerificationToken = ""
    const domainVerificationPort: OrganizationDomainDnsVerificationPort = {
      txtRecordsGet: async () => resultCreate(domainVerificationToken.length === 0 ? [] : [domainVerificationToken]),
    }
    const created = serverApplicationCreate({
      browserMode: true,
      databasePath: join(databaseDirectory, "authworks.sqlite"),
      emailGenerator:
        fakeMail === undefined
          ? undefined
          : {
              baseUrl: "https://email-generator.e2e.authworks.test",
              fetch: e2eEmailGeneratorFetchCreate(),
              footer: emailPreviewFooterFixture,
              invitationSender: { email: "administrator@e2e.authworks.test", name: "E2E Administrator" },
            },
      externalIdentityProviderPorts: externalIdentityProviderPortsCreate(),
      mailDelivery: fakeMail?.port,
      ...(options.emailDelivery === true
        ? {}
        : {
            onRecoveryToken: (delivery: PasswordRecoveryDelivery) => {
              recoveryTokens.set(delivery.email, delivery.token)
              options.onRecoveryToken?.(delivery)
            },
            onVerificationToken: (delivery: PasswordRegistrationDelivery) => {
              verificationTokens.set(delivery.email, delivery.token)
            },
          }),
      organizationDomainVerificationPort: domainVerificationPort,
      passkeyOrigins: options.passkeyOrigins,
      passkeyRpId: options.passkeyRpId,
      publicOrigin: fixtureOrigin,
      runtime: options.runtime,
      systemSecret: fixtureSystemSecret,
    })
    if (!created.success) return await fixtureSetupFailure(databaseDirectory, created.errorMessage)

    const application = created.data
    const fetchFromServer = async (input: string | URL | Request, init?: RequestInit) =>
      application.request(input instanceof Request ? input : input.toString(), init)
    const clients = fixtureClientsCreate(fetchFromServer)

    const realmResponse = await clients.realms.realmCreate({ domain: fixtureDomain, name: "Authworks E2E" })
    if (!realmResponse.success) return await fixtureSetupFailure(databaseDirectory, realmResponse.errorMessage)
    const realm = realmResponse.data.realm

    const bootstrapResponse = await clients.realms.realmBootstrapAdminCreate(realm.id)
    if (!bootstrapResponse.success) return await fixtureSetupFailure(databaseDirectory, bootstrapResponse.errorMessage)

    const administrator = await fixtureUserCreate(
      clients.passwords,
      realm.id,
      "administrator",
      "E2E Administrator",
      verificationTokens,
      fakeMail?.messages,
      options.emailDelivery === true,
    )
    if (!administrator.success) return await fixtureSetupFailure(databaseDirectory, administrator.errorMessage)
    const member = await fixtureUserCreate(
      clients.passwords,
      realm.id,
      "member",
      "E2E Member",
      verificationTokens,
      fakeMail?.messages,
      options.emailDelivery === true,
    )
    if (!member.success) return await fixtureSetupFailure(databaseDirectory, member.errorMessage)

    let recoveryCode: string | undefined
    let administratorRecoveryCode: string | undefined
    const advancedAuthenticationUsers =
      options.advancedAuthenticationUsers ?? (options.advancedAuthentication === true ? ["member"] : [])
    if (advancedAuthenticationUsers.length > 0) {
      const recoveryCodes = new Map<AuthworksE2eAuthenticationUser, string>()
      const runtime = options.runtime ?? runtimeCreate()
      for (const userKind of advancedAuthenticationUsers) {
        const user = userKind === "administrator" ? administrator.data : member.data
        const mfaSetup = await fixtureUserMfaSetup(fetchFromServer, realm.id, user.email, user.password, runtime)
        if (!mfaSetup.success) return await fixtureSetupFailure(databaseDirectory, mfaSetup.errorMessage)
        recoveryCodes.set(userKind, mfaSetup.data.recoveryCode)
      }
      const mfaPolicy = await clients.mfa.mfaPolicySet(realm.id, {
        lockoutDurationMs: 15 * 60 * 1_000,
        maxAttempts: 5,
        mode: "required",
        totpWindow: 1,
      })
      if (!mfaPolicy.success) return await fixtureSetupFailure(databaseDirectory, mfaPolicy.errorMessage)
      for (const userKind of advancedAuthenticationUsers) {
        const user = userKind === "administrator" ? administrator.data : member.data
        const recoveryRequested = await clients.passwords.passwordRecoveryRequest(realm.id, { email: user.email })
        if (!recoveryRequested.success)
          return await fixtureSetupFailure(databaseDirectory, recoveryRequested.errorMessage)
        if (options.emailDelivery === true) {
          const recoveryLink = await fixtureMailLinkWait(fakeMail?.messages ?? [], user.email, "/login/password/reset")
          if (!recoveryLink.success) return await fixtureSetupFailure(databaseDirectory, recoveryLink.errorMessage)
        } else if (recoveryTokens.get(user.email) === undefined) {
          return await fixtureSetupFailure(databaseDirectory, "The E2E recovery token was not delivered.")
        }
      }
      recoveryCode = recoveryCodes.get("member")
      administratorRecoveryCode = recoveryCodes.get("administrator")
    }

    const organizationResponse = await clients.organizations.organizationCreate(realm.id, {
      name: "E2E Organization",
      ownerUserId: administrator.data.id,
    })
    if (!organizationResponse.success)
      return await fixtureSetupFailure(databaseDirectory, organizationResponse.errorMessage)
    const organization = organizationResponse.data.organization

    const domainResponse = await clients.organizations.organizationDomainClaim(realm.id, organization.id, {
      domain: fixtureDiscoveryDomain,
    })
    if (!domainResponse.success) return await fixtureSetupFailure(databaseDirectory, domainResponse.errorMessage)
    const verification = domainResponse.data.domain.verification
    if (verification === undefined)
      return await fixtureSetupFailure(databaseDirectory, "The E2E domain verification token was not returned.")
    domainVerificationToken = verification.recordValue
    const verifiedDomain = await clients.organizations.organizationDomainVerify(
      realm.id,
      organization.id,
      fixtureDiscoveryDomain,
    )
    if (!verifiedDomain.success) return await fixtureSetupFailure(databaseDirectory, verifiedDomain.errorMessage)

    const externalProviderResponse = await clients.externalIdentities.externalIdentityProviderCreate(realm.id, {
      allowAccountCreation: true,
      clientId: "e2e-external-client",
      clientSecret: fixtureExternalProviderSecret,
      displayName: "Deterministic Provider",
      organizationId: organization.id,
      redirectUri: `${fixtureOrigin}/external-callback`,
      type: "github",
    })
    if (!externalProviderResponse.success)
      return await fixtureSetupFailure(databaseDirectory, externalProviderResponse.errorMessage)
    const externalProviderId = externalProviderResponse.data.provider.id
    const externalProviderRedirectUri = `${fixtureOrigin}/realms/${realm.id}/external-identity/${externalProviderId}/callback`
    const externalProviderUpdated = await clients.externalIdentities.externalIdentityProviderUpdate(
      realm.id,
      externalProviderId,
      { redirectUri: externalProviderRedirectUri },
    )
    if (!externalProviderUpdated.success)
      return await fixtureSetupFailure(databaseDirectory, externalProviderUpdated.errorMessage)

    const membershipResponse = await clients.organizations.organizationMembershipCreate(realm.id, organization.id, {
      roles: ["member"],
      userId: member.data.id,
    })
    if (!membershipResponse.success)
      return await fixtureSetupFailure(databaseDirectory, membershipResponse.errorMessage)

    const secondaryOrganizationResponse = await clients.organizations.organizationCreate(realm.id, {
      name: "E2E Secondary Organization",
      ownerUserId: administrator.data.id,
    })
    if (!secondaryOrganizationResponse.success)
      return await fixtureSetupFailure(databaseDirectory, secondaryOrganizationResponse.errorMessage)
    const secondaryOrganization = secondaryOrganizationResponse.data.organization
    const secondaryMembershipResponse = await clients.organizations.organizationMembershipCreate(
      realm.id,
      secondaryOrganization.id,
      { roles: ["member"], userId: member.data.id },
    )
    if (!secondaryMembershipResponse.success)
      return await fixtureSetupFailure(databaseDirectory, secondaryMembershipResponse.errorMessage)

    const machineResponse = await clients.machines.machineUserCreate(realm.id, {
      displayName: "E2E Machine User",
      scopes: ["api.read"],
      userName: "e2e-machine",
    })
    if (!machineResponse.success) return await fixtureSetupFailure(databaseDirectory, machineResponse.errorMessage)

    const projectResponse = await clients.projects.projectCreate(realm.id, {
      authorizationRequired: false,
      name: "E2E Project",
      organizationId: organization.id,
      projectAccessRequired: false,
    })
    if (!projectResponse.success) return await fixtureSetupFailure(databaseDirectory, projectResponse.errorMessage)
    const project = projectResponse.data.project

    const applicationResponse = await clients.projects.projectApplicationCreate(realm.id, project.id, {
      applicationType: "oidc",
      name: "E2E Application",
    })
    if (!applicationResponse.success)
      return await fixtureSetupFailure(databaseDirectory, applicationResponse.errorMessage)

    const oidcRejectResponse = await clients.oidc.oidcClientCreate(realm.id, {
      allowedScopes: ["openid"],
      clientType: "public",
      name: "E2E Reject Client",
      redirectUris: ["http://127.0.0.1:5174/callback"],
      requireConsent: true,
    })
    if (!oidcRejectResponse.success)
      return await fixtureSetupFailure(databaseDirectory, oidcRejectResponse.errorMessage)
    const oidcApproveResponse = await clients.oidc.oidcClientCreate(realm.id, {
      allowedScopes: ["openid"],
      clientType: "public",
      name: "E2E Approve Client",
      redirectUris: ["http://127.0.0.1:5174/callback"],
      requireConsent: true,
    })
    if (!oidcApproveResponse.success)
      return await fixtureSetupFailure(databaseDirectory, oidcApproveResponse.errorMessage)

    let closed = false
    const close = async (): Promise<Result<void>> => {
      if (closed) return resultCreate(undefined)
      const removed = await fixtureDirectoryRemove(databaseDirectory)
      if (removed.success) closed = true
      return removed
    }

    return resultCreate({
      administrator: {
        email: administrator.data.email,
        id: administrator.data.id,
        password: administrator.data.password,
        userName: administrator.data.userName,
      },
      app: application,
      application: {
        id: applicationResponse.data.application.id,
        name: applicationResponse.data.application.name,
      },
      bootstrapAdmin: bootstrapResponse.data.bootstrapAdmin,
      clients,
      databaseDirectory,
      externalProvider: { clientSecret: fixtureExternalProviderSecret, id: externalProviderId },
      fetchFromServer,
      machineUser: {
        clientId: machineResponse.data.clientId,
        clientSecret: machineResponse.data.clientSecret,
        id: machineResponse.data.machineUser.id,
        userName: machineResponse.data.machineUser.userName,
      },
      mailMessages: fakeMail?.messages,
      member: {
        email: member.data.email,
        id: member.data.id,
        password: member.data.password,
        userName: member.data.userName,
      },
      organization: { id: organization.id, name: organization.name },
      secondaryOrganization: { id: secondaryOrganization.id, name: secondaryOrganization.name },
      origin: fixtureOrigin,
      oidcClients: {
        approve: { id: oidcApproveResponse.data.client.id },
        reject: { id: oidcRejectResponse.data.client.id },
      },
      discoveryDomain: fixtureDiscoveryDomain,
      project: { id: project.id, name: project.name },
      realm: { domain: realm.domain, id: realm.id, name: realm.name },
      recoveryCode,
      administratorRecoveryCode,
      close,
    })
  } catch (error) {
    await fixtureDirectoryRemove(databaseDirectory)
    return resultErrorCreate("authworksE2eFixtureCreate", errorMessageGet(error))
  }
}

function fixtureClientsCreate(fetchFromServer: AuthworksE2eFixture["fetchFromServer"]): AuthworksE2eFixtureClients {
  const options = { baseUrl: fixtureOrigin, fetch: fetchFromServer, token: fixtureSystemSecret }
  return {
    externalIdentities: externalIdentityApiClientCreate(options),
    machines: machineUserApiClientCreate(options),
    mfa: mfaApiClientCreate(options),
    oidc: oidcApiClientCreate(options),
    organizations: organizationApiClientCreate(options),
    passwords: passwordApiClientCreate(options),
    projects: projectApiClientCreate(options),
    realms: realmApiClientCreate(options),
    users: userApiClientCreate(options),
  }
}

function externalIdentityProviderPortsCreate(): ExternalIdentityProviderPorts {
  return {
    github: {
      authorizationUrlCreate(configuration, input) {
        const authorization = new URL("https://external-provider.e2e.authworks.test/authorize")
        authorization.searchParams.set("client_id", configuration.clientId)
        authorization.searchParams.set("code_challenge", input.pkceChallenge)
        authorization.searchParams.set("code_challenge_method", "S256")
        authorization.searchParams.set("redirect_uri", configuration.redirectUri)
        authorization.searchParams.set("response_type", "code")
        authorization.searchParams.set("scope", configuration.scopes.join(" "))
        authorization.searchParams.set("state", input.state)
        return resultCreate(authorization.toString())
      },
      callbackExchange(configuration, input) {
        if (configuration.clientSecret !== fixtureExternalProviderSecret || input.code !== "e2e-external-code")
          return Promise.resolve(
            resultErrorCodedCreate(
              "externalIdentityProviderCallback",
              "The deterministic external provider rejected the callback.",
              "external-identities.invalid",
            ),
          )
        return Promise.resolve(
          resultCreate({
            displayName: "E2E External User",
            email: "external@e2e.authworks.test",
            emailVerified: true,
            externalSubject: "e2e-external-subject",
            providerType: "github" as const,
            username: "e2e-external",
          }),
        )
      },
    },
  }
}

async function fixtureUserMfaSetup(
  fetchFromServer: AuthworksE2eFixture["fetchFromServer"],
  realmId: string,
  email: string,
  password: string,
  runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">,
): Promise<Result<{ readonly recoveryCode: string }>> {
  const cookies = new Map<string, string>()
  let csrfToken: string | undefined
  const setupFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : undefined
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase()
    const headers = new Headers(request?.headers ?? init?.headers)
    headers.delete("content-length")
    headers.set("host", fixtureDomain)
    headers.set("origin", fixtureOrigin)
    if (cookies.size > 0) headers.set("cookie", [...cookies.values()].join("; "))
    if (csrfToken !== undefined && !["GET", "HEAD", "OPTIONS"].includes(method)) headers.set("x-csrf-token", csrfToken)
    const body =
      request === undefined || method === "GET" || method === "HEAD" ? init?.body : await request.arrayBuffer()
    const response = await fetchFromServer(request?.url ?? input, { body, headers, method })
    const setCookie = response.headers.get("set-cookie")
    if (setCookie !== null) {
      const cookie = setCookie.split(";", 1)[0] ?? ""
      const separator = cookie.indexOf("=")
      if (separator > 0) cookies.set(cookie.slice(0, separator), cookie)
    }
    return response
  }

  const passwords = passwordApiClientCreate({ baseUrl: fixtureOrigin, fetch: setupFetch })
  const loggedIn = await passwords.passwordLogin(realmId, { identifier: email, password })
  if (!loggedIn.success) return resultErrorCreate("fixtureMemberMfaSetup", loggedIn.errorMessage)

  const csrfResponse = await setupFetch(`${fixtureOrigin}/realms/${realmId}/sessions/csrf`, { method: "GET" })
  if (!csrfResponse.ok) return resultErrorCreate("fixtureMemberMfaSetup", "The E2E CSRF token could not be created.")
  const csrfBody = (await csrfResponse.json()) as { readonly csrfToken?: string }
  if (csrfBody.csrfToken === undefined)
    return resultErrorCreate("fixtureMemberMfaSetup", "The E2E CSRF token was not returned.")
  csrfToken = csrfBody.csrfToken

  const mfa = mfaApiClientCreate({ baseUrl: fixtureOrigin, fetch: setupFetch })
  const enrollment = await mfa.mfaTotpEnrollmentStart(realmId)
  if (!enrollment.success) return resultErrorCreate("fixtureMemberMfaSetup", enrollment.errorMessage)
  const code = fixtureTotpCodeCreate(enrollment.data.secret, runtime.now())
  const confirmed = await mfa.mfaTotpEnrollmentConfirm(realmId, {
    code,
    enrollmentId: enrollment.data.enrollment.id,
  })
  if (!confirmed.success) return resultErrorCreate("fixtureMemberMfaSetup", confirmed.errorMessage)
  const generated = await mfa.mfaRecoveryCodesGenerate(realmId)
  if (!generated.success) return resultErrorCreate("fixtureMemberMfaSetup", generated.errorMessage)
  const recoveryCode = generated.data.codes[0]
  if (recoveryCode === undefined)
    return resultErrorCreate("fixtureMemberMfaSetup", "No E2E recovery code was returned.")
  return resultCreate({ recoveryCode })
}

function e2eEmailGeneratorFetchCreate() {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = new Request(typeof input === "string" ? input : input instanceof URL ? input : input.url, init)
    const body = (await request.json()) as Record<string, unknown>
    const url = typeof body.url === "string" ? body.url : ""
    return Response.json({
      html: `<a href="${url}">${url}</a>`,
      subject: "Authworks E2E message",
      text: url,
    })
  }
}

function fixtureTotpCodeCreate(secret: string, now: number): string {
  const key = fixtureTotpBase32Decode(secret)
  const counter = Math.floor(now / 30_000)
  const message = Buffer.alloc(8)
  let remainder = counter
  for (let index = 7; index >= 0; index -= 1) {
    message[index] = remainder % 256
    remainder = Math.floor(remainder / 256)
  }
  const digest = createHmac("sha1", key).update(message).digest()
  const offset = digest[digest.length - 1]! & 0x0f
  const value =
    ((digest[offset]! & 0x7f) << 24) | (digest[offset + 1]! << 16) | (digest[offset + 2]! << 8) | digest[offset + 3]!
  return String(value % 1_000_000).padStart(6, "0")
}

function fixtureTotpBase32Decode(value: string): Buffer {
  let buffer = 0
  let bits = 0
  const output: number[] = []
  for (const character of value) {
    buffer = (buffer << 5) | "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(character)
    bits += 5
    if (bits >= 8) {
      bits -= 8
      output.push((buffer >>> bits) & 255)
    }
  }
  return Buffer.from(output)
}

async function fixtureDirectoryRemove(directory: string): Promise<Result<void>> {
  try {
    await rm(directory, { force: true, recursive: true })
    return resultCreate(undefined)
  } catch (error) {
    return resultErrorCreate("authworksE2eFixtureClose", errorMessageGet(error))
  }
}

async function fixtureSetupFailure(directory: string, errorMessage: string): Promise<Result<never>> {
  await fixtureDirectoryRemove(directory)
  return resultErrorCreate("authworksE2eFixtureCreate", errorMessage)
}

async function fixtureUserCreate(
  client: AuthworksE2eFixtureClients["passwords"],
  realmId: string,
  suffix: string,
  displayName: string,
  verificationTokens: ReadonlyMap<string, string>,
  mailMessages: readonly MailDeliveryMessage[] | undefined,
  emailDelivery: boolean,
) {
  const email = `${suffix}@${fixtureDomain}`
  const created = await client.passwordRegister(realmId, {
    email,
    password: fixturePassword,
    profile: { displayName },
    userName: `e2e-${suffix}`,
  })
  if (!created.success) return created
  const token = emailDelivery
    ? await fixtureMailLinkTokenWait(mailMessages ?? [], email, "/login/verify-email")
    : resultCreate(verificationTokens.get(email))
  if (!token.success || token.data === undefined)
    return resultErrorCreate("fixtureUserCreate", "The E2E verification token was not delivered.")
  const verified = await client.passwordEmailVerify(realmId, { token: token.data })
  if (!verified.success) return verified
  return resultCreate({ ...verified.data.user, password: fixturePassword })
}

async function fixtureMailLinkTokenWait(
  messages: readonly MailDeliveryMessage[],
  recipient: string,
  pathname: string,
): Promise<Result<string | undefined>> {
  const link = await fixtureMailLinkWait(messages, recipient, pathname)
  if (!link.success) return link
  try {
    return resultCreate(new URL(link.data).searchParams.get("token") ?? undefined)
  } catch (_error) {
    return resultCreate(undefined)
  }
}

async function fixtureMailLinkWait(
  messages: readonly MailDeliveryMessage[],
  recipient: string,
  pathname: string,
): Promise<Result<string>> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const message = messages.find((item) => {
      if (item.to !== recipient) return false
      try {
        return new URL(item.message.text.trim()).pathname === pathname
      } catch (_error) {
        return false
      }
    })
    if (message !== undefined) return resultCreate(message.message.text.trim())
    await new Promise<void>((resolve) => setTimeout(resolve, 5))
  }
  return resultErrorCreate("fixtureMailLinkWait", "The deterministic E2E email link was not delivered.")
}

function errorMessageGet(error: unknown): string {
  return error instanceof Error ? error.message : "The E2E fixture could not be created."
}
