import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { passwordContentorenSsoTestProductionEnsure } from "../../src/features/passwords/cli/passwordContentorenSsoTestProductionEnsure.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"

const productionOrigin = "https://authworks.contentoren.de"
const systemSecret = "local-process-fixture-system-secret-0001"
const privateEmail = "process.ssotest@example.invalid"
const privatePassword = "Private-fixture-password-100!"
const apiRejectedStageExitCodes = [
  { exitCode: 32, stage: "realm-list" },
  { exitCode: 33, stage: "organization-list" },
  { exitCode: 34, stage: "password-policy-get" },
  { exitCode: 35, stage: "user-list" },
  { exitCode: 36, stage: "machine-user-list" },
  { exitCode: 37, stage: "membership-list" },
  { exitCode: 38, stage: "user-create" },
  { exitCode: 39, stage: "user-email-verification-set" },
  { exitCode: 40, stage: "user-lifecycle-set" },
  { exitCode: 41, stage: "password-credential-replace" },
  { exitCode: 42, stage: "membership-create" },
  { exitCode: 43, stage: "membership-update" },
] as const
const repositoryRoot = join(import.meta.dir, "../..")
const preloadPath = join(import.meta.dir, "passwordContentorenSsoTestProductionEnsureProcessPreload.ts")

test("Contentoren ssotest process maps every API rejection stage to its reserved exit code", async () => {
  const cliPath = await cliBuild()
  for (const { exitCode, stage } of apiRejectedStageExitCodes) {
    const fixture = await processFixtureCreate(stage, "rejected")
    try {
      const result = await cliRun(cliPath, fixture.mockOrigin)
      expectExternalFailure(result, `passwords.contentoren-ssotest-ensure.api-rejected.${stage}`, exitCode)
      expect(fixture.stageHits()).toBe(1)
    } finally {
      await fixture.close()
    }
  }
})

test("Contentoren ssotest process reports an invalid realm-list response cleanly", async () => {
  const cliPath = await cliBuild()
  const fixture = await processFixtureCreate("realm-list", "invalid")
  try {
    const result = await cliRun(cliPath, fixture.mockOrigin)
    expectExternalFailure(result, "passwords.contentoren-ssotest-ensure.api-invalid-response.realm-list")
    expect(fixture.stageHits()).toBe(1)
  } finally {
    await fixture.close()
  }
})

async function cliBuild(): Promise<string> {
  const build = Bun.spawn(["bun", "run", "build:cli"], {
    cwd: repositoryRoot,
    env: safeEnvironmentCreate(),
    stderr: "pipe",
    stdout: "pipe",
  })
  await Promise.all([build.exited, new Response(build.stderr).text(), new Response(build.stdout).text()])
  expect(build.exitCode).toBe(0)
  return join(repositoryRoot, "dist/cli/cli.js")
}

async function cliRun(cliPath: string, mockOrigin: string): Promise<CliRun> {
  const child = Bun.spawn(
    ["bun", "--preload", preloadPath, cliPath, "passwords", "contentoren-ssotest-production-ensure"],
    {
      cwd: repositoryRoot,
      env: {
        ...safeEnvironmentCreate(),
        AUTHWORKS_CONTENTOREN_SSOTEST_EMAIL: privateEmail,
        AUTHWORKS_CONTENTOREN_SSOTEST_PASSWORD: privatePassword,
        AUTHWORKS_CONTENTOREN_SSOTEST_TEST_ORIGIN: mockOrigin,
        AUTHWORKS_TOKEN: systemSecret,
      },
      stderr: "pipe",
      stdout: "pipe",
    },
  )
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ])
  return { exitCode, stderr, stdout }
}

function expectExternalFailure(result: CliRun, code: string, exitCode = 1): void {
  const canonicalStderr = `${JSON.stringify({ error: { code } })}\n`
  expect(result.exitCode).toBe(exitCode)
  expect(result.stdout).toBe("")
  expect(result.stderr).toBe(canonicalStderr)
  expect(result.stderr).not.toMatch(/Error|Stricli|at /)
}

