import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { ResultErr } from "#result"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { organizationMembershipListResponseInvalidFieldClassify } from "../../src/features/organizations/client/organizationMembershipListResponseInvalidFieldClassify.js"
import { passwordContentorenSsoTestProductionEnsure } from "../../src/features/passwords/cli/passwordContentorenSsoTestProductionEnsure.js"
import { passwordContentorenSsoTestProductionEnsureFailureOutputCreate } from "../../src/features/passwords/cli/passwordContentorenSsoTestProductionEnsureFailureOutputCreate.js"
import { passwordApiClientCreate } from "../../src/features/passwords/client/passwordApiClientCreate.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"

const productionOrigin = "https://authworks.contentoren.de"
const systemSecret = "production-system-secret-ssotest-0001"
const privateEmail = "private.ssotest@example.invalid"
const privatePassword = "Private-fixture-password-100!"
const replacementPassword = "Replacement-fixture-password-200!"
const apiInvalidResponseStages = [
  "realm-list",
  "organization-list",
  "password-policy-get",
  "user-list",
  "machine-user-list",
  "membership-list",
  "user-create",
  "user-email-verification-set",
  "user-lifecycle-set",
  "password-credential-replace",
  "membership-create",
  "membership-update",
] as const
const apiRejectedStages = apiInvalidResponseStages
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
    if (!ambiguous.success) expect(ambiguous.code).toBe("passwords.contentoren-ssotest-ensure.membership-ambiguous")
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
    if (!elevated.success) expect(elevated.code).toBe("passwords.contentoren-ssotest-ensure.membership-elevated")
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
    if (!ambiguous.success) expect(ambiguous.code).toBe("passwords.contentoren-ssotest-ensure.human-ambiguous")
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
    if (!ambiguous.success) expect(ambiguous.code).toBe("passwords.contentoren-ssotest-ensure.organization-ambiguous")
    const users = await fixture.users.userList(fixture.realmId)
    expect(users.success).toBe(true)
    if (users.success) expect(users.data.items).toHaveLength(0)
  } finally {
    await fixture.close()
  }
})

