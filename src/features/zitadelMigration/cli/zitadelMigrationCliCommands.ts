import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { chmod, readFile, writeFile } from "node:fs/promises"
import { zitadelApiClientCreate } from "../client/zitadelApiClientCreate.js"
import { zitadelMigrationExport } from "../actions/zitadelMigrationExport.js"
import { zitadelMigrationImport } from "../actions/zitadelMigrationImport.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { zitadelMigrationSnapshotSchema } from "../public/zitadelMigrationSnapshotSchema.js"
import * as v from "valibot"

type ExportCliFlags = {
  readonly apiUrl?: string
  readonly output?: string
  readonly pageSize?: number
  readonly token?: string
}

type ImportCliFlags = {
  readonly database?: string
  readonly input?: string
  readonly realmId?: string
}

const exportCommand = buildCommand({
  async func(this: ApplicationContext, flags: ExportCliFlags) {
    const apiUrl = requiredValue(this, flags.apiUrl, "ZITADEL_API_URL", "ZITADEL API URL")
    const token = requiredValue(this, flags.token, "ZITADEL_SERVICE_ACCOUNT_TOKEN", "ZITADEL service account token")
    const output = requiredValue(this, flags.output, "AUTHWORKS_MIGRATION_SNAPSHOT_PATH", "migration snapshot path")
    if (apiUrl === undefined || token === undefined || output === undefined) return
    const pageSize = flags.pageSize ?? numberEnvironmentGet(this, "ZITADEL_SEARCH_PAGE_SIZE")
    const result = await zitadelMigrationExport({
      api: zitadelApiClientCreate({ baseUrl: apiUrl, pageSize, token }),
    })
    if (!result.success) return cliErrorWrite(this, result.errorMessage)
    const written = await snapshotWrite(output, result.data.snapshot)
    if (!written.success) return cliErrorWrite(this, written.errorMessage)
    this.process.stdout.write(`${JSON.stringify(result.data.report)}\n`)
  },
  parameters: {
    flags: {
      apiUrl: optionalTextFlag("ZITADEL API URL"),
      output: optionalTextFlag("Output migration snapshot path"),
      pageSize: optionalNumberFlag("ZITADEL search page size"),
      token: optionalTextFlag("ZITADEL service account token"),
    },
  },
  docs: { brief: "Export users and authorization data from ZITADEL" },
})

const importCommand = buildCommand({
  async func(this: ApplicationContext, flags: ImportCliFlags) {
    const databasePath = requiredValue(this, flags.database, "AUTHWORKS_DATABASE_PATH", "Authworks database path")
    const realmId = requiredValue(this, flags.realmId, "AUTHWORKS_REALM_ID", "Authworks realm ID")
    const input = requiredValue(this, flags.input, "AUTHWORKS_MIGRATION_SNAPSHOT_PATH", "migration snapshot path")
    if (databasePath === undefined || realmId === undefined || input === undefined) return
    const snapshot = await snapshotRead(input)
    if (!snapshot.success) return cliErrorWrite(this, snapshot.errorMessage)
    const database = storageDatabaseOpen(databasePath)
    if (!database.success) return cliErrorWrite(this, database.errorMessage)
    try {
      const result = zitadelMigrationImport({ database: database.data, realmId, snapshot: snapshot.data })
      if (!result.success) return cliErrorWrite(this, result.errorMessage)
      this.process.stdout.write(`${JSON.stringify(result.data)}\n`)
    } finally {
      database.data.close()
    }
  },
  parameters: {
    flags: {
      database: optionalTextFlag("Authworks SQLite database path"),
      input: optionalTextFlag("Input migration snapshot path"),
      realmId: optionalTextFlag("Authworks realm ID"),
    },
  },
  docs: { brief: "Import a ZITADEL migration snapshot into Authworks" },
})

export const zitadelMigrationCliCommands = buildRouteMap({
  routes: {
    export: exportCommand,
    import: importCommand,
  },
  docs: { brief: "ZITADEL migration" },
})

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

async function snapshotWrite(path: string, snapshot: unknown) {
  try {
    await writeFile(path, `${JSON.stringify(snapshot)}\n`, { encoding: "utf8", mode: 0o600 })
    await chmod(path, 0o600)
    return { success: true as const }
  } catch (_error) {
    return { errorMessage: "The migration snapshot could not be written.", success: false as const }
  }
}

function cliErrorWrite(context: ApplicationContext, message: string) {
  context.process.stderr.write(`${message}\n`)
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
