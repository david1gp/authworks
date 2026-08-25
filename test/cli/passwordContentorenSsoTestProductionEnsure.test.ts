import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { passwordApiClientCreate } from "../../src/features/passwords/client/passwordApiClientCreate.js"
import { passwordContentorenSsoTestProductionEnsure } from "../../src/features/passwords/cli/passwordContentorenSsoTestProductionEnsure.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"

const productionOrigin = "https://authworks.contentoren.de"
const systemSecret = "production-system-secret-ssotest-0001"
const privateEmail = "private.ssotest@example.invalid"
const privatePassword = "Private-fixture-password-100!"
const replacementPassword = "Replacement-fixture-password-200!"

test("Contentoren ssotest ensure creates and reuses an active verified member account", async () => {
  const fixture = await productionFixtureCreate()
  try {
    const first = await fixture.ensure(privatePassword)
    expect(first).toEqual({ data: { status: "created" }, success: true })
    const users = await fixture.users.userList(fixture.realmId)
    expect(users.success).toBe(true)
    if (!users.success) return
    expect(users.data.items).toHaveLength(1)
    const user = users.data.items[0]
    expect(user?.userName).toBe("ssotest")
    expect(user?.emailVerified).toBe(true)
    expect(user?.registrationVerifiedAt).toBeNumber()
    expect(user?.state).toBe("active")
    if (user === undefined) return
    const unauthorized = await passwordApiClientCreate({
      baseUrl: productionOrigin,
      fetch: fixture.fetch,
    }).passwordCredentialReplace(fixture.realmId, user.id, { password: replacementPassword })
    expect(unauthorized.success).toBe(false)
    expect(JSON.stringify(unauthorized)).not.toContain(replacementPassword)
    const memberships = await fixture.organizations.organizationMembershipList(fixture.realmId, fixture.organizationId)
    expect(memberships.success).toBe(true)
    if (memberships.success) expect(memberships.data.items).toEqual([expect.objectContaining({ roles: ["member"] })])
    const login = await fixture.passwords.passwordLogin(fixture.realmId, {
      identifier: "ssotest",
      organizationId: fixture.organizationId,
      password: privatePassword,
    })
    expect(login.success).toBe(true)
    expect(await fixture.ensure(privatePassword)).toEqual({ data: { status: "reused" }, success: true })
  } finally {
    await fixture.close()
  }
})

test("Contentoren ssotest ensure replaces the password without disclosing either secret", async () => {
  const fixture = await productionFixtureCreate()
  try {
    expect((await fixture.ensure(privatePassword)).success).toBe(true)
    const replaced = await fixture.ensure(replacementPassword)
    expect(replaced).toEqual({ data: { status: "updated" }, success: true })
    expect(JSON.stringify(replaced)).not.toContain(privateEmail)
    expect(JSON.stringify(replaced)).not.toContain(privatePassword)
    expect(JSON.stringify(replaced)).not.toContain(replacementPassword)
    expect(JSON.stringify(replaced)).not.toContain(systemSecret)
    expect(
      (
        await fixture.passwords.passwordLogin(fixture.realmId, {
          identifier: "ssotest",
          organizationId: fixture.organizationId,
          password: privatePassword,
        })
      ).success,
    ).toBe(false)
    expect(
      (
        await fixture.passwords.passwordLogin(fixture.realmId, {
          identifier: "ssotest",
          organizationId: fixture.organizationId,
          password: replacementPassword,
        })
      ).success,
    ).toBe(true)
  } finally {
    await fixture.close()
  }
})

test("Contentoren ssotest ensure converges a non-elevated membership and refuses multiple memberships", async () => {
  const fixture = await productionFixtureCreate()
  try {
    expect((await fixture.ensure(privatePassword)).success).toBe(true)
    const users = await fixture.users.userList(fixture.realmId)
    const memberships = await fixture.organizations.organizationMembershipList(fixture.realmId, fixture.organizationId)
    if (
      !users.success ||
      !memberships.success ||
      users.data.items[0] === undefined ||
      memberships.data.items[0] === undefined
    )
      return
    const user = users.data.items[0]
    const membership = memberships.data.items[0]
    expect(
      (
        await fixture.organizations.organizationMembershipUpdate(
          fixture.realmId,
          fixture.organizationId,
          membership.id,
          { roles: ["guest"] },
        )
      ).success,
    ).toBe(true)
    expect(await fixture.ensure(privatePassword)).toEqual({ data: { status: "updated" }, success: true })
    const other = await fixture.organizations.organizationCreate(fixture.realmId, { name: "Other" })
    expect(other.success).toBe(true)
    if (!other.success) return
    expect(
      (
        await fixture.organizations.organizationMembershipCreate(fixture.realmId, other.data.organization.id, {
          roles: ["guest"],
          userId: user.id,
        })
      ).success,
    ).toBe(true)
    const ambiguous = await fixture.ensure(replacementPassword)
    expect(ambiguous.success).toBe(false)
    if (!ambiguous.success) expect(ambiguous.errorMessage).toContain("ambiguous organization memberships")
  } finally {
    await fixture.close()
  }
})

