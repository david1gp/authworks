import { expect, test } from "bun:test"
import * as v from "valibot"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { organizationLoginPolicySet } from "../../src/features/organizations/actions/organizationLoginPolicySet.js"
import { organizationLoginPolicyFactorOrderResolve } from "../../src/features/organizations/domain/organizationLoginPolicyFactorOrderResolve.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationRealmLoginPolicyGet } from "../../src/features/organizations/actions/organizationRealmLoginPolicyGet.js"
import { organizationServerAppCreate } from "../../src/features/organizations/server/organizationServerAppCreate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { organizationLoginPolicySetRequestSchema } from "../../src/features/organizations/public/organizationLoginPolicySetRequestSchema.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-organization-security-policy-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function realmAndOrganizationCreate(database: StorageDatabase, suffix: string) {
  const realm = realmCreate({
    context: realmSystemContextCreate(),
    database,
    input: { domain: `${suffix}.example.com`, name: suffix },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const organization = organizationCreate({
    context: realmSystemContextCreate(),
    database,
    input: { name: `${suffix} organization` },
    realmId: realm.data.realm.id,
  })
  expect(organization.success).toBe(true)
  if (!organization.success) throw new Error(organization.errorMessage)
  return { organization: organization.data.organization, realm: realm.data.realm }
}

test("security policy contracts reject unknown and duplicate factors", () => {
  expect(v.safeParse(organizationLoginPolicySetRequestSchema, { allowedFactors: ["totp", "totp"] }).success).toBe(false)
  expect(v.safeParse(organizationLoginPolicySetRequestSchema, { allowedFactors: ["recovery_code"] }).success).toBe(
    false,
  )
  expect(
    v.safeParse(organizationLoginPolicySetRequestSchema, { preferredFactorOrder: ["email_otp", "email_otp"] }).success,
  ).toBe(false)
})

test("security policy defaults and precedence control external identity auto-linking", async () => {
  await withDatabase(async (database) => {
    const { organization, realm } = await realmAndOrganizationCreate(database, "external-auto-link-policy")
    const initial = organizationRealmLoginPolicyGet({ database, realmId: realm.id })
    expect(initial).toMatchObject({ data: { policy: { allowExternalIdentityAutoLinking: true } }, success: true })

    const realmDisabled = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowExternalIdentityAutoLinking: false },
      realmId: realm.id,
    })
    expect(realmDisabled).toMatchObject({
      data: {
        overrides: { allowExternalIdentityAutoLinking: false },
        policy: { allowExternalIdentityAutoLinking: false },
      },
      success: true,
    })

    const organizationInherited = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowExternalIdentityAutoLinking: null },
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(organizationInherited).toMatchObject({
      data: { overrides: {}, policy: { allowExternalIdentityAutoLinking: false } },
      success: true,
    })

    const organizationEnabled = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowExternalIdentityAutoLinking: true },
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(organizationEnabled).toMatchObject({
      data: {
        overrides: { allowExternalIdentityAutoLinking: true },
        policy: { allowExternalIdentityAutoLinking: true },
      },
      success: true,
    })

    const realmEnabled = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowExternalIdentityAutoLinking: true },
      realmId: realm.id,
    })
    expect(realmEnabled.success).toBe(true)

    const organizationDisabled = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowExternalIdentityAutoLinking: false },
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(organizationDisabled).toMatchObject({
      data: { policy: { allowExternalIdentityAutoLinking: false } },
      success: true,
    })

    const organizationCleared = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowExternalIdentityAutoLinking: null },
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(organizationCleared).toMatchObject({
      data: { overrides: {}, policy: { allowExternalIdentityAutoLinking: true } },
      success: true,
    })
    expect(
      database.sqlite
        .query("SELECT allow_external_identity_auto_linking FROM realm_login_policies WHERE realm_id = ?")
        .get(realm.id),
    ).toEqual({ allow_external_identity_auto_linking: 1 })
    expect(
      database.sqlite
        .query("SELECT allow_external_identity_auto_linking FROM organization_login_policies WHERE organization_id = ?")
        .get(organization.id),
    ).toEqual({ allow_external_identity_auto_linking: null })
  })
})

test("security policy resolution fails closed for malformed persisted factor lists", async () => {
  await withDatabase(async (database) => {
    const { realm } = await realmAndOrganizationCreate(database, "malformed-security-policy")
    const saved = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { requiredMfa: false },
      realmId: realm.id,
    })
    expect(saved.success).toBe(true)

    database.sqlite.exec("PRAGMA ignore_check_constraints = ON")
    database.sqlite
      .query("UPDATE realm_login_policies SET allowed_factors = ?, preferred_factor_order = ? WHERE realm_id = ?")
      .run("not-json", '["totp"]', realm.id)
    const malformedFactors = organizationRealmLoginPolicyGet({ database, realmId: realm.id })
    expect(malformedFactors).toMatchObject({ code: "organizations.policy-malformed", success: false })

    database.sqlite
      .query("UPDATE realm_login_policies SET allowed_factors = ?, preferred_factor_order = ? WHERE realm_id = ?")
      .run('["totp"]', "not-json", realm.id)
    const malformedOrder = organizationRealmLoginPolicyGet({ database, realmId: realm.id })
    expect(malformedOrder).toMatchObject({ code: "organizations.policy-malformed", success: false })
    database.sqlite.exec("PRAGMA ignore_check_constraints = OFF")
  })
})

