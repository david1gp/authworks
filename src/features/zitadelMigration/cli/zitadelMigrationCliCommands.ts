import { chmod, lstat, open, readFile, rename, unlink } from "node:fs/promises"
import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import * as v from "valibot"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { connectionProfileCliCentralFlags } from "../../connectionProfiles/cli/connectionProfileCliCentralFlags.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { zitadelMigrationExport } from "../actions/zitadelMigrationExport.js"
import { zitadelMigrationImport } from "../actions/zitadelMigrationImport.js"
import { zitadelMigrationRun } from "../actions/zitadelMigrationRun.js"
import { zitadelApiClientCreate } from "../client/zitadelApiClientCreate.js"
import { zitadelMigrationProviderCredentialBundleSchema } from "../public/zitadelMigrationProviderCredentialBundleSchema.js"
import { zitadelMigrationSnapshotSchema } from "../public/zitadelMigrationSnapshotSchema.js"

type ExportCliFlags = {
  readonly apiUrl?: string
  readonly output?: string
  readonly pageSize?: number
  readonly profile?: string
  readonly token?: string
}

type ImportCliFlags = {
  readonly authoritative?: boolean
  readonly confirmDestructive?: boolean
  readonly database?: string
  readonly dryRun?: boolean
  readonly input?: string
  readonly profile?: string
  readonly realmId?: string
  readonly providerCredentials?: string
}

type RunCliFlags = Omit<ExportCliFlags, "output"> &
  Omit<ImportCliFlags, "input"> & {
    readonly authoritative?: boolean
    readonly confirmDestructive?: boolean
    readonly dryRun?: boolean
    readonly snapshotOutput?: string
    readonly credentialOutput?: string
  }

const runCommand = buildCommand({
  async func(this: ApplicationContext, flags: RunCliFlags) {
    const connection = await zitadelMigrationConnectionResolve(this, flags)
    if (!connection.success) return cliErrorWrite(this, connection.errorMessage)
    const apiUrl = requiredValue(this, flags.apiUrl, "ZITADEL_API_URL", "ZITADEL API URL")
    const token = requiredValue(this, flags.token, "ZITADEL_SERVICE_ACCOUNT_TOKEN", "ZITADEL service account token")
    const databasePath = requiredValue(this, flags.database, "AUTHWORKS_DATABASE_PATH", "Authworks database path")
    const realmId = requiredValue(this, connection.data.realmId, "AUTHWORKS_REALM_ID", "Authworks realm ID")
    if (apiUrl === undefined || token === undefined || databasePath === undefined || realmId === undefined) return
    if (flags.confirmDestructive && !flags.authoritative) {
      return cliErrorWrite(this, "--confirm-destructive requires --authoritative.")
    }
    if (flags.authoritative && !flags.dryRun && !flags.confirmDestructive) {
      return cliErrorWrite(this, "Authoritative migration requires --confirm-destructive; no deletion was performed.")
    }
    if (flags.credentialOutput !== undefined)
      return cliErrorWrite(
        this,
        "Credential output is unavailable: this migration only reports required rotations and generates no credentials.",
      )
    const providerCredentials = await providerCredentialBundleRead(
      flags.providerCredentials ?? this.process.env?.AUTHWORKS_MIGRATION_PROVIDER_CREDENTIALS_PATH,
    )
    if (!providerCredentials.success) return cliErrorWrite(this, providerCredentials.errorMessage)
    const database = storageDatabaseOpen(databasePath)
    if (!database.success) return cliErrorWrite(this, database.errorMessage, [token])
    try {
      const result = await zitadelMigrationRun({
        apiConfig: {
          baseUrl: apiUrl,
          pageSize: flags.pageSize ?? numberEnvironmentGet(this, "ZITADEL_SEARCH_PAGE_SIZE"),
          token,
        },
        authoritative: flags.authoritative === true,
        database: database.data,
        dryRun: flags.dryRun,
        realmId,
        providerCredentialBundle: providerCredentials.data,
      })
      if (!result.success) return cliErrorWrite(this, result.errorMessage, [token])
      if (flags.snapshotOutput !== undefined) {
        const snapshot = await zitadelMigrationSnapshotWrite(flags.snapshotOutput, result.data.snapshot)
        if (!snapshot.success) return cliErrorWrite(this, snapshot.errorMessage, [token])
      }
      const counts = Object.values(result.data.importReport.counts)
      const summary = {
        created: counts.reduce((total, count) => total + count.created, 0),
        updated: counts.reduce((total, count) => total + count.updated, 0),
        unchanged: counts.reduce((total, count) => total + count.unchanged, 0),
        deleted: result.data.importReport.deleted,
        stale: result.data.importReport.stale,
        skipped: result.data.importReport.skipped.length,
        unsupported: result.data.importReport.unsupported.length,
        incomplete: Object.values(result.data.snapshot.completeness).filter((item) => !item.complete).length,
        requiresRotation: result.data.importReport.requiresRotation,
        rotated: result.data.importReport.rotated,
        conflicts: result.data.importReport.conflicts,
      }
      this.process.stdout.write(
        `${connectionProfileCliOutputRedact(JSON.stringify({ ...summary, import: result.data.importReport, export: result.data.exportReport, credentialOutput: "No credentials generated; required rotations are reported without secrets." }), [token])}\n`,
      )
      this.process.exitCode = 0
    } finally {
      database.data.close()
    }
  },
  parameters: {
    flags: {
      apiUrl: optionalTextFlag("ZITADEL API URL"),
      database: optionalTextFlag("Authworks SQLite database path"),
      pageSize: optionalNumberFlag("ZITADEL search page size"),
      ...connectionProfileCliCentralFlags(),
      token: optionalTextFlag("ZITADEL service account token"),
      realmId: optionalTextFlag("Authworks realm ID"),
      authoritative: { brief: "Delete stale source-owned records", kind: "boolean", optional: true },
      confirmDestructive: { brief: "Acknowledge authoritative deletion", kind: "boolean", optional: true },
      dryRun: { brief: "Plan without changing the database", kind: "boolean", optional: true },
      snapshotOutput: optionalTextFlag("Protected snapshot output path"),
      credentialOutput: optionalTextFlag("Rotated credential output path"),
      providerCredentials: optionalTextFlag("Secure provider credential bundle path"),
    },
  },
  docs: { brief: "Export and import ZITADEL in one operation" },
})