test("Contentoren ssotest ensure identifies every invalid API response boundary without disclosure", async () => {
  for (const stage of apiInvalidResponseStages) {
    const fixture = await productionFixtureCreate()
    try {
      await invalidResponseStageFixturePrepare(fixture, stage)
      const fetch = async (input: string | URL | Request, init?: RequestInit) => {
        const request = new Request(input, init)
        if (invalidResponseStageMatches(stage, request)) return Response.json({ malformed: true })
        return await fixture.fetch(request)
      }
      const result = await passwordContentorenSsoTestProductionEnsure({
        email: privateEmail,
        fetch,
        password: replacementPassword,
        token: systemSecret,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const expectedCode =
          stage === "membership-list"
            ? "passwords.contentoren-ssotest-ensure.api-invalid-response.membership-list.envelope"
            : `passwords.contentoren-ssotest-ensure.api-invalid-response.${stage}`
        expect(result.code).toBe(expectedCode)
        expect(JSON.stringify(result)).not.toContain(privateEmail)
        expect(JSON.stringify(result)).not.toContain(privatePassword)
        expect(JSON.stringify(result)).not.toContain(replacementPassword)
        expect(JSON.stringify(result)).not.toContain(systemSecret)
      }
    } finally {
      await fixture.close()
    }
  }
})

test("Contentoren ssotest ensure identifies every rejected API boundary without disclosure", async () => {
  const secretStatus = "409"
  const secretUrl = "https://private.example.invalid/secret-url"
  const secretBody = "private-api-body"
  const secretId = "private-request-id"
  const secretMessage = "private raw API message"
  for (const stage of apiRejectedStages) {
    const fixture = await productionFixtureCreate()
    try {
      await invalidResponseStageFixturePrepare(fixture, stage)
      const fetch = async (input: string | URL | Request, init?: RequestInit) => {
        const request = new Request(input, init)
        if (invalidResponseStageMatches(stage, request))
          return Response.json(
            {
              error: {
                code: "platform.http",
                details: { body: secretBody, id: secretId, url: secretUrl },
                message: secretMessage,
                requestId: secretId,
              },
            },
            { headers: { "x-request-id": secretId }, status: Number(secretStatus) },
          )
        return await fixture.fetch(request)
      }
      const result = await passwordContentorenSsoTestProductionEnsure({
        email: privateEmail,
        fetch,
        password: replacementPassword,
        token: systemSecret,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const expectedCode = `passwords.contentoren-ssotest-ensure.api-rejected.${stage}`
        expect(result.code).toBe(expectedCode)
        const output = passwordContentorenSsoTestProductionEnsureFailureOutputCreate(result)
        expect(output).toBe(`{"error":{"code":"${expectedCode}"}}\n`)
        const diagnostic = `${JSON.stringify(result)}${output}`
        expect(diagnostic).not.toContain(secretStatus)
        expect(diagnostic).not.toContain(secretUrl)
        expect(diagnostic).not.toContain(secretBody)
        expect(diagnostic).not.toContain(secretId)
        expect(diagnostic).not.toContain(secretMessage)
        expect(diagnostic).not.toContain(privateEmail)
        expect(diagnostic).not.toContain(privatePassword)
        expect(diagnostic).not.toContain(replacementPassword)
        expect(diagnostic).not.toContain(systemSecret)
      }
    } finally {
      await fixture.close()
    }
  }
})

test("Contentoren membership-list diagnostics use only the closed field categories", () => {
  const secretValue = "sensitive-membership-value"
  const validItem = {
    createdAt: 1,
    id: "018f0000-0000-7000-8000-000000000001",
    organizationId: "018f0000-0000-7000-8000-000000000002",
    realmId: "018f0000-0000-7000-8000-000000000003",
    roles: ["member"],
    updatedAt: 2,
    userId: "user-1",
  }
  const cases: readonly { readonly body: unknown; readonly field: (typeof membershipListInvalidFields)[number] }[] = [
    { body: { items: [], leaked: secretValue }, field: "envelope" },
    { body: { items: secretValue }, field: "items" },
    { body: { items: [{ ...validItem, id: secretValue }] }, field: "id" },
    { body: { items: [{ ...validItem, realmId: secretValue }] }, field: "realm-id" },
    { body: { items: [{ ...validItem, organizationId: secretValue }] }, field: "organization-id" },
    { body: { items: [{ ...validItem, userId: { secret: secretValue } }] }, field: "user-id" },
    { body: { items: [{ ...validItem, createdAt: secretValue }] }, field: "created-at" },
    { body: { items: [{ ...validItem, updatedAt: secretValue }] }, field: "updated-at" },
    { body: { items: [{ ...validItem, roles: [secretValue] }] }, field: "roles" },
    { body: { items: [validItem], nextPageToken: { secret: secretValue } }, field: "next-page-token" },
    { body: { items: [{ ...validItem, secret: secretValue }] }, field: "unknown" },
  ]
  for (const { body, field } of cases) {
    expect(organizationMembershipListResponseInvalidFieldClassify(body)).toBe(field)
    const output = passwordContentorenSsoTestProductionEnsureFailureOutputCreate(
      `passwords.contentoren-ssotest-ensure.api-invalid-response.membership-list.${field}`,
    )
    expect(output).toBe(
      `{"error":{"code":"passwords.contentoren-ssotest-ensure.api-invalid-response.membership-list.${field}"}}\n`,
    )
    expect(output).not.toContain(secretValue)
  }
})

test("Contentoren membership-list diagnostics classify every rejected membership ID as id", () => {
  const validItem = {
    createdAt: 1,
    id: "018f0000-0000-7000-8000-000000000001",
    organizationId: "018f0000-0000-7000-8000-000000000002",
    realmId: "018f0000-0000-7000-8000-000000000003",
    roles: ["member"],
    updatedAt: 2,
    userId: "user-1",
  }
  const invalidIds = [
    "membership-",
    "membership-0",
    "membership-01",
    "membership-123456789012345678901",
    "membership-1/2",
    "membership-1\\2",
    "membership-1.2",
    "membership-1\u0000",
    "zitadel-membership-1",
    "zitadel-membership-0-1",
    "zitadel-membership-01-1",
    "zitadel-membership-1-01",
    "zitadel-membership-123456789012345678901-1",
    "zitadel-membership-1-123456789012345678901",
    "zitadel-membership-1-2/3",
    "zitadel-membership-1-2\\3",
    "zitadel-membership-1-2.3",
    "zitadel-membership-1-2\n",
    "018F0000-0000-7000-8000-000000000001",
  ]
  for (const id of invalidIds)
    expect(organizationMembershipListResponseInvalidFieldClassify({ items: [{ ...validItem, id }] })).toBe("id")
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
  expect(exitCode).toBe(1)
  expect(stdout).toBe("")
  expect(stderr).toBe('{"error":{"code":"passwords.contentoren-ssotest-ensure.input-invalid"}}\n')
  expect(stderr).not.toContain(privateEmail)
  expect(stderr).not.toContain(malformedPassword)
  expect(stderr).not.toContain(systemSecret)
})

test("Contentoren ssotest command rejects unavailable authorization without disclosure", async () => {
  const secretToken = "short-token-secret"
  const child = Bun.spawn(["bun", "src/outputs/cli.ts", "passwords", "contentoren-ssotest-production-ensure"], {
    env: {
      ...process.env,
      AUTHWORKS_CONTENTOREN_SSOTEST_EMAIL: privateEmail,
      AUTHWORKS_CONTENTOREN_SSOTEST_PASSWORD: privatePassword,
      AUTHWORKS_TOKEN: secretToken,
    },
    stderr: "pipe",
    stdout: "pipe",
  })
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ])
  expect(exitCode).toBe(1)
  expect(stdout).toBe("")
  expect(stderr).toBe('{"error":{"code":"passwords.contentoren-ssotest-ensure.authorization-unavailable"}}\n')
  expect(stderr).not.toContain(privateEmail)
  expect(stderr).not.toContain(privatePassword)
  expect(stderr).not.toContain(secretToken)
})

