import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationLoginPolicyGet } from "../../organizations/actions/organizationLoginPolicyGet.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { zitadelMigrationDurationSecondsGet } from "../domain/zitadelMigrationDurationSecondsGet.js"
import { zitadelMigrationSourceRecordRepositoryCreate } from "../persistence/zitadelMigrationSourceRecordRepositoryCreate.js"
import { zitadelMigrationExport } from "./zitadelMigrationExport.js"
import { zitadelMigrationImport } from "./zitadelMigrationImport.js"

const apiBase = {
  organizationsList: async () => ({ success: true as const, data: [] }),
  usersList: async () => ({ success: true as const, data: [] }),
  machineUsersList: async () => ({ success: true as const, data: [] }),
  organizationMembershipsList: async () => ({ success: true as const, data: [] }),
  projectsList: async () => ({ success: true as const, data: [] }),
  projectGrantsList: async () => ({ success: true as const, data: [] }),
  projectRolesList: async () => ({ success: true as const, data: [] }),
  projectApplicationsList: async () => ({ success: true as const, data: [] }),
  organizationDomainsList: async () => ({ success: true as const, data: [] }),
  identityProvidersList: async () => ({ success: true as const, data: [] }),
}

const lifetimePolicy = {
  allowExternalIdp: false,
  allowUsernamePassword: true,
  forceMfa: true,
  forceMfaLocalOnly: true,
  mfaInitSkipLifetime: "2592000s",
  multiFactorCheckLifetime: "7200s",
  secondFactorCheckLifetime: { seconds: "3600" },
}

async function exportLifetimes() {
  return zitadelMigrationExport({
    api: {
      ...apiBase,
      organizationsList: async () => ({
        success: true as const,
        data: [{ details: { creationDate: 1 }, id: "123", name: "Org", state: "ORGANIZATION_STATE_ACTIVE" }],
      }),
      organizationLoginPolicyGet: async () => ({ success: true as const, data: lifetimePolicy }),
    } as never,
  })
}

describe("zitadel migration mfa lifetimes", () => {
  test("parses zitadel durations into seconds", () => {
    expect(zitadelMigrationDurationSecondsGet("2592000s")).toBe(2_592_000)
    expect(zitadelMigrationDurationSecondsGet("3600.9s")).toBe(3600)
    expect(zitadelMigrationDurationSecondsGet({ seconds: "7200" })).toBe(7200)
    expect(zitadelMigrationDurationSecondsGet({ nanos: 2_500_000_000, seconds: 60 })).toBe(62)
    expect(zitadelMigrationDurationSecondsGet(90)).toBe(90)
    expect(zitadelMigrationDurationSecondsGet(undefined)).toBeUndefined()
    expect(zitadelMigrationDurationSecondsGet("tomorrow")).toBeUndefined()
    expect(zitadelMigrationDurationSecondsGet(-5)).toBeUndefined()
    expect(zitadelMigrationDurationSecondsGet({})).toBeUndefined()
  })

  test("exports mfa lifetime fields from the login policy", async () => {
    const result = await exportLifetimes()
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.snapshot.loginPolicies[0]).toEqual({
      allowExternalIdp: false,
      allowUsernamePassword: true,
      forceMfaLocalOnly: true,
      mfaInitSkipLifetimeSeconds: 2_592_000,
      multiFactorCheckLifetimeSeconds: 7200,
      organizationId: "123",
      secondFactorCheckLifetimeSeconds: 3600,
      sourceId: "123",
    })
  })

  test("round-trips mfa lifetime fields through import onto the organization policy", async () => {
    const exported = await exportLifetimes()
    expect(exported.success).toBe(true)
    if (!exported.success) return
    const directory = await mkdtemp(join(tmpdir(), "authworks-migration-mfa-lifetimes-"))
    const testkit = platformTestkitCreate()
    const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
    expect(opened.success).toBe(true)
    if (!opened.success) throw new Error(opened.errorMessage)
    try {
      const database: StorageDatabase = opened.data
      const realm = realmCreate({
        context: realmSystemContextCreate(),
        database,
        input: { domain: "lifetimes.example.com", name: "Lifetimes" },
        runtime: testkit.runtime,
      })
      expect(realm.success).toBe(true)
      if (!realm.success) return
      const realmId = realm.data.realm.id
      const imported = zitadelMigrationImport({ database, realmId, snapshot: exported.data.snapshot })
      expect(imported.success).toBe(true)
      if (!imported.success) return
      const mapping = zitadelMigrationSourceRecordRepositoryCreate(database.db).sourceRecordGet(
        realmId,
        exported.data.snapshot.sourceInstance,
        "loginPolicy",
        "123",
      )
      expect(mapping.success).toBe(true)
      if (!mapping.success || mapping.data === null) throw new Error("The login policy mapping was not found.")
      const policy = organizationLoginPolicyGet({
        database,
        organizationId: mapping.data.destinationId,
        realmId,
      })
      expect(policy).toMatchObject({
        data: {
          policy: {
            forceMfaLocalOnly: true,
            mfaInitSkipLifetimeSeconds: 2_592_000,
            multiFactorCheckLifetimeSeconds: 7200,
            secondFactorCheckLifetimeSeconds: 3600,
          },
        },
        success: true,
      })
    } finally {
      opened.data.close()
      await rm(directory, { force: true, recursive: true })
    }
  })
})