test("Contentoren ssotest ensure refuses elevated, ambiguous, and cross-realm identities before reset", async () => {
  const fixture = await productionFixtureCreate()
  try {
    expect((await fixture.ensure(privatePassword)).success).toBe(true)
    const memberships = await fixture.organizations.organizationMembershipList(fixture.realmId, fixture.organizationId)
    if (!memberships.success || memberships.data.items[0] === undefined) return
    const membership = memberships.data.items[0]
    expect(
      (
        await fixture.organizations.organizationMembershipUpdate(
          fixture.realmId,
          fixture.organizationId,
          membership.id,
          { roles: ["admin"] },
        )
      ).success,
    ).toBe(true)
    const elevated = await fixture.ensure(replacementPassword)
    expect(elevated.success).toBe(false)
    if (!elevated.success) expect(elevated.errorMessage).toContain("elevated access")
    expect(
      (
        await fixture.passwords.passwordLogin(fixture.realmId, {
          identifier: "ssotest",
          organizationId: fixture.organizationId,
          password: privatePassword,
        })
      ).success,
    ).toBe(true)

    const otherRealm = await fixture.realms.realmCreate({ domain: "other.example.invalid", name: "Other realm" })
    expect(otherRealm.success).toBe(true)
    if (!otherRealm.success) return
    const crossRealm = await fixture.users.userCreate(otherRealm.data.realm.id, {
      email: "other.private@example.invalid",
      profile: {},
      userName: "ssotest",
    })
    expect(crossRealm.success).toBe(true)
    const ambiguous = await fixture.ensure(privatePassword)
    expect(ambiguous.success).toBe(false)
    if (!ambiguous.success) expect(ambiguous.errorMessage).toContain("More than one human")
  } finally {
    await fixture.close()
  }
})

test("Contentoren ssotest ensure refuses ambiguous Contentoren organizations without creating a human", async () => {
  const fixture = await productionFixtureCreate()
  try {
    const listed = await fixture.organizations.organizationList(fixture.realmId)
    expect(listed.success).toBe(true)
    if (!listed.success || listed.data.items[0] === undefined) return
    const organization = listed.data.items[0]
    const fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init)
      if (
        request.method === "GET" &&
        new URL(request.url).pathname === `/system/realms/${fixture.realmId}/organizations`
      )
        return Response.json({
          items: [organization, { ...organization, id: fixtureUuidAlter(organization.id) }],
        })
      return await fixture.fetch(request)
    }
    const ambiguous = await passwordContentorenSsoTestProductionEnsure({
      email: privateEmail,
      fetch,
      password: privatePassword,
      token: systemSecret,
    })
    expect(ambiguous.success).toBe(false)
    if (!ambiguous.success) expect(ambiguous.errorMessage).toContain("More than one Contentoren organization")
    const users = await fixture.users.userList(fixture.realmId)
    expect(users.success).toBe(true)
    if (users.success) expect(users.data.items).toHaveLength(0)
  } finally {
    await fixture.close()
  }
})

test("Contentoren ssotest command rejects malformed private input without disclosure", async () => {
  const malformedPassword = "private-value-with-newline\n"
  const child = Bun.spawn(["bun", "src/outputs/cli.ts", "passwords", "contentoren-ssotest-production-ensure"], {
    env: {
      ...process.env,
      AUTHWORKS_CONTENTOREN_SSOTEST_EMAIL: privateEmail,
      AUTHWORKS_CONTENTOREN_SSOTEST_PASSWORD: malformedPassword,
      AUTHWORKS_TOKEN: systemSecret,
    },
    stderr: "pipe",
    stdout: "pipe",
  })
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ])
  expect(exitCode).not.toBe(0)
  expect(stdout).toBe("")
  expect(stderr).toContain("malformed")
  expect(stderr).not.toContain(privateEmail)
  expect(stderr).not.toContain(malformedPassword)
  expect(stderr).not.toContain(systemSecret)
})

async function productionFixtureCreate() {
  const directory = await mkdtemp(join(tmpdir(), "authworks-contentoren-ssotest-"))
  const server = serverApplicationCreate({ databasePath: join(directory, "authworks.sqlite"), systemSecret })
  if (!server.success) throw new Error("The Authworks test server could not be created.")
  const fetch = async (input: string | URL | Request, init?: RequestInit) =>
    await server.data.fetch(new Request(input, init))
  const clientOptions = { baseUrl: productionOrigin, fetch, token: systemSecret }
  const realms = realmApiClientCreate(clientOptions)
  const organizations = organizationApiClientCreate(clientOptions)
  const users = userApiClientCreate(clientOptions)
  const passwords = passwordApiClientCreate(clientOptions)
  const realm = await realms.realmCreate({ domain: "authworks.contentoren.de", name: "Production" })
  if (!realm.success) throw new Error("The production realm fixture could not be created.")
  const organization = await organizations.organizationCreate(realm.data.realm.id, { name: "Contentoren" })
  if (!organization.success) throw new Error("The Contentoren organization fixture could not be created.")
  return {
    async close() {
      server.data.stop()
      await rm(directory, { force: true, recursive: true })
    },
    ensure: (password: string) =>
      passwordContentorenSsoTestProductionEnsure({ email: privateEmail, fetch, password, token: systemSecret }),
    fetch,
    organizationId: organization.data.organization.id,
    organizations,
    passwords,
    realmId: realm.data.realm.id,
    realms,
    users,
  }
}

function fixtureUuidAlter(id: string): string {
  const last = id.at(-1)
  return `${id.slice(0, -1)}${last === "a" ? "b" : "a"}`
}
