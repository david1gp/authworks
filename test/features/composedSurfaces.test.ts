import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { emailOtpApiClientCreate } from "../../src/features/emailOtp/client/emailOtpApiClientCreate.js"
import { externalIdentityApiClientCreate } from "../../src/features/externalIdentities/client/externalIdentityApiClientCreate.js"
import { impersonationApiClientCreate } from "../../src/features/impersonation/client/impersonationApiClientCreate.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"
import { machineUserApiClientCreate } from "../../src/features/machineUsers/client/machineUserApiClientCreate.js"
import { mfaApiClientCreate } from "../../src/features/mfa/client/mfaApiClientCreate.js"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { passkeyApiClientCreate } from "../../src/features/passkeys/client/passkeyApiClientCreate.js"
import { passwordApiClientCreate } from "../../src/features/passwords/client/passwordApiClientCreate.js"
import { projectApiClientCreate } from "../../src/features/projects/client/projectApiClientCreate.js"
import { sessionApiClientCreate } from "../../src/features/sessions/client/sessionApiClientCreate.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"

test("all feature clients round-trip through the composed server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-composed-surfaces-"))
  const domain = "composed-surfaces.example.com"
  const systemSecret = "composed-system-secret"
  try {
    const app = serverApplicationCreate({
      databasePath: join(directory, "zitadel.sqlite"),
      publicOrigin: `https://${domain}`,
      systemSecret,
    })
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
