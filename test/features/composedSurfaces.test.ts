import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { emailOtpApiClientCreate } from "../../src/features/emailOtp/client/emailOtpApiClientCreate.js"
import { eventApiClientCreate } from "../../src/features/events/client/eventApiClientCreate.js"
import { externalIdentityApiClientCreate } from "../../src/features/externalIdentities/client/externalIdentityApiClientCreate.js"
import { impersonationApiClientCreate } from "../../src/features/impersonation/client/impersonationApiClientCreate.js"
import { machineUserApiClientCreate } from "../../src/features/machineUsers/client/machineUserApiClientCreate.js"
import { mfaApiClientCreate } from "../../src/features/mfa/client/mfaApiClientCreate.js"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { passkeyApiClientCreate } from "../../src/features/passkeys/client/passkeyApiClientCreate.js"
import { passwordApiClientCreate } from "../../src/features/passwords/client/passwordApiClientCreate.js"
import { projectApiClientCreate } from "../../src/features/projects/client/projectApiClientCreate.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"
import { sessionApiClientCreate } from "../../src/features/sessions/client/sessionApiClientCreate.js"
import { sessionBrowserModeHeaderName } from "../../src/features/sessions/public/sessionBrowserModeHeaderName.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"

test("all feature clients round-trip through the composed server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-composed-surfaces-"))
  const domain = "composed-surfaces.example.com"
  const systemSecret = "composed-system-secret"
  try {
    const created = serverApplicationCreate({
      databasePath: join(directory, "authworks.sqlite"),
      publicOrigin: `https://${domain}`,
      systemSecret,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const app = created.data
    const fetchFromServer = async (input: string | URL | Request, init?: RequestInit) =>
      app.request(input instanceof Request ? input : input.toString(), init)
    const baseUrl = `https://${domain}`
    const system = { baseUrl, fetch: fetchFromServer, token: systemSecret }

    const realms = realmApiClientCreate(system)
    const createdRealm = await realms.realmCreate({ domain, name: "Composed surfaces" })
    expect(createdRealm.success).toBe(true)
    if (!createdRealm.success) return
    const realmId = createdRealm.data.realm.id
    expect((await realms.realmList()).success).toBe(true)
    expect((await realms.realmGet(realmId)).success).toBe(true)
    const events = eventApiClientCreate(system)
    expect((await events.eventList(realmId)).success).toBe(true)
    const bootstrap = await realms.realmBootstrapAdminCreate(realmId)
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    const tenantEvents = eventApiClientCreate({
      baseUrl,
      fetch: fetchFromServer,
      token: bootstrap.data.bootstrapAdmin.secret,
    })
    expect((await tenantEvents.eventTenantList(realmId)).success).toBe(true)

    const users = userApiClientCreate(system)
    const createdUser = await users.userCreate(realmId, {
      email: "surface-user@example.com",
      profile: { displayName: "Surface User" },
      userName: "surface-user",
    })
    expect(createdUser.success).toBe(true)
    if (!createdUser.success) return
    const userId = createdUser.data.user.id
    expect((await users.userList(realmId)).success).toBe(true)

    const organizations = organizationApiClientCreate(system)
    const createdOrganization = await organizations.organizationCreate(realmId, {
      name: "Surface organization",
      ownerUserId: userId,
    })
    expect(createdOrganization.success).toBe(true)
    if (!createdOrganization.success) return
    const organizationId = createdOrganization.data.organization.id
    expect((await organizations.organizationList(realmId)).success).toBe(true)
    expect((await organizations.organizationRoleList()).success).toBe(true)

    const passwords = passwordApiClientCreate(system)
    expect(
      (
        await passwords.passwordRegister(realmId, {
          email: "surface-password@example.com",
          password: "Correct Horse 12",
          profile: {},
          userName: "surface-password",
        })
      ).success,
    ).toBe(true)
    expect((await passwords.passwordPolicyGet(realmId)).success).toBe(true)

    const emailOtp = emailOtpApiClientCreate({ baseUrl, fetch: fetchFromServer })
    expect((await emailOtp.emailOtpStart(realmId, { email: "unknown@example.com" })).success).toBe(true)

    const externalIdentities = externalIdentityApiClientCreate(system)
    expect(
      (
        await externalIdentities.externalIdentityProviderCreate(realmId, {
          allowAccountCreation: true,
          clientId: "surface-client",
          clientSecret: "surface-secret",
          displayName: "Surface provider",
          redirectUri: "https://client.example/callback",
          scopes: ["openid"],
          type: "google",
        })
      ).success,
    ).toBe(true)
    expect((await externalIdentities.externalIdentityProviderList(realmId)).success).toBe(true)

    const oidc = oidcApiClientCreate(system)
    expect(
      (
        await oidc.oidcClientCreate(realmId, {
          clientType: "public",
          name: "Surface OIDC client",
          redirectUris: ["https://client.example/callback"],
        })
      ).success,
    ).toBe(true)
    expect((await oidc.oidcClientList(realmId)).success).toBe(true)
    expect((await oidc.oidcDiscoveryGet()).success).toBe(true)
    expect((await oidc.oidcJwksGet()).success).toBe(true)

    const mfa = mfaApiClientCreate({ baseUrl, fetch: fetchFromServer, systemToken: systemSecret })
    expect((await mfa.mfaPolicyGet(realmId)).success).toBe(true)

    const passkeys = passkeyApiClientCreate({ baseUrl, fetch: fetchFromServer })
    expect((await passkeys.passkeyAuthenticationStart(realmId)).success).toBe(true)

    const machines = machineUserApiClientCreate(system)
    const machineUser = await machines.machineUserCreate(realmId, {
      displayName: "Surface machine",
      scopes: ["api.read"],
      userName: "surface-machine",
    })
    expect(machineUser.success).toBe(true)
    expect((await machines.machineUserList(realmId)).success).toBe(true)

    const projects = projectApiClientCreate(system)
    const project = await projects.projectCreate(realmId, {
      authorizationRequired: false,
      name: "Surface project",
      organizationId,
      projectAccessRequired: false,
    })
    expect(project.success).toBe(true)
    if (!project.success) return
    expect((await projects.projectList(realmId)).success).toBe(true)

    const sessions = sessionApiClientCreate({ baseUrl, fetch: fetchFromServer, token: systemSecret })
    expect((await sessions.sessionCurrent(realmId)).success).toBe(false)
    expect((await sessions.sessionMeList(realmId)).success).toBe(false)
    expect((await sessions.sessionMeRevoke(realmId, "missing-session")).success).toBe(false)
    expect((await sessions.sessionMeRevokeAll(realmId)).success).toBe(false)
    expect((await users.userMeGet(realmId)).success).toBe(false)
    expect((await users.userMeAuthenticationMethodsGet(realmId)).success).toBe(false)
    expect((await users.userMeProfileUpdate(realmId, { displayName: "Self" })).success).toBe(false)
    expect((await users.userMeDelete(realmId)).success).toBe(false)
    expect(
      (
        await passwords.passwordMeChange(realmId, {
          currentPassword: "Correct Horse 12",
          newPassword: "New Correct Horse 12",
        })
      ).success,
    ).toBe(false)

    const impersonation = impersonationApiClientCreate({ baseUrl, fetch: fetchFromServer, token: systemSecret })
    expect(
      (
        await impersonation.impersonationStart(realmId, {
          durationSeconds: 60,
          reason: "surface verification",
          targetUserId: userId,
        })
      ).success,
    ).toBe(false)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("the composed server switches credential responses only for marked browser requests", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-composed-browser-mode-"))
  const domain = "composed-browser-mode.example.com"
  const systemSecret = "composed-browser-mode-secret"
  let verificationToken = ""
  try {
    const created = serverApplicationCreate({
      browserMode: true,
      databasePath: join(directory, "authworks.sqlite"),
      onVerificationToken: ({ token }) => {
        verificationToken = token
      },
      publicOrigin: `https://${domain}`,
      systemSecret,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const app = created.data
    const fetchFromServer = async (input: string | URL | Request, init?: RequestInit) =>
      app.request(input instanceof Request ? input : input.toString(), init)
    const baseUrl = `https://${domain}`
    const realms = realmApiClientCreate({ baseUrl, fetch: fetchFromServer, token: systemSecret })
    const createdRealm = await realms.realmCreate({ domain, name: "Composed browser mode" })
    expect(createdRealm.success).toBe(true)
    if (!createdRealm.success) return
    const passwords = passwordApiClientCreate({ baseUrl, fetch: fetchFromServer })
    const registered = await passwords.passwordRegister(createdRealm.data.realm.id, {
      email: "browser-mode@composed.example",
      password: "Correct Horse 12",
      profile: { displayName: "Composed browser mode" },
      userName: "composed-browser-mode",
    })
    expect(registered.success).toBe(true)
    expect(verificationToken).toHaveLength(43)
    const verified = await passwords.passwordEmailVerify(createdRealm.data.realm.id, { token: verificationToken })
    expect(verified.success).toBe(true)
    const path = `/realms/${createdRealm.data.realm.id}/password/login`
    const body = JSON.stringify({ identifier: "composed-browser-mode", password: "Correct Horse 12" })
    const marked = await fetchFromServer(`${baseUrl}${path}`, {
      body,
      headers: { "content-type": "application/json", [sessionBrowserModeHeaderName]: "true" },
      method: "POST",
    })
    expect(marked.status).toBe(200)
    expect(marked.headers.get("set-cookie")).toContain("HttpOnly")
    expect(((await marked.json()) as { session?: unknown }).session).toBeUndefined()

    const unmarked = await fetchFromServer(`${baseUrl}${path}`, {
      body,
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    expect(unmarked.status).toBe(200)
    expect(unmarked.headers.get("set-cookie")).toBeNull()
    expect(((await unmarked.json()) as { session?: { token?: string } }).session?.token).toHaveLength(43)

    const invalid = await fetchFromServer(`${baseUrl}${path}`, {
      body,
      headers: { "content-type": "application/json", [sessionBrowserModeHeaderName]: "invalid" },
      method: "POST",
    })
    expect(invalid.status).toBe(200)
    expect(invalid.headers.get("set-cookie")).toBeNull()
    expect(((await invalid.json()) as { session?: { token?: string } }).session?.token).toHaveLength(43)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})
