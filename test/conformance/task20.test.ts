import { expect, test } from "bun:test"
import type { Hono } from "hono"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { emailOtpApiClientCreate } from "../../src/features/emailOtp/client/emailOtpApiClientCreate.js"
import { externalIdentityApiClientCreate } from "../../src/features/externalIdentities/client/externalIdentityApiClientCreate.js"
import { impersonationApiClientCreate } from "../../src/features/impersonation/client/impersonationApiClientCreate.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { machineUserApiClientCreate } from "../../src/features/machineUsers/client/machineUserApiClientCreate.js"
import { mfaApiClientCreate } from "../../src/features/mfa/client/mfaApiClientCreate.js"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { passkeyApiClientCreate } from "../../src/features/passkeys/client/passkeyApiClientCreate.js"
import { passwordApiClientCreate } from "../../src/features/passwords/client/passwordApiClientCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { projectApiClientCreate } from "../../src/features/projects/client/projectApiClientCreate.js"
import { sessionApiClientCreate } from "../../src/features/sessions/client/sessionApiClientCreate.js"
import { sessionPasswordCreate } from "../../src/features/sessions/actions/sessionPasswordCreate.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { storageDatabaseOpen, type StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"

const systemSecret = "task-20-system-secret"

type ConformanceFixture = {
  readonly alpha: { readonly id: string; readonly domain: string; readonly adminSecret: string }
  readonly beta: { readonly id: string; readonly domain: string; readonly adminSecret: string }
  readonly app: Hono
  readonly database: StorageDatabase
  readonly fetchFromServer: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  readonly systemBaseUrl: string
}

async function withFixture<T>(operation: (fixture: ConformanceFixture) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-task-20-"))
  const databasePath = join(directory, "zitadel.sqlite")
  const created = serverApplicationCreate({
    databasePath,
    publicOrigin: "https://alpha.task-20.example",
    systemSecret,
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(created.errorMessage)
  }
  const app = created.data
  const opened = storageDatabaseOpen(databasePath)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }

  const fetchFromServer = async (input: string | URL | Request, init?: RequestInit) =>
    app.request(input instanceof Request ? input : input.toString(), init)
  const systemBaseUrl = "https://system.task-20.example"
  const realms = realmApiClientCreate({ baseUrl: systemBaseUrl, fetch: fetchFromServer, token: systemSecret })

  try {
    const alpha = await realmCreateThroughServer(realms, "alpha.task-20.example", "Alpha")
    const beta = await realmCreateThroughServer(realms, "beta.task-20.example", "Beta")
    const alphaAdmin = await realmBootstrapThroughServer(realms, alpha.id)
    const betaAdmin = await realmBootstrapThroughServer(realms, beta.id)
    return await operation({
      alpha: { ...alpha, adminSecret: alphaAdmin },
      app,
      beta: { ...beta, adminSecret: betaAdmin },
      database: opened.data,
      fetchFromServer,
      systemBaseUrl,
    })
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function realmCreateThroughServer(
  client: ReturnType<typeof realmApiClientCreate>,
  domain: string,
  name: string,
): Promise<{ readonly domain: string; readonly id: string }> {
  const created = await client.realmCreate({ domain, name })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return { domain, id: created.data.realm.id }
}

async function realmBootstrapThroughServer(client: ReturnType<typeof realmApiClientCreate>, realmId: string) {
  const bootstrap = await client.realmBootstrapAdminCreate(realmId)
  expect(bootstrap.success).toBe(true)
  if (!bootstrap.success) throw new Error(bootstrap.errorMessage)
  return bootstrap.data.bootstrapAdmin.secret
}

function clientFetch(fixture: ConformanceFixture, baseUrl: string) {
  return async (input: string | URL | Request, init?: RequestInit) =>
    fixture.app.request(input instanceof Request ? input : input.toString(), init)
}

async function createSession(database: StorageDatabase, realmId: string, domain: string) {
  const context = realmTenantContextCreate(realmId, "anonymous")
  let verificationToken = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `${domain.replaceAll(".", "-")}@example.com`,
      password: "Correct Horse 12",
      profile: { displayName: "Task 20 user" },
      userName: domain.replaceAll(".", "-"),
    },
    realmId,
    onVerificationToken: ({ token }) => {
      verificationToken = token
    },
  })
  expect(registered.success).toBe(true)
  expect(passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId }).success).toBe(true)
  const login = passwordLogin({
    context,
    database,
    input: { identifier: domain.replaceAll(".", "-"), password: "Correct Horse 12" },
    realmId,
    sessionCreate: sessionPasswordCreate(),
  })
  expect(login.success).toBe(true)
  if (!login.success || login.data.session === undefined) throw new Error("The task 20 session was not created.")
  return { token: login.data.session.token, userId: login.data.authentication.userId }
}