test("Contentoren ssotest command normalizes every failure category to an allowlisted code", () => {
  const secretText = `${privateEmail} ${privatePassword} ${systemSecret} user-id organization-id password-hash`
  const cases: readonly { readonly code: string; readonly failure: ResultErr | string }[] = [
    {
      code: "passwords.contentoren-ssotest-ensure.authorization-unavailable",
      failure: "passwords.contentoren-ssotest-ensure.authorization-unavailable",
    },
    {
      code: "passwords.contentoren-ssotest-ensure.input-invalid",
      failure: {
        code: "passwords.contentoren-ssotest-ensure.input-invalid",
        errorMessage: secretText,
        op: "fixtureInputParse",
        success: false,
      },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.realm-not-found",
      failure: {
        code: "passwords.contentoren-ssotest-ensure.realm-not-found",
        errorMessage: secretText,
        op: "realm",
        success: false,
      },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.realm-ambiguous",
      failure: {
        code: "passwords.contentoren-ssotest-ensure.realm-ambiguous",
        errorMessage: secretText,
        op: "realm",
        success: false,
      },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.realm-inactive",
      failure: {
        code: "passwords.contentoren-ssotest-ensure.realm-inactive",
        errorMessage: secretText,
        op: "realm",
        success: false,
      },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.organization-not-found",
      failure: {
        code: "passwords.contentoren-ssotest-ensure.organization-not-found",
        errorMessage: secretText,
        op: "organization",
        success: false,
      },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.organization-ambiguous",
      failure: {
        code: "passwords.contentoren-ssotest-ensure.organization-ambiguous",
        errorMessage: secretText,
        op: "organization",
        success: false,
      },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.organization-inactive",
      failure: {
        code: "passwords.contentoren-ssotest-ensure.organization-inactive",
        errorMessage: secretText,
        op: "organization",
        success: false,
      },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.human-ambiguous",
      failure: {
        code: "passwords.contentoren-ssotest-ensure.human-ambiguous",
        errorMessage: secretText,
        op: "user",
        success: false,
      },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.human-conflict",
      failure: {
        code: "passwords.contentoren-ssotest-ensure.human-conflict",
        errorMessage: secretText,
        op: "user",
        success: false,
      },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.human-deleted",
      failure: {
        code: "passwords.contentoren-ssotest-ensure.human-deleted",
        errorMessage: secretText,
        op: "user",
        success: false,
      },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.machine-conflict",
      failure: {
        code: "passwords.contentoren-ssotest-ensure.machine-conflict",
        errorMessage: secretText,
        op: "machine",
        success: false,
      },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.membership-elevated",
      failure: {
        code: "passwords.contentoren-ssotest-ensure.membership-elevated",
        errorMessage: secretText,
        op: "membership",
        success: false,
      },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.membership-ambiguous",
      failure: {
        code: "passwords.contentoren-ssotest-ensure.membership-ambiguous",
        errorMessage: secretText,
        op: "membership",
        success: false,
      },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.password-policy-rejected",
      failure: { errorMessage: secretText, op: "passwordPolicyCheck", success: false },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.api-unreachable",
      failure: { code: "platform.unreachable", errorMessage: secretText, op: "api", success: false },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.api-unauthorized",
      failure: { code: "platform.http", errorMessage: secretText, op: "api", statusCode: 401, success: false },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.api-forbidden",
      failure: { code: "platform.http", errorMessage: secretText, op: "api", statusCode: 403, success: false },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.api-rate-limited",
      failure: { code: "platform.http", errorMessage: secretText, op: "api", statusCode: 429, success: false },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.api-invalid-response",
      failure: { code: "platform.invalid-response", errorMessage: secretText, op: "api", success: false },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.api-rejected.realm-list",
      failure: {
        code: "passwords.contentoren-ssotest-ensure.api-rejected.realm-list",
        errorMessage: secretText,
        op: "api",
        success: false,
      },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.api-failed",
      failure: { code: "unknown.remote-code", errorMessage: secretText, op: "api", statusCode: 500, success: false },
    },
    {
      code: "passwords.contentoren-ssotest-ensure.internal-failed",
      failure: "passwords.contentoren-ssotest-ensure.internal-failed",
    },
  ]
  for (const { code, failure } of cases) {
    expect(passwordContentorenSsoTestProductionEnsureFailureOutputCreate(failure)).toBe(
      `{"error":{"code":"${code}"}}\n`,
    )
    expect(passwordContentorenSsoTestProductionEnsureFailureOutputCreate(failure)).not.toContain(secretText)
  }
  for (const stage of apiInvalidResponseStages) {
    if (stage === "membership-list") continue
    const code = `passwords.contentoren-ssotest-ensure.api-invalid-response.${stage}`
    expect(
      passwordContentorenSsoTestProductionEnsureFailureOutputCreate({
        code,
        errorMessage: secretText,
        op: "api",
        success: false,
      }),
    ).toBe(`{"error":{"code":"${code}"}}\n`)
  }
  for (const stage of apiRejectedStages) {
    const code = `passwords.contentoren-ssotest-ensure.api-rejected.${stage}`
    expect(
      passwordContentorenSsoTestProductionEnsureFailureOutputCreate({
        code,
        errorMessage: secretText,
        op: "api",
        success: false,
      }),
    ).toBe(`{"error":{"code":"${code}"}}\n`)
  }
  expect(
    passwordContentorenSsoTestProductionEnsureFailureOutputCreate({
      code: "platform.http",
      errorMessage: secretText,
      op: "api",
      statusCode: 409,
      success: false,
    }),
  ).toBe('{"error":{"code":"passwords.contentoren-ssotest-ensure.internal-failed"}}\n')
  expect(passwordContentorenSsoTestProductionEnsureFailureOutputCreate("not-allowlisted")).toBe(
    '{"error":{"code":"passwords.contentoren-ssotest-ensure.internal-failed"}}\n',
  )
})

