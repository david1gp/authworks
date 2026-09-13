import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { zitadelMigrationDeletionPlanCreate } from "../../src/features/zitadelMigration/actions/zitadelMigrationDeletionPlanCreate.js"
import type { ZitadelMigrationSourceRecord } from "../../src/features/zitadelMigration/persistence/zitadelMigrationSourceRecordTable.js"
import type { ZitadelMigrationSnapshot } from "../../src/features/zitadelMigration/public/zitadelMigrationSnapshotSchema.js"

test("task 10 plans only mapped records in exact dependency order", () => {
  const snapshot = snapshotCreate()
  const mappings = mappingCreate([
    ["externalIdentityLink", "link"],
    ["identityProvider", "provider"],
    ["machineUser", "machine"],
    ["projectGrant", "grant"],
    ["projectRole", "role"],
    ["projectApplication", "application"],
    ["project", "project"],
    ["organizationMembership", "membership"],
    ["domain", "domain"],
    ["loginPolicy", "policy"],
  ])
  const plan = zitadelMigrationDeletionPlanCreate(snapshot, { mappings })
  expect(plan.entries.map((entry) => entry.entityType)).toEqual([
    "externalIdentityLink",
    "identityProvider",
    "machineUser",
    "projectGrant",
    "projectRole",
    "projectApplication",
    "project",
  ])
})

test("task 10 omits incomplete collections and users or organizations", () => {
  const snapshot = snapshotCreate()
  snapshot.completeness.projects = { complete: false, count: 0 }
  const result = zitadelMigrationDeletionPlanCreate(snapshot, {
    mappings: mappingCreate([
      ["project", "project"],
      ["user", "user"],
      ["organization", "organization"],
    ]),
  })
  expect(result.entries).toEqual([])
  expect(result.omissions).toEqual([
    { entityType: "project", reason: "collection-incomplete", sourceId: "project" },
    { entityType: "user", reason: "users-and-organizations-not-planned", sourceId: "user" },
    { entityType: "organization", reason: "users-and-organizations-not-planned", sourceId: "organization" },
  ])
})

test("task 10 isolates realm and source, and omits missing source instances", () => {
  const snapshot = snapshotCreate()
  const result = zitadelMigrationDeletionPlanCreate(snapshot, {
    realmId: "realm-a",
    mappings: [
      ...mappingCreate([["project", "a"]], "realm-a", snapshot.sourceInstance),
      ...mappingCreate([["project", "other-realm"]], "realm-b", snapshot.sourceInstance),
      ...mappingCreate([["project", "other-source"]], "realm-a", "https://other.example"),
      ...mappingCreate([["project", "missing-source"]], "realm-a", ""),
    ],
  })
  expect(result.entries.map((entry) => entry.sourceId)).toEqual(["a"])
  expect(result.omissions).toEqual([
    { entityType: "project", reason: "other-source-instance", sourceId: "other-source" },
    { entityType: "project", reason: "missing-source-instance", sourceId: "missing-source" },
  ])
})

test("task 10 omits skipped, conflicted, and unresolved records, but does not delete natives", () => {
  const snapshot = snapshotCreate()
  snapshot.projectRoles = [
    {
      id: "role-without-project-mapping",
      projectId: "missing-project",
      key: "role",
      displayName: "Role",
      group: null,
      createdAt: 1,
      updatedAt: 1,
    },
  ]
  snapshot.completeness.projectRoles = { complete: true, count: 1 }
  const result = zitadelMigrationDeletionPlanCreate(snapshot, {
    mappings: mappingCreate([
      ["project", "skipped"],
      ["project", "conflicted"],
      ["projectRole", "role-without-project-mapping"],
    ]),
    skipped: [
      { entity: "project", sourceId: "skipped", reason: "unsupported" },
      { entity: "project", sourceId: "conflicted", reason: "native-conflict" },
    ],
  })
  expect(result.entries).toEqual([])
  expect(result.omissions).toContainEqual({
    entityType: "project",
    reason: "source-record-unsupported",
    sourceId: "skipped",
  })
})

function snapshotCreate(): ZitadelMigrationSnapshot {
  const snapshot = JSON.parse(
    readFileSync(join(import.meta.dir, "../fixtures/zitadel-migration-snapshot.json"), "utf8"),
  ) as ZitadelMigrationSnapshot
  for (const key of Object.keys(snapshot.completeness) as (keyof ZitadelMigrationSnapshot["completeness"])[]) {
    snapshot[key] = [] as never
    snapshot.completeness[key] = { complete: true, count: 0 }
  }
  return snapshot
}

function mappingCreate(
  values: readonly (readonly [string, string])[],
  realmId = "realm-a",
  sourceInstance = "https://auth.contentoren.de",
): ZitadelMigrationSourceRecord[] {
  return values.map(([entityType, sourceId]) => ({
    realmId,
    sourceInstance,
    entityType,
    sourceId,
    destinationId: `dest-${sourceId}`,
    sourceVersion: null,
    sourceUpdatedAt: null,
  }))
}