test("composed clients preserve tenant and organization boundaries across features", async () => {
  await withFixture(async (fixture) => {
    const system = { baseUrl: fixture.systemBaseUrl, fetch: fixture.fetchFromServer, token: systemSecret }
    const users = userApiClientCreate(system)
    const organizations = organizationApiClientCreate(system)
    const projects = projectApiClientCreate(system)
    const oidc = oidcApiClientCreate(system)
    const machines = machineUserApiClientCreate(system)

    const alphaUser = await users.userCreate(fixture.alpha.id, {
      email: "alpha-user@task-20.example",
      profile: { displayName: "Alpha user" },
      userName: "alpha-user",
    })
    const betaUser = await users.userCreate(fixture.beta.id, {
      email: "beta-user@task-20.example",
      profile: { displayName: "Beta user" },
      userName: "beta-user",
    })
    expect(alphaUser.success && betaUser.success).toBe(true)
    if (!alphaUser.success || !betaUser.success) return

    const alphaOrganization = await organizations.organizationCreate(fixture.alpha.id, {
      name: "Alpha organization",
      ownerUserId: alphaUser.data.user.id,
    })
    const betaOrganization = await organizations.organizationCreate(fixture.beta.id, {
      name: "Beta organization",
      ownerUserId: betaUser.data.user.id,
    })
    expect(alphaOrganization.success && betaOrganization.success).toBe(true)
    if (!alphaOrganization.success || !betaOrganization.success) return

    const crossOrganizationProject = await projects.projectCreate(fixture.alpha.id, {
      authorizationRequired: false,
      name: "Cross-tenant project",
      organizationId: betaOrganization.data.organization.id,
      projectAccessRequired: false,
    })
    expect(crossOrganizationProject.success).toBe(false)
    expect((await organizations.organizationGet(fixture.alpha.id, betaOrganization.data.organization.id)).success).toBe(
      false,
    )

    const project = await projects.projectCreate(fixture.alpha.id, {
      authorizationRequired: false,
      name: "Alpha project",
      organizationId: alphaOrganization.data.organization.id,
      projectAccessRequired: false,
    })
    expect(project.success).toBe(true)

    const oidcClient = await oidc.oidcClientCreate(fixture.alpha.id, {
      clientType: "confidential",
      name: "Alpha OIDC client",
      redirectUris: ["https://client.task-20.example/callback"],
      trusted: true,
    })
    expect(oidcClient.success).toBe(true)
    const machine = await machines.machineUserCreate(fixture.alpha.id, {
      displayName: "Alpha machine",
      scopes: ["api.read"],
      userName: "alpha-machine",
    })
    expect(machine.success).toBe(true)
    if (!machine.success) return
    const credential = await machines.machinePersonalAccessTokenCreate(fixture.alpha.id, machine.data.machineUser.id, {
      machineUserId: machine.data.machineUser.id,
      name: "Alpha PAT",
      scopes: ["api.read"],
    })
    expect(credential.success).toBe(true)
    if (!credential.success) return

    const alphaBaseUrl = `https://${fixture.alpha.domain}`
    const betaBaseUrl = `https://${fixture.beta.domain}`
    const alphaToken = fixture.alpha.adminSecret
    const alphaFetch = clientFetch(fixture, alphaBaseUrl)
    const betaFetch = clientFetch(fixture, betaBaseUrl)

    const alphaPassword = passwordApiClientCreate({ baseUrl: alphaBaseUrl, fetch: alphaFetch })
    const betaPathWithAlphaHost = passwordApiClientCreate({ baseUrl: alphaBaseUrl, fetch: alphaFetch })
    expect((await alphaPassword.passwordPolicyGet(fixture.alpha.id)).success).toBe(true)
    expect((await betaPathWithAlphaHost.passwordPolicyGet(fixture.beta.id)).success).toBe(false)

    const emailOtp = emailOtpApiClientCreate({ baseUrl: alphaBaseUrl, fetch: alphaFetch })
    expect((await emailOtp.emailOtpStart(fixture.alpha.id, { email: "unknown@task-20.example" })).success).toBe(true)
    expect((await emailOtp.emailOtpStart(fixture.beta.id, { email: "unknown@task-20.example" })).success).toBe(false)

    const external = externalIdentityApiClientCreate({ baseUrl: alphaBaseUrl, fetch: alphaFetch })
    expect((await external.externalIdentityProviderPublicList(fixture.alpha.id)).success).toBe(true)
    expect((await external.externalIdentityProviderPublicList(fixture.beta.id)).success).toBe(false)

    const passkeys = passkeyApiClientCreate({ baseUrl: alphaBaseUrl, fetch: alphaFetch })
    const passkeyStart = await passkeys.passkeyAuthenticationStart(fixture.alpha.id)
    expect(passkeyStart.success).toBe(true)
    expect((await passkeys.passkeyAuthenticationStart(fixture.beta.id)).success).toBe(false)

    const alphaOidc = oidcApiClientCreate({ baseUrl: alphaBaseUrl, fetch: alphaFetch })
    const betaOidc = oidcApiClientCreate({ baseUrl: betaBaseUrl, fetch: betaFetch })
    const alphaDiscovery = await alphaOidc.oidcDiscoveryGet()
    const betaDiscovery = await betaOidc.oidcDiscoveryGet()
    expect(alphaDiscovery.success && betaDiscovery.success).toBe(true)
    if (alphaDiscovery.success && betaDiscovery.success) {
      expect(alphaDiscovery.data.issuer).toContain(fixture.alpha.domain)
      expect(betaDiscovery.data.issuer).toContain(fixture.beta.domain)
    }

    const sessions = await createSession(fixture.database, fixture.alpha.id, fixture.alpha.domain)
    const alphaSessions = sessionApiClientCreate({ baseUrl: alphaBaseUrl, fetch: alphaFetch, token: sessions.token })
    const betaHostWithAlphaSession = sessionApiClientCreate({
      baseUrl: betaBaseUrl,
      fetch: betaFetch,
      token: sessions.token,
    })
    expect((await alphaSessions.sessionCurrent(fixture.alpha.id)).success).toBe(true)
    expect((await betaHostWithAlphaSession.sessionCurrent(fixture.alpha.id)).success).toBe(false)
    expect((await alphaSessions.sessionCurrent(fixture.beta.id)).success).toBe(false)

    const alphaMfa = mfaApiClientCreate({ baseUrl: alphaBaseUrl, fetch: alphaFetch, token: sessions.token })
    const betaMfa = mfaApiClientCreate({ baseUrl: betaBaseUrl, fetch: betaFetch, token: sessions.token })
    const mfaEnrollment = await alphaMfa.mfaTotpEnrollmentStart(fixture.alpha.id)
    expect(mfaEnrollment.success).toBe(true)
    expect((await betaMfa.mfaTotpEnrollmentStart(fixture.alpha.id)).success).toBe(false)

    const machineWithCredential = machineUserApiClientCreate({
      baseUrl: alphaBaseUrl,
      fetch: alphaFetch,
      token: credential.data.secret,
    })
    const betaMachineWithCredential = machineUserApiClientCreate({
      baseUrl: betaBaseUrl,
      fetch: betaFetch,
      token: credential.data.secret,
    })
    expect((await machineWithCredential.machineProtectedApiGet(fixture.alpha.id)).success).toBe(true)
    expect((await betaMachineWithCredential.machineProtectedApiGet(fixture.alpha.id)).success).toBe(false)
    expect((await betaMachineWithCredential.machineProtectedApiGet(fixture.beta.id)).success).toBe(false)

    const events = fixture.database.db.select().from(storageEventTable).all()
    expect(events.map((event) => event.position)).toEqual(events.map((_event, index) => index + 1))
    expect(JSON.stringify(events)).not.toContain(credential.data.secret)
    if (oidcClient.success && oidcClient.data.clientSecret !== undefined)
      expect(JSON.stringify(events)).not.toContain(oidcClient.data.clientSecret)
    expect(JSON.stringify(events)).not.toContain(fixture.alpha.adminSecret)
    if (passkeyStart.success) {
      expect(JSON.stringify(events)).not.toContain(passkeyStart.data.token)
      expect(JSON.stringify(events)).not.toContain(passkeyStart.data.options.challenge)
    }
    if (mfaEnrollment.success) expect(JSON.stringify(events)).not.toContain(mfaEnrollment.data.secret)
    expect(JSON.stringify(await machineWithCredential.machineProtectedApiGet(fixture.alpha.id))).not.toContain(
      credential.data.secret,
    )
    expect(alphaToken).toHaveLength(43)
  })
})