async function invalidResponseStageFixturePrepare(
  fixture: Awaited<ReturnType<typeof productionFixtureCreate>>,
  stage: (typeof apiInvalidResponseStages)[number],
): Promise<void> {
  if (stage === "realm-list" || stage === "organization-list" || stage === "password-policy-get") return
  if (stage === "user-list" || stage === "machine-user-list" || stage === "user-create") {
    if (stage === "user-create") return
    await fixture.ensure(privatePassword)
    return
  }
  const ensured = await fixture.ensure(privatePassword)
  expect(ensured.success).toBe(true)
  const users = await fixture.users.userList(fixture.realmId)
  expect(users.success).toBe(true)
  if (!users.success || users.data.items[0] === undefined) throw new Error("The ssotest user fixture was not created.")
  const user = users.data.items[0]
  if (stage === "user-email-verification-set") {
    const unverified = await fixture.users.userEmailVerificationSet(fixture.realmId, user.id, { state: "unverified" })
    expect(unverified.success).toBe(true)
    return
  }
  if (stage === "user-lifecycle-set") {
    const inactive = await fixture.users.userLifecycleSet(fixture.realmId, user.id, { state: "inactive" })
    expect(inactive.success).toBe(true)
    return
  }
  if (stage === "membership-create") {
    const memberships = await fixture.organizations.organizationMembershipList(fixture.realmId, fixture.organizationId)
    expect(memberships.success).toBe(true)
    if (!memberships.success || memberships.data.items[0] === undefined)
      throw new Error("The ssotest membership fixture was not created.")
    const removed = await fixture.organizations.organizationMembershipRemove(
      fixture.realmId,
      fixture.organizationId,
      memberships.data.items[0].id,
    )
    expect(removed.success).toBe(true)
    return
  }
  if (stage === "membership-update") {
    const memberships = await fixture.organizations.organizationMembershipList(fixture.realmId, fixture.organizationId)
    expect(memberships.success).toBe(true)
    if (!memberships.success || memberships.data.items[0] === undefined)
      throw new Error("The ssotest membership fixture was not created.")
    const changed = await fixture.organizations.organizationMembershipUpdate(
      fixture.realmId,
      fixture.organizationId,
      memberships.data.items[0].id,
      { roles: ["guest"] },
    )
    expect(changed.success).toBe(true)
  }
}

function invalidResponseStageMatches(stage: (typeof apiInvalidResponseStages)[number], request: Request): boolean {
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
