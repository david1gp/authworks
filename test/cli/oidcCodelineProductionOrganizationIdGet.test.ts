import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { oidcCodelineProductionOrganizationIdGet } from "../../src/features/oidc/cli/oidcCodelineProductionOrganizationIdGet.js"
import { oidcCodelineProductionOrganizationIdGetExitCodeGet } from "../../src/features/oidc/cli/oidcCodelineProductionOrganizationIdGetExitCodeGet.js"
import { oidcCodelineProductionOrganizationIdGetFailureOutputCreate } from "../../src/features/oidc/cli/oidcCodelineProductionOrganizationIdGetFailureOutputCreate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { passwordContentorenSsoTestProductionEnsure } from "../../src/features/passwords/cli/passwordContentorenSsoTestProductionEnsure.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"

const systemSecret = "production-organization-id-secret-0001"
const productionOrigin = "https://authworks.contentoren.de"

test("production organization ID get is read-only with or without the safe ssotest fixture", async () => {
  const fixture = await productionFixtureCreate()
  try {
    for (const fixtureState of ["absent", "available"] as const) {
      if (fixtureState === "available") {
        const ensured = await passwordContentorenSsoTestProductionEnsure({
          email: "private.ssotest@example.invalid",
          fetch: fixture.fetch,
          password: "Private-ssotest-password-123!",
          token: systemSecret,
        })
        expect(ensured.success).toBe(true)
      }
      const methods: string[] = []
      const result = await oidcCodelineProductionOrganizationIdGet({
        fetch: async (input, init) => {
          const request = new Request(input, init)
          methods.push(request.method)
          return await fixture.fetch(request)
        },
        homeDirectory: fixture.directory,
      })
      expect(result).toEqual({ data: { organizationId: fixture.organizationId }, success: true })
      expect(methods.length).toBeGreaterThan(0)
      expect(new Set(methods)).toEqual(new Set(["GET"]))
    }
  } finally {
    await fixture.close()
  }
})

test("production organization ID get refuses unsafe existing membership semantics", async () => {
  const fixture = await productionFixtureCreate()
  try {
    const ensured = await passwordContentorenSsoTestProductionEnsure({
      email: "private.ssotest@example.invalid",
      fetch: fixture.fetch,
      password: "Private-ssotest-password-123!",
      token: systemSecret,
    })
    expect(ensured.success).toBe(true)
    const memberships = await fixture.organizations.organizationMembershipList(fixture.realmId, fixture.organizationId)
    expect(memberships.success).toBe(true)
    if (!memberships.success || memberships.data.items[0] === undefined) return
    const changed = await fixture.organizations.organizationMembershipUpdate(
      fixture.realmId,
      fixture.organizationId,
      memberships.data.items[0].id,
      { roles: ["guest"] },
    )
    expect(changed.success).toBe(true)

    const result = await oidcCodelineProductionOrganizationIdGet({
      fetch: fixture.fetch,
      homeDirectory: fixture.directory,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.code).toBe("oidc.codeline-organization-id-get.membership-role-invalid")
  } finally {
    await fixture.close()
  }
})

test("production organization ID get ignores inactive realm and organization duplicates", async () => {
  const fixture = await productionFixtureCreate()
  try {
    const result = await oidcCodelineProductionOrganizationIdGet({
      fetch: async (input, init) => {
        const request = new Request(input, init)
        const response = await fixture.fetch(request)
        const pathname = new URL(request.url).pathname
        if (request.method !== "GET" || (pathname !== "/system/realms" && !pathname.endsWith("/organizations")))
          return response
        const body = (await response.json()) as { items: Record<string, unknown>[] }
        const current = body.items[0]
        if (current === undefined) return Response.json(body)
        const duplicate = {
          ...current,
          id: fixtureUuidAlter(String(current.id)),
          status: pathname === "/system/realms" ? "disabled" : "inactive",
        }
        return Response.json({ ...body, items: [...body.items, duplicate] })
      },
      homeDirectory: fixture.directory,
    })
    expect(result).toEqual({ data: { organizationId: fixture.organizationId }, success: true })
  } finally {
    await fixture.close()
  }
})

test("production organization ID get exposes only its closed failure contract", async () => {
  const privateText = "private-token organization-id account-id response-body"
  const unknownFailure = { errorMessage: privateText, op: "private", success: false as const }
  expect(oidcCodelineProductionOrganizationIdGetFailureOutputCreate(unknownFailure)).toBe(
    '{"error":{"code":"oidc.codeline-organization-id-get.internal-failed"}}\n',
  )
  expect(oidcCodelineProductionOrganizationIdGetExitCodeGet(unknownFailure)).toBe(59)

  const child = Bun.spawn(["bun", "src/outputs/cli.ts", "oidc", "codeline-production-organization-id-get"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ])
  expect(exitCode).toBe(40)
  expect(stdout).toBe("")
  expect(stderr).toBe('{"error":{"code":"oidc.codeline-organization-id-get.input-invalid"}}\n')
  expect(stderr).not.toContain(privateText)

  const withArgument = Bun.spawn(
    ["bun", "src/outputs/cli.ts", "oidc", "codeline-production-organization-id-get", "--realm-id", privateText],
    { stderr: "pipe", stdout: "pipe" },
  )
  const [argumentExitCode, argumentStdout] = await Promise.all([
    withArgument.exited,
    new Response(withArgument.stdout).text(),
  ])
  expect(argumentExitCode).not.toBe(0)
  expect(argumentStdout).toBe("")

  const help = Bun.spawn(["bun", "src/outputs/cli.ts", "oidc", "--help"], { stderr: "pipe", stdout: "pipe" })
  const [helpExitCode, helpStderr, helpStdout] = await Promise.all([
    help.exited,
    new Response(help.stderr).text(),
    new Response(help.stdout).text(),
  ])
  expect(helpExitCode).toBe(0)
  expect(helpStderr).toBe("")
  expect(helpStdout).toContain("codeline-production-organization-id-get")
})

async function productionFixtureCreate() {
  const directory = await mkdtemp(join(tmpdir(), "authworks-production-organization-id-"))
  const server = serverApplicationCreate({ databasePath: join(directory, "authworks.sqlite"), systemSecret })
  if (!server.success) throw new Error("The Authworks test server could not be created.")
  const environmentDirectory = join(directory, ".config", "authworks")
  await mkdir(environmentDirectory, { mode: 0o700, recursive: true })
  await writeFile(join(environmentDirectory, "authworks.env"), `AUTHWORKS_SYSTEM_SECRET=${systemSecret}\n`, {
    mode: 0o600,
  })
  const fetch = async (input: string | URL | Request, init?: RequestInit) =>
    await server.data.fetch(new Request(input, init))
  const clientOptions = { baseUrl: productionOrigin, fetch, token: systemSecret }
  const realms = realmApiClientCreate(clientOptions)
  const organizations = organizationApiClientCreate(clientOptions)
  const realm = await realms.realmCreate({ domain: "authworks.contentoren.de", name: "Production" })
  if (!realm.success) throw new Error("The production realm fixture could not be created.")
  const organization = await organizations.organizationCreate(realm.data.realm.id, { name: "Contentoren" })
  if (!organization.success) throw new Error("The Contentoren organization fixture could not be created.")
  return {
    async close() {
      server.data.stop()
      await rm(directory, { force: true, recursive: true })
    },
    directory,
    fetch,
    organizationId: organization.data.organization.id,
    organizations,
    realmId: realm.data.realm.id,
  }
}

function fixtureUuidAlter(id: string): string {
  const last = id.at(-1)
  return `${id.slice(0, -1)}${last === "a" ? "b" : "a"}`
}