const exportCommand = buildCommand({
  async func(this: ApplicationContext, flags: ExportCliFlags) {
    const connection = await zitadelMigrationConnectionResolve(this, flags)
    if (!connection.success) return cliErrorWrite(this, connection.errorMessage)
    const apiUrl = requiredValue(this, flags.apiUrl, "ZITADEL_API_URL", "ZITADEL API URL")
    const token = requiredValue(this, flags.token, "ZITADEL_SERVICE_ACCOUNT_TOKEN", "ZITADEL service account token")
    const output = requiredValue(this, flags.output, "AUTHWORKS_MIGRATION_SNAPSHOT_PATH", "migration snapshot path")
    if (apiUrl === undefined || token === undefined || output === undefined) return
    const pageSize = flags.pageSize ?? numberEnvironmentGet(this, "ZITADEL_SEARCH_PAGE_SIZE")
    const result = await zitadelMigrationExport({
      api: zitadelApiClientCreate({ baseUrl: apiUrl, pageSize, token }),
    })
    if (!result.success) return cliErrorWrite(this, result.errorMessage, [token])
    const written = await zitadelMigrationSnapshotWrite(output, result.data.snapshot)
    if (!written.success) return cliErrorWrite(this, written.errorMessage, [token])
    this.process.stdout.write(
      `${connectionProfileCliOutputRedact(
        JSON.stringify({
          ...result.data.report,
          issues: result.data.report.issues,
          conflicts: 0,
          requiresRotation: { count: 0, sourceIds: [] },
          rotated: 0,
        }),
        [token],
      )}\n`,
    )
    this.process.exitCode = 0
  },
  parameters: {
    flags: {
      apiUrl: optionalTextFlag("ZITADEL API URL"),
      output: optionalTextFlag("Output migration snapshot path"),
      pageSize: optionalNumberFlag("ZITADEL search page size"),
      ...connectionProfileCliCentralFlags(),
      token: optionalTextFlag("ZITADEL service account token"),
    },
  },
  docs: { brief: "Export users and authorization data from ZITADEL" },
})

const importCommand = buildCommand({
  async func(this: ApplicationContext, flags: ImportCliFlags) {
    const connection = await zitadelMigrationConnectionResolve(this, flags)
    if (!connection.success) return cliErrorWrite(this, connection.errorMessage)
    const databasePath = requiredValue(this, flags.database, "AUTHWORKS_DATABASE_PATH", "Authworks database path")
    const realmId = requiredValue(this, connection.data.realmId, "AUTHWORKS_REALM_ID", "Authworks realm ID")
    const input = requiredValue(this, flags.input, "AUTHWORKS_MIGRATION_SNAPSHOT_PATH", "migration snapshot path")
    if (databasePath === undefined || realmId === undefined || input === undefined) return
    if (flags.confirmDestructive && !flags.authoritative)
      return cliErrorWrite(this, "--confirm-destructive requires --authoritative.")
    if (flags.authoritative && !flags.dryRun && !flags.confirmDestructive)
      return cliErrorWrite(this, "Authoritative migration requires --confirm-destructive; no deletion was performed.")
    const snapshot = await snapshotRead(input)
    if (!snapshot.success) return cliErrorWrite(this, snapshot.errorMessage)
    const providerCredentials = await providerCredentialBundleRead(
      flags.providerCredentials ?? this.process.env?.AUTHWORKS_MIGRATION_PROVIDER_CREDENTIALS_PATH,
    )
    if (!providerCredentials.success) return cliErrorWrite(this, providerCredentials.errorMessage)
    const database = storageDatabaseOpen(databasePath)
    if (!database.success) return cliErrorWrite(this, database.errorMessage)
    try {
      const result = zitadelMigrationImport({
        authoritative: flags.authoritative === true,
        database: database.data,
        dryRun: flags.dryRun,
        realmId,
        snapshot: snapshot.data,
        providerCredentialBundle: providerCredentials.data,
      })
      if (!result.success) return cliErrorWrite(this, result.errorMessage)
      this.process.stdout.write(`${connectionProfileCliOutputRedact(JSON.stringify(result.data), [])}\n`)
      this.process.exitCode = 0
    } finally {
      database.data.close()
    }
  },
  parameters: {
    flags: {
      database: optionalTextFlag("Authworks SQLite database path"),
      authoritative: { brief: "Delete stale source-owned records", kind: "boolean", optional: true },
      confirmDestructive: { brief: "Acknowledge authoritative deletion", kind: "boolean", optional: true },
      dryRun: { brief: "Plan without changing the database", kind: "boolean", optional: true },
      input: optionalTextFlag("Input migration snapshot path"),
      ...connectionProfileCliCentralFlags(),
      realmId: optionalTextFlag("Authworks realm ID"),
      providerCredentials: optionalTextFlag("Secure provider credential bundle path"),
    },
  },
  docs: { brief: "Import a ZITADEL migration snapshot into Authworks" },
})