test("composed password registration rolls back feature state and events together", async () => {
  await withFixture(async (fixture) => {
    const baseUrl = `https://${fixture.alpha.domain}`
    const passwords = passwordApiClientCreate({
      baseUrl,
      fetch: clientFetch(fixture, baseUrl),
    })
    const beforeUsers = fixture.database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()
    const beforeCredentials = fixture.database.sqlite.query("SELECT COUNT(*) AS count FROM password_credentials").get()
    const beforeEvents = fixture.database.sqlite.query("SELECT COUNT(*) AS count FROM events").get()
    fixture.database.sqlite.run(
      "CREATE TRIGGER task_20_reject_events BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT, 'task 20 event rejection'); END",
    )

    const rejected = await passwords.passwordRegister(fixture.alpha.id, {
      email: "atomic@task-20.example",
      password: "Correct Horse 12",
      profile: {},
      userName: "atomic-user",
    })
    expect(rejected.success).toBe(false)
    expect(fixture.database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()).toEqual(beforeUsers)
    expect(fixture.database.sqlite.query("SELECT COUNT(*) AS count FROM password_credentials").get()).toEqual(
      beforeCredentials,
    )
    expect(fixture.database.sqlite.query("SELECT COUNT(*) AS count FROM events").get()).toEqual(beforeEvents)

    fixture.database.sqlite.run("DROP TRIGGER task_20_reject_events")
    const accepted = await passwords.passwordRegister(fixture.alpha.id, {
      email: "atomic@task-20.example",
      password: "Correct Horse 12",
      profile: {},
      userName: "atomic-user",
    })
    expect(accepted).toEqual({ data: { accepted: true, verificationRequired: true }, success: true })
  })
})