async function processFixtureCreate(stage: ProcessStage, response: ProcessResponse) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-contentoren-process-"))
  const created = serverApplicationCreate({ databasePath: join(directory, "authworks.sqlite"), systemSecret })
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error("The process integration server could not be created.")
  }
  const application = created.data
  const applicationFetch = async (input: string | URL | Request, init?: RequestInit) =>
    await application.fetch(new Request(input, init))
  const clientOptions = { baseUrl: productionOrigin, fetch: applicationFetch, token: systemSecret }
  const realms = realmApiClientCreate(clientOptions)
  const organizations = organizationApiClientCreate(clientOptions)
  const users = userApiClientCreate(clientOptions)
  const realm = await realms.realmCreate({ domain: "authworks.contentoren.de", name: "Production" })
  if (!realm.success) throw new Error("The process integration realm fixture could not be created.")
  const organization = await organizations.organizationCreate(realm.data.realm.id, { name: "Contentoren" })
  if (!organization.success) throw new Error("The process integration organization fixture could not be created.")
  const realmId = realm.data.realm.id
  const organizationId = organization.data.organization.id

  if (stage === "membership-list") {
    const user = await users.userCreate(realm.data.realm.id, {
      email: privateEmail,
      profile: {},
      userName: "ssotest",
    })
    if (!user.success) throw new Error("The process integration user fixture could not be created.")
  }
  if (
    stage === "user-email-verification-set" ||
    stage === "user-lifecycle-set" ||
    stage === "password-credential-replace" ||
    stage === "membership-create" ||
    stage === "membership-update"
  ) {
    const ensured = await passwordContentorenSsoTestProductionEnsure({
      email: privateEmail,
      fetch: applicationFetch,
      password: privatePassword,
      token: systemSecret,
    })
    if (!ensured.success) throw new Error("The process integration user fixture could not be ensured.")
    const userList = await users.userList(realmId)
    if (!userList.success || userList.data.items[0] === undefined)
      throw new Error("The process integration user fixture could not be found.")
    const user = userList.data.items[0]
    if (stage === "user-email-verification-set") {
      const unverified = await users.userEmailVerificationSet(realmId, user.id, { state: "unverified" })
      if (!unverified.success) throw new Error("The process integration user could not be unverified.")
    }
    if (stage === "user-lifecycle-set") {
      const inactive = await users.userLifecycleSet(realmId, user.id, { state: "inactive" })
      if (!inactive.success) throw new Error("The process integration user could not be deactivated.")
    }
    if (stage === "membership-create" || stage === "membership-update") {
      const memberships = await organizations.organizationMembershipList(realmId, organizationId)
      if (!memberships.success || memberships.data.items[0] === undefined)
        throw new Error("The process integration membership fixture could not be found.")
      if (stage === "membership-create") {
        const removed = await organizations.organizationMembershipRemove(
          realmId,
          organizationId,
          memberships.data.items[0].id,
        )
        if (!removed.success) throw new Error("The process integration membership could not be removed.")
      }
      if (stage === "membership-update") {
        const changed = await organizations.organizationMembershipUpdate(
          realmId,
          organizationId,
          memberships.data.items[0].id,
          { roles: ["guest"] },
        )
        if (!changed.success) throw new Error("The process integration membership could not be changed.")
      }
    }
  }

  let stageHits = 0
  const mock = Bun.serve({
    fetch: async (request) => {
      const pathname = new URL(request.url).pathname
      const matches = processStageMatches(stage, request)
      if (matches) {
        stageHits += 1
        if (response === "invalid") return Response.json({ malformed: true })
        return Response.json({ error: { code: "platform.http" } }, { status: 409 })
      }
      if (request.method === "GET" && pathname.endsWith("/password-policy"))
        return Response.json({
          policy: {
            lockoutDurationMs: 900000,
            maximumAttempts: 5,
            minimumLength: 12,
            requireLowercase: false,
            requireNumber: false,
            requireSymbol: false,
            requireUppercase: false,
          },
        })
      const applicationUrl = new URL(request.url)
      applicationUrl.protocol = "https:"
      applicationUrl.host = "authworks.contentoren.de"
      return await application.fetch(new Request(applicationUrl, request))
    },
    port: 0,
  })
  return {
    close: async () => {
      mock.stop(true)
      application.stop()
      await rm(directory, { force: true, recursive: true })
    },
    mockOrigin: mock.url.toString(),
    stageHits: () => stageHits,
  }
}

function processStageMatches(stage: ProcessStage, request: Request): boolean {
  const pathname = new URL(request.url).pathname
  if (stage === "realm-list") return request.method === "GET" && pathname === "/system/realms"
  if (stage === "organization-list") return request.method === "GET" && pathname.endsWith("/organizations")
  if (stage === "password-policy-get") return request.method === "GET" && pathname.endsWith("/password-policy")
  if (stage === "user-list") return request.method === "GET" && pathname.endsWith("/users")
  if (stage === "machine-user-list") return request.method === "GET" && pathname.endsWith("/machine-users")
  if (stage === "membership-list") return request.method === "GET" && pathname.endsWith("/memberships")
  if (stage === "user-create") return request.method === "POST" && pathname.endsWith("/users")
  if (stage === "user-email-verification-set") return request.method === "POST" && pathname.endsWith("/verification")
  if (stage === "user-lifecycle-set") return request.method === "POST" && pathname.endsWith("/lifecycle")
  if (stage === "password-credential-replace") return request.method === "POST" && pathname.endsWith("/password")
  if (stage === "membership-create") return request.method === "POST" && pathname.endsWith("/memberships")
  return request.method === "PATCH" && pathname.includes("/memberships/")
}

function safeEnvironmentCreate(): Record<string, string> {
  return {
    BUN_INSTALL: process.env.BUN_INSTALL ?? "",
    HOME: process.env.HOME ?? "",
    PATH: process.env.PATH ?? "",
    TMPDIR: process.env.TMPDIR ?? "",
  }
}

type CliRun = {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

type ProcessResponse = "invalid" | "rejected"
type ProcessStage = (typeof apiRejectedStageExitCodes)[number]["stage"]