export const zitadelMigrationCliCommands = buildRouteMap({
  routes: {
    export: exportCommand,
    import: importCommand,
    run: runCommand,
  },
  docs: { brief: "ZITADEL migration" },
})

async function zitadelMigrationConnectionResolve(context: ApplicationContext, flags: ExportCliFlags | ImportCliFlags) {
  return connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
}

function requiredValue(
  context: ApplicationContext,
  flagValue: string | undefined,
  environmentName: string,
  description: string,
): string | undefined {
  const value = flagValue ?? context.process.env?.[environmentName]
  if (value !== undefined && value.length > 0) return value
  context.process.stderr.write(`Missing ${description}; set ${environmentName} or pass the corresponding flag.\n`)
  context.process.exitCode = 1
  return undefined
}

function numberEnvironmentGet(context: ApplicationContext, name: string): number | undefined {
  const value = context.process.env?.[name]
  if (value === undefined || value.length === 0) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

async function snapshotRead(path: string) {
  try {
    const input = JSON.parse(await readFile(path, "utf8")) as unknown
    const parsed = v.safeParse(zitadelMigrationSnapshotSchema, input)
    if (!parsed.success) return { errorMessage: "The migration snapshot is invalid.", success: false as const }
    return { data: parsed.output, success: true as const }
  } catch (_error) {
    return { errorMessage: "The migration snapshot could not be read.", success: false as const }
  }
}

const providerCredentialBundleMaximumBytes = 1024 * 1024

async function providerCredentialBundleRead(path: string | undefined) {
  if (path === undefined || path.length === 0) return { data: undefined, success: true as const }
  try {
    const metadata = await lstat(path)
    if (!metadata.isFile() || (metadata.mode & 0o077) !== 0 || metadata.size > providerCredentialBundleMaximumBytes)
      return {
        errorMessage: "The provider credential bundle file is not a permitted private file.",
        success: false as const,
      }
    const input = JSON.parse(await readFile(path, "utf8")) as unknown
    const parsed = v.safeParse(zitadelMigrationProviderCredentialBundleSchema, input)
    if (!parsed.success) return { errorMessage: "The provider credential bundle is invalid.", success: false as const }
    return { data: parsed.output, success: true as const }
  } catch (_error) {
    return { errorMessage: "The provider credential bundle could not be read.", success: false as const }
  }
}

export async function zitadelMigrationSnapshotWrite(path: string, snapshot: unknown) {
  const parsed = v.safeParse(zitadelMigrationSnapshotSchema, snapshot)
  if (!parsed.success) return { errorMessage: "The migration snapshot is invalid.", success: false as const }
  const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`
  try {
    try {
      const existing = await lstat(path)
      if (existing.isSymbolicLink())
        return { errorMessage: "Refusing to write through a symbolic link.", success: false as const }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
    const handle = await open(temporaryPath, "wx", 0o600)
    try {
      await handle.writeFile(`${JSON.stringify(parsed.output)}\n`, "utf8")
    } finally {
      await handle.close()
    }
    await chmod(temporaryPath, 0o600)
    await rename(temporaryPath, path)
    return { success: true as const }
  } catch (_error) {
    await unlink(temporaryPath).catch(() => undefined)
    return { errorMessage: "The migration snapshot could not be written.", success: false as const }
  }
}

function cliErrorWrite(context: ApplicationContext, message: string, secrets: readonly (string | undefined)[] = []) {
  context.process.stderr.write(`${connectionProfileCliOutputRedact(message, secrets)}\n`)
  context.process.exitCode = 1
}

function optionalTextFlag(brief: string) {
  return {
    brief,
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "VALUE",
  }
}

function optionalNumberFlag(brief: string) {
  return {
    brief,
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => Number(value),
    placeholder: "NUMBER",
  }
}
