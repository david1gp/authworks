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
const apiInvalidResponseStages = [
  "realm-list",
  "organization-list",
  "password-policy-get",
  "user-list",
  "machine-user-list",
  "user-create",
  "user-email-verification-set",
  "user-lifecycle-set",
  "password-credential-replace",
  "membership-create",
  "membership-update",
] as const
const membershipListInvalidFields = [
  "envelope",
  "items",
  "id",
  "realm-id",
  "organization-id",
  "user-id",
  "created-at",
  "updated-at",
  "roles",
  "next-page-token",
  "unknown",
] as const
const repositoryRoot = join(import.meta.dir, "../..")
const preloadPath = join(import.meta.dir, "passwordContentorenSsoTestProductionEnsureProcessPreload.ts")

const processContractCases = [
  { code: "authorization-unavailable", exitCode: 44, scenario: "authorization-unavailable" },
  { code: "input-invalid", exitCode: 45, scenario: "input-invalid" },
  { code: "realm-not-found", exitCode: 46, scenario: "realm-not-found" },
  { code: "realm-ambiguous", exitCode: 47, scenario: "realm-ambiguous" },
  { code: "realm-inactive", exitCode: 48, scenario: "realm-inactive" },
  { code: "organization-not-found", exitCode: 49, scenario: "organization-not-found" },
  { code: "organization-ambiguous", exitCode: 50, scenario: "organization-ambiguous" },
  { code: "organization-inactive", exitCode: 51, scenario: "organization-inactive" },
  { code: "human-ambiguous", exitCode: 52, scenario: "human-ambiguous" },
  { code: "human-conflict", exitCode: 53, scenario: "human-conflict" },
  { code: "human-deleted", exitCode: 54, scenario: "human-deleted" },
  { code: "machine-conflict", exitCode: 55, scenario: "machine-conflict" },
  { code: "membership-elevated", exitCode: 56, scenario: "membership-elevated" },
  { code: "membership-ambiguous", exitCode: 57, scenario: "membership-ambiguous" },
  { code: "password-policy-rejected", exitCode: 58, scenario: "password-policy-rejected" },
  { code: "api-unreachable", exitCode: 59, scenario: "api-unreachable" },
  { code: "api-unauthorized", exitCode: 60, scenario: "api-unauthorized" },
  { code: "api-forbidden", exitCode: 61, scenario: "api-forbidden" },
  { code: "api-rate-limited", exitCode: 62, scenario: "api-rate-limited" },
  { code: "api-failed", exitCode: 86, scenario: "api-failed" },
  ...apiRejectedStageExitCodes.map(({ exitCode, stage }) => ({
    code: `api-rejected.${stage}`,
    exitCode,
    scenario: { kind: "api" as const, response: "rejected" as const, stage },
  })),
  ...apiInvalidResponseStages.map((stage, index) => ({
    code: `api-invalid-response.${stage}`,
    exitCode: 64 + index,
    scenario: { kind: "api" as const, response: "invalid" as const, stage },
  })),
  ...membershipListInvalidFields.map((field, index) => ({
    code: `api-invalid-response.membership-list.${field}`,
    exitCode: 75 + index,
    scenario: { field, kind: "membership-invalid" as const },
  })),
] as const

test.serial(
  "Contentoren ssotest process maps every API rejection stage to its reserved exit code",
  async () => {
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
  },
  30_000,
)

test.serial("Contentoren ssotest process reports an invalid realm-list response cleanly", async () => {
  const cliPath = await cliBuild()
  const fixture = await processFixtureCreate("realm-list", "invalid")
  try {
    const result = await cliRun(cliPath, fixture.mockOrigin)
    expectExternalFailure(result, "passwords.contentoren-ssotest-ensure.api-invalid-response.realm-list", 64)
    expect(fixture.stageHits()).toBe(1)
  } finally {
    await fixture.close()
  }
})

test.serial(
  "Contentoren ssotest process preserves every closed failure contract",
  async () => {
    const cliPath = await cliBuild()
    for (const failure of processContractCases) {
      if (failure.scenario === "authorization-unavailable") {
        const result = await cliRun(cliPath, undefined, { token: "short-token" })
        expectExternalFailure(result, `passwords.contentoren-ssotest-ensure.${failure.code}`, failure.exitCode)
        continue
      }
      if (failure.scenario === "input-invalid") {
        const result = await cliRun(cliPath, undefined, { password: "invalid\n" })
        expectExternalFailure(result, `passwords.contentoren-ssotest-ensure.${failure.code}`, failure.exitCode)
        continue
      }
      const fixture = await processContractFixtureCreate(failure.scenario)
      try {
        const result = await cliRun(cliPath, fixture.mockOrigin)
        expectExternalFailure(result, `passwords.contentoren-ssotest-ensure.${failure.code}`, failure.exitCode)
      } finally {
        await fixture.close()
      }
    }
  },
  120_000,
)

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