test("security policy resolves defaults, narrowing, strength, ordering, and runtime availability", async () => {
  await withDatabase(async (database) => {
    const { organization, realm } = await realmAndOrganizationCreate(database, "security-policy")
    const defaults = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: {},
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(defaults.success).toBe(false)
    const realmPolicy = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowedFactors: ["totp", "passkey"],
        minimumStepUpAssurance: "multi_factor",
        preferredFactorOrder: ["passkey", "totp"],
        requiredMfa: true,
      },
      realmId: realm.id,
    })
    expect(realmPolicy).toMatchObject({
      data: {
        policy: {
          allowedFactors: ["totp", "passkey"],
          minimumStepUpAssurance: "multi_factor",
          preferredFactorOrder: ["passkey", "totp"],
          requiredMfa: true,
        },
      },
      success: true,
    })

    const inherited = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowedFactors: ["totp"] },
      organizationId: organization.id,
      realmId: realm.id,
    })
    expect(inherited).toMatchObject({
      data: {
        policy: {
          allowedFactors: ["totp"],
          minimumStepUpAssurance: "multi_factor",
          preferredFactorOrder: ["totp"],
          requiredMfa: true,
        },
      },
      success: true,
    })
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate(),
        database,
        input: { allowedFactors: ["email_otp"] },
        organizationId: organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate(),
        database,
        input: { preferredFactorOrder: ["passkey"] },
        organizationId: organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate(),
        database,
        input: { requiredMfa: false },
        organizationId: organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate(),
        database,
        input: { minimumStepUpAssurance: "authenticated" },
        organizationId: organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(false)
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate(),
        database,
        input: { allowedFactors: [], requiredMfa: true },
        organizationId: organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(false)

    expect(
      organizationLoginPolicyFactorOrderResolve({
        organizationOrder: ["passkey"],
        permittedFactors: ["totp", "email_otp", "passkey"],
        realmOrder: ["email_otp"],
        runtimeAvailableFactors: ["totp", "email_otp"],
      }),
    ).toEqual(["email_otp", "totp"])
  })
})

test("security policy persistence, events, routes, clients, and tenant isolation are explicit", async () => {
  await withDatabase(async (database) => {
    const first = await realmAndOrganizationCreate(database, "security-policy-first")
    const second = await realmAndOrganizationCreate(database, "security-policy-second")
    const app = organizationServerAppCreate({ database, systemSecret: "security-policy-secret" })
    const client = organizationApiClientCreate({
      baseUrl: "https://security-policy.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "security-policy-secret",
    })
    const updated = await client.organizationRealmLoginPolicySet(first.realm.id, {
      allowExternalIdentityAutoLinking: false,
      allowedFactors: ["passkey"],
      minimumStepUpAssurance: "multi_factor",
      preferredFactorOrder: ["passkey"],
      requiredMfa: true,
    })
    expect(updated.success).toBe(true)
    expect(updated).toMatchObject({ data: { policy: { allowExternalIdentityAutoLinking: false } }, success: true })
    const organization = await client.organizationLoginPolicySet(first.realm.id, first.organization.id, {
      allowExternalIdentityAutoLinking: true,
      allowedFactors: ["passkey"],
    })
    expect(organization).toMatchObject({
      data: { policy: { allowExternalIdentityAutoLinking: true, allowedFactors: ["passkey"], requiredMfa: true } },
      success: true,
    })
    expect(
      await client.organizationLoginPolicySet(second.realm.id, first.organization.id, { requiredMfa: true }),
    ).toMatchObject({ success: false })
    expect(
      database.sqlite
        .query("SELECT allowed_factors, required_mfa, allow_external_identity_auto_linking FROM realm_login_policies")
        .get(),
    ).toEqual({
      allowed_factors: '["passkey"]',
      required_mfa: 1,
      allow_external_identity_auto_linking: 0,
    })
    const event = database.sqlite
      .query(
        "SELECT aggregate_id, payload FROM events WHERE event_type = 'organization.login_policy_changed' AND aggregate_id = ? ORDER BY position DESC",
      )
      .get(first.realm.id) as { aggregate_id: string; payload: string }
    expect(event.aggregate_id).toBe(first.realm.id)
    expect(JSON.parse(event.payload)).toMatchObject({ policy: { allowedFactors: ["passkey"], requiredMfa: true } })
  })
})

test("security policy CLI exposes realm and organization administration commands", async () => {
  const child = Bun.spawn(["bun", "src/outputs/cli.ts", "organizations", "--help"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const output = await new Response(child.stdout).text()
  expect(await child.exited).toBe(0)
  expect(output).toContain("login-policy-get")
  expect(output).toContain("login-policy-set")
  expect(output).toContain("realm-login-policy-get")
  expect(output).toContain("realm-login-policy-set")
})
