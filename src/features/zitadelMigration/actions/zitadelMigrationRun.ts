import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { type ZitadelApiClientCreateOptions, zitadelApiClientCreate } from "../client/zitadelApiClientCreate.js"
import { zitadelMigrationExport } from "./zitadelMigrationExport.js"
import { zitadelMigrationImport } from "./zitadelMigrationImport.js"
import type { ZitadelMigrationIssue } from "../public/zitadelMigrationIssue.js"
import type { ZitadelMigrationProviderCredentialBundle } from "../public/zitadelMigrationProviderCredentialBundleSchema.js"

export type ZitadelMigrationApiClient = Parameters<typeof zitadelMigrationExport>[0]["api"]
export type ZitadelMigrationRunOptions = {
  readonly api?: ZitadelMigrationApiClient
  readonly apiConfig?: ZitadelApiClientCreateOptions
  readonly authoritative?: boolean
  readonly database: StorageDatabase
  readonly dryRun?: boolean
  readonly realmId: string
  readonly providerCredentialBundle?: ZitadelMigrationProviderCredentialBundle
}

export async function zitadelMigrationRun(options: ZitadelMigrationRunOptions): Promise<
  Result<{
    readonly exportReport: Awaited<ReturnType<typeof zitadelMigrationExport>> extends Result<infer T>
      ? T extends { readonly report: infer R }
        ? R
        : never
      : never
    readonly importReport: ReturnType<typeof zitadelMigrationImport> extends Result<infer T> ? T : never
    readonly snapshot: Awaited<ReturnType<typeof zitadelMigrationExport>> extends Result<infer T>
      ? T extends { readonly snapshot: infer S }
        ? S
        : never
      : never
    readonly snapshotMetadata: {
      readonly exportedAt: number
      readonly sourceInstance: string
      readonly version: number
    }
    readonly issues: readonly ZitadelMigrationIssue[]
  }>
> {
  const api = options.api ?? (options.apiConfig === undefined ? undefined : zitadelApiClientCreate(options.apiConfig))
  if (api === undefined)
    return resultErrorCodedCreate(
      "zitadelMigrationRun",
      "A ZITADEL API client or configuration is required.",
      "zitadel-migration.credentials-required",
    )
  const exported = await zitadelMigrationExport({ api })
  if (!exported.success) return exported
  const imported = zitadelMigrationImport({
    authoritative: options.authoritative === true,
    database: options.database,
    dryRun: options.dryRun,
    realmId: options.realmId,
    snapshot: exported.data.snapshot,
    providerCredentialBundle: options.providerCredentialBundle,
  })
  if (!imported.success) return imported
  return resultCreate({
    exportReport: exported.data.report,
    importReport: imported.data,
    snapshot: exported.data.snapshot,
    snapshotMetadata: {
      exportedAt: exported.data.snapshot.exportedAt,
      sourceInstance: exported.data.snapshot.sourceInstance,
      version: exported.data.snapshot.version,
    },
    issues: exported.data.report.issues,
  })
}