async function cliRun(
  cliPath: string,
  mockOrigin: string | undefined,
  options: { readonly password?: string; readonly token?: string } = {},
): Promise<CliRun> {
  const environment = {
    ...safeEnvironmentCreate(),
    AUTHWORKS_CONTENTOREN_SSOTEST_EMAIL: privateEmail,
    AUTHWORKS_CONTENTOREN_SSOTEST_PASSWORD: options.password ?? privatePassword,
    AUTHWORKS_TOKEN: options.token ?? systemSecret,
    ...(mockOrigin === undefined ? {} : { AUTHWORKS_CONTENTOREN_SSOTEST_TEST_ORIGIN: mockOrigin }),
  }
  const child = Bun.spawn(
    ["bun", "--preload", preloadPath, cliPath, "passwords", "contentoren-ssotest-production-ensure"],
    {
      cwd: repositoryRoot,
      env: environment,
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

async function processContractFixtureCreate(scenario: ProcessContractScenario) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-contentoren-contract-"))
  const created = serverApplicationCreate({ databasePath: join(directory, "authworks.sqlite"), systemSecret })
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error("The process contract server could not be created.")
  }
  const application = created.data
  const applicationFetch = async (input: string | URL | Request, init?: RequestInit) =>
    await application.fetch(new Request(input, init))
  const clientOptions = { baseUrl: productionOrigin, fetch: applicationFetch, token: systemSecret }
  const realms = realmApiClientCreate(clientOptions)
  const organizations = organizationApiClientCreate(clientOptions)
  const users = userApiClientCreate(clientOptions)
  const realm = await realms.realmCreate({ domain: "authworks.contentoren.de", name: "Production" })
  if (!realm.success) throw new Error("The process contract realm fixture could not be created.")
  const organization = await organizations.organizationCreate(realm.data.realm.id, { name: "Contentoren" })
  if (!organization.success) throw new Error("The process contract organization fixture could not be created.")
  const realmId = realm.data.realm.id
  const organizationId = organization.data.organization.id
  if (processContractRequiresUser(scenario)) {
    const ensured = await passwordContentorenSsoTestProductionEnsure({
      email: privateEmail,
      fetch: applicationFetch,
      password: privatePassword,
      token: systemSecret,
    })
    if (!ensured.success) throw new Error("The process contract user fixture could not be ensured.")
  }
  if (typeof scenario === "object" && scenario.kind === "api" && processStageRequiresUser(scenario.stage)) {
    const userList = await users.userList(realmId)
    if (!userList.success || userList.data.items[0] === undefined)
      throw new Error("The process contract user fixture could not be found.")
    const user = userList.data.items[0]
    if (scenario.stage === "user-email-verification-set") {
      const unverified = await users.userEmailVerificationSet(realmId, user.id, { state: "unverified" })
      if (!unverified.success) throw new Error("The process contract user could not be unverified.")
    }
    if (scenario.stage === "user-lifecycle-set") {
      const inactive = await users.userLifecycleSet(realmId, user.id, { state: "inactive" })
      if (!inactive.success) throw new Error("The process contract user could not be deactivated.")
    }
    if (scenario.stage === "membership-create" || scenario.stage === "membership-update") {
      const memberships = await organizations.organizationMembershipList(realmId, organizationId)
      if (!memberships.success || memberships.data.items[0] === undefined)
        throw new Error("The process contract membership fixture could not be found.")
      if (scenario.stage === "membership-create") {
        const removed = await organizations.organizationMembershipRemove(
          realmId,
          organizationId,
          memberships.data.items[0].id,
        )
        if (!removed.success) throw new Error("The process contract membership could not be removed.")
      }
      if (scenario.stage === "membership-update") {
        const changed = await organizations.organizationMembershipUpdate(
          realmId,
          organizationId,
          memberships.data.items[0].id,
          { roles: ["guest"] },
        )
        if (!changed.success) throw new Error("The process contract membership could not be changed.")
      }
    }
  }

  let stageHits = 0
  const mock = Bun.serve({
    fetch: async (request) => {
      if (processContractScenarioMatches(scenario, request)) {
        stageHits += 1
        return await processContractScenarioResponse(scenario, request, application, realmId, organizationId)
      }
      if (request.method === "GET" && new URL(request.url).pathname.endsWith("/password-policy"))
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
      return await processContractApplicationFetch(application, request)
    },
    port: 0,
  })
  const mockOrigin = mock.url.toString()
  if (scenario === "api-unreachable") mock.stop(true)
  return {
    close: async () => {
      mock.stop(true)
      application.stop()
      await rm(directory, { force: true, recursive: true })
    },
    mockOrigin,
    stageHits: () => stageHits,
  }
}

function processContractRequiresUser(scenario: ProcessContractScenario): boolean {
  if (typeof scenario === "object") {
    return (
      scenario.kind === "membership-invalid" || (scenario.kind === "api" && processStageRequiresUser(scenario.stage))
    )
  }
  return (
    scenario === "human-ambiguous" ||
    scenario === "human-conflict" ||
    scenario === "human-deleted" ||
    scenario === "membership-elevated" ||
    scenario === "membership-ambiguous"
  )
}

function processStageRequiresUser(stage: ProcessStage): boolean {
  return (
    stage === "membership-list" ||
    stage === "user-email-verification-set" ||
    stage === "user-lifecycle-set" ||
    stage === "password-credential-replace" ||
    stage === "membership-create" ||
    stage === "membership-update"
  )
}

function processContractScenarioMatches(scenario: ProcessContractScenario, request: Request): boolean {
  if (typeof scenario === "object") {
    if (scenario.kind === "api") return processStageMatches(scenario.stage, request)
    return request.method === "GET" && new URL(request.url).pathname.endsWith("/memberships")
  }
  const pathname = new URL(request.url).pathname
  if (scenario === "realm-not-found" || scenario === "realm-ambiguous" || scenario === "realm-inactive")
    return request.method === "GET" && pathname === "/system/realms"
  if (
    scenario === "organization-not-found" ||
    scenario === "organization-ambiguous" ||
    scenario === "organization-inactive"
  )
    return request.method === "GET" && pathname.endsWith("/organizations")
  if (scenario === "human-ambiguous" || scenario === "human-conflict" || scenario === "human-deleted")
    return request.method === "GET" && pathname.endsWith("/users")
  if (scenario === "machine-conflict") return request.method === "GET" && pathname.endsWith("/machine-users")
  if (scenario === "membership-elevated" || scenario === "membership-ambiguous")
    return request.method === "GET" && pathname.endsWith("/memberships")
  if (scenario === "password-policy-rejected") return request.method === "GET" && pathname.endsWith("/password-policy")
  if (
    scenario === "api-unauthorized" ||
    scenario === "api-forbidden" ||
    scenario === "api-rate-limited" ||
    scenario === "api-failed"
  )
    return request.method === "GET" && pathname === "/system/realms"
  return false
}

async function processContractScenarioResponse(
  scenario: ProcessContractScenario,
  request: Request,
  application: { fetch: (request: Request) => Response | Promise<Response> },
  realmId: string,
  organizationId: string,
): Promise<Response> {
  if (typeof scenario === "object") {
    if (scenario.kind === "api") {
      if (scenario.response === "invalid") return Response.json({ malformed: true })
      if (scenario.response === "failed") return Response.json({ error: { code: "platform.http" } }, { status: 500 })
      if (scenario.response === "unauthorized")
        return Response.json({ error: { code: "platform.http" } }, { status: 401 })
      if (scenario.response === "forbidden") return Response.json({ error: { code: "platform.http" } }, { status: 403 })
      if (scenario.response === "rate-limited")
        return Response.json({ error: { code: "platform.http" } }, { status: 429 })
      return Response.json({ error: { code: "platform.http" } }, { status: 409 })
    }
    const source = await processContractApplicationJson(application, request)
    return Response.json(processMembershipInvalidBody(scenario.field, source))
  }
  if (scenario === "password-policy-rejected")
    return Response.json({
      policy: {
        lockoutDurationMs: 900000,
        maximumAttempts: 5,
        minimumLength: 72,
        requireLowercase: false,
        requireNumber: false,
        requireSymbol: false,
        requireUppercase: false,
      },
    })
  if (scenario === "api-unauthorized") return Response.json({ error: { code: "platform.http" } }, { status: 401 })
  if (scenario === "api-forbidden") return Response.json({ error: { code: "platform.http" } }, { status: 403 })
  if (scenario === "api-rate-limited") return Response.json({ error: { code: "platform.http" } }, { status: 429 })
  if (scenario === "api-failed") return Response.json({ error: { code: "platform.http" } }, { status: 500 })
  const source = await processContractApplicationJson(application, request)
  if (scenario === "realm-not-found") return Response.json({ ...source, items: [] })
  if (scenario === "realm-ambiguous")
    return Response.json({ ...source, items: [...processItemsGet(source), ...processItemsGet(source)] })
  if (scenario === "realm-inactive")
    return Response.json({ ...source, items: [{ ...processItemGet(source), status: "disabled" }] })
  if (scenario === "organization-not-found") return Response.json({ ...source, items: [] })
  if (scenario === "organization-ambiguous")
    return Response.json({ ...source, items: [...processItemsGet(source), ...processItemsGet(source)] })
  if (scenario === "organization-inactive")
    return Response.json({ ...source, items: [{ ...processItemGet(source), status: "inactive" }] })
  if (scenario === "human-ambiguous")
    return Response.json({ ...source, items: [...processItemsGet(source), ...processItemsGet(source)] })
  if (scenario === "human-conflict")
    return Response.json({ ...source, items: [{ ...processItemGet(source), realmId: fixtureUuidAlter(realmId) }] })
  if (scenario === "human-deleted")
    return Response.json({ ...source, items: [{ ...processItemGet(source), state: "deleted" }] })
  if (scenario === "machine-conflict")
    return Response.json({
      ...source,
      items: [
        {
          createdAt: 0,
          displayName: "ssotest machine",
          id: "018f0000-0000-7000-8000-000000000001",
          realmId,
          scopes: [],
          status: "active",
          updatedAt: 0,
          userName: "ssotest",
        },
      ],
    })
  if (scenario === "membership-elevated") {
    const item = processItemGet(source)
    return Response.json({ ...source, items: [{ ...item, roles: ["admin"] }] })
  }
  if (scenario === "membership-ambiguous") {
    const items = processItemsGet(source)
    return Response.json({ ...source, items: [...items, ...items] })
  }
  return Response.json({ error: { code: "platform.http" } }, { status: 500 })
}

async function processContractApplicationFetch(
  application: { fetch: (request: Request) => Response | Promise<Response> },
  request: Request,
): Promise<Response> {
  const url = new URL(request.url)
  url.protocol = "https:"
  url.host = "authworks.contentoren.de"
  return await application.fetch(new Request(url, request))
}

async function processContractApplicationJson(
  application: { fetch: (request: Request) => Response | Promise<Response> },
  request: Request,
): Promise<Record<string, unknown>> {
  const response = await processContractApplicationFetch(application, request)
  return (await response.json()) as Record<string, unknown>
}

function processItemsGet(source: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(source.items) ? (source.items as Record<string, unknown>[]) : []
}

function processItemGet(source: Record<string, unknown>): Record<string, unknown> {
  const item = processItemsGet(source)[0]
  if (item === undefined) throw new Error("The process contract response did not contain an item.")
  return item
}

function processMembershipInvalidBody(
  field: MembershipInvalidField,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const item = processItemGet(source)
  if (field === "envelope") return { items: [], leaked: "private" }
  if (field === "items") return { items: "private" }
  if (field === "unknown") return { items: [{ ...item, leaked: "private" }] }
  if (field === "next-page-token") return { ...source, nextPageToken: 1 }
  const invalidValues: Record<
    Exclude<MembershipInvalidField, "envelope" | "items" | "next-page-token" | "unknown">,
    unknown
  > = {
    "created-at": "private",
    id: "private",
    "organization-id": "private",
    "realm-id": "private",
    roles: ["private"],
    "updated-at": "private",
    "user-id": { private: true },
  }
  const fieldNames: Record<keyof typeof invalidValues, string> = {
    "created-at": "createdAt",
    id: "id",
    "organization-id": "organizationId",
    "realm-id": "realmId",
    roles: "roles",
    "updated-at": "updatedAt",
    "user-id": "userId",
  }
  return { ...source, items: [{ ...item, [fieldNames[field]]: invalidValues[field] }] }
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
type MembershipInvalidField = (typeof membershipListInvalidFields)[number]
type ProcessContractScenario =
  | "authorization-unavailable"
  | "input-invalid"
  | "realm-not-found"
  | "realm-ambiguous"
  | "realm-inactive"
  | "organization-not-found"
  | "organization-ambiguous"
  | "organization-inactive"
  | "human-ambiguous"
  | "human-conflict"
  | "human-deleted"
  | "machine-conflict"
  | "membership-elevated"
  | "membership-ambiguous"
  | "password-policy-rejected"
  | "api-unreachable"
  | "api-unauthorized"
  | "api-forbidden"
  | "api-rate-limited"
  | "api-failed"
  | {
      readonly kind: "api"
      readonly response: "failed" | "forbidden" | "invalid" | "rate-limited" | "rejected" | "unauthorized"
      readonly stage: ProcessStage
    }
  | { readonly field: MembershipInvalidField; readonly kind: "membership-invalid" }

function fixtureUuidAlter(id: string): string {
  const last = id.at(-1)
  return `${id.slice(0, -1)}${last === "a" ? "b" : "a"}`
}