test("all public API clients reject malformed success responses and preserve transport errors", async () => {
  let captured: Request | undefined
  const fetchInvalid = async (input: string | URL | Request, init?: RequestInit) => {
    captured =
      input instanceof Request ? new Request(input) : new Request(input instanceof URL ? input.toString() : input, init)
    return new Response(JSON.stringify({}), { headers: { "content-type": "application/json" }, status: 200 })
  }
  const options = {
    baseUrl: "https://identity.task-20.example",
    fetch: fetchInvalid,
    systemToken: "client-token",
    token: "client-token",
  }
  const calls = [
    {
      call: () => realmApiClientCreate(options).realmList(),
      feature: "realms",
      method: "GET",
      path: "/system/realms",
    },
    {
      call: () => userApiClientCreate(options).userList("realm"),
      feature: "users",
      method: "GET",
      path: "/system/realms/realm/users",
    },
    {
      call: () => organizationApiClientCreate(options).organizationList("realm"),
      feature: "organizations",
      method: "GET",
      path: "/system/realms/realm/organizations",
    },
    {
      call: () => projectApiClientCreate(options).projectList("realm"),
      feature: "projects",
      method: "GET",
      path: "/system/realms/realm/projects",
    },
    {
      call: () => passwordApiClientCreate(options).passwordPolicyGet("realm"),
      feature: "passwords",
      method: "GET",
      path: "/realms/realm/password-policy",
    },
    {
      call: () => sessionApiClientCreate(options).sessionCurrent("realm"),
      feature: "sessions",
      method: "GET",
      path: "/realms/realm/sessions/current",
    },
    {
      call: () => emailOtpApiClientCreate(options).emailOtpStart("realm", { email: "user@example.com" }),
      feature: "emailOtp",
      method: "POST",
      path: "/realms/realm/email-otp/start",
    },
    {
      call: () => externalIdentityApiClientCreate(options).externalIdentityProviderPublicList("realm"),
      feature: "externalIdentities",
      method: "GET",
      path: "/realms/realm/external-identity-providers",
    },
    {
      call: () => oidcApiClientCreate(options).oidcDiscoveryGet(),
      feature: "oidc",
      method: "GET",
      path: "/.well-known/openid-configuration",
    },
    {
      call: () => mfaApiClientCreate(options).mfaPolicyGet("realm"),
      feature: "mfa",
      method: "GET",
      path: "/realms/realm/mfa-policy",
    },
    {
      call: () => passkeyApiClientCreate(options).passkeyAuthenticationStart("realm"),
      feature: "passkeys",
      method: "POST",
      path: "/realms/realm/passkeys/authentication/start",
    },
    {
      call: () => machineUserApiClientCreate(options).machineUserList("realm"),
      feature: "machineUsers",
      method: "GET",
      path: "/system/realms/realm/machine-users",
    },
    {
      call: () => impersonationApiClientCreate(options).impersonationEnd("realm", "session"),
      feature: "impersonation",
      method: "POST",
      path: "/realms/realm/impersonations/session/end",
    },
  ]

  for (const entry of calls) {
    const result = await entry.call()
    expect(result.success, entry.feature).toBe(false)
    expect(captured, entry.feature).toBeDefined()
    expect(captured?.method, entry.feature).toBe(entry.method)
    expect(new URL(captured?.url ?? "https://invalid").pathname, entry.feature).toBe(entry.path)
    expect(captured?.headers.get("accept"), entry.feature).toBe("application/json")
    expect(captured?.headers.get("authorization"), entry.feature).toBe(
      entry.feature === "emailOtp" ? null : "Bearer client-token",
    )
  }

  const unreachable = await realmApiClientCreate({
    baseUrl: "http://127.0.0.1:1",
    token: "client-token",
  }).realmList()
  expect(unreachable).toEqual({
    code: "platform.unreachable",
    errorMessage: "The server could not be reached.",
    op: "realmApiClientRequest",
    success: false,
  })
})
