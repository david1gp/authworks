#!/usr/bin/env bun
/**
 * Collect OIDC client IDs scattered across `.env*` files on a remote host
 * (default `leo@leo-server:~/projects`), then import them through the
 * existing ZITADEL migration path (`zitadelMigrationExport` + `zitadelMigrationImport`).
 *
 * The remote inventory is a coverage check: every live remote client ID is
 * matched against the exported ZITADEL snapshot (`sourceId` / `clientId`,
 * including the app-id part of `appId@projectId` client IDs) and the import
 * report, so missing ZITADEL applications are visible instead of silently
 * skipped.
 *
 * Usage:
 *   bun run scripts/zitadelRemoteClientIdsImport.ts --inventory-only
 *   ZITADEL_API_URL=https://auth.example.com \
 *   ZITADEL_SERVICE_ACCOUNT_TOKEN=... \
 *   bun run scripts/zitadelRemoteClientIdsImport.ts --snapshot-out ./snapshot.json
 *   ZITADEL_API_URL=... ZITADEL_SERVICE_ACCOUNT_TOKEN=... \
 *   AUTHWORKS_DATABASE_PATH=./authworks.sqlite AUTHWORKS_REALM_ID=... \
 *   bun run scripts/zitadelRemoteClientIdsImport.ts --dry-run
 *
 * Flags (all optional, `--flag value` or `--flag=value`; every default is saved
 * in this file so routine runs need no flags):
 *   --ssh-host HOST              SSH target for the remote scan
 *   --projects-dir DIR           Remote directory to scan
 *   --zitadel-dir DIR            Local contentoren-server/zitadel checkout
 *   --inventory-only             Only scan + print the remote inventory
 *   --inventory-out PATH         Write the remote inventory as JSON
 *   --snapshot-out PATH          Write the exported ZITADEL snapshot (mode 0600)
 *   --database PATH              Authworks SQLite path (or AUTHWORKS_DATABASE_PATH,
 *                                default ./authworks.sqlite)
 *   --realm-id ID                Authworks realm ID (or AUTHWORKS_REALM_ID;
 *                                otherwise found by --realm-domain or created)
 *   --realm-domain DOMAIN        Realm domain to find or create
 *   --realm-name NAME            Realm name when creation is needed
 *   --api-url URL                ZITADEL API URL (or ZITADEL_API_URL,
 *                                default from <zitadel-dir>/zitadel-cli.env)
 *   --token TOKEN                ZITADEL token (or ZITADEL_SERVICE_ACCOUNT_TOKEN,
 *                                default from <zitadel-dir>/podman/zitadel.env)
 *   --page-size NUMBER           ZITADEL search page size (or ZITADEL_SEARCH_PAGE_SIZE)
 *   --dry-run                    Plan the import without changing the database
 *   --authoritative              Delete stale source-owned records on import
 *   --confirm-destructive        Acknowledge authoritative deletion
 */

import { execFileSync } from "node:child_process"
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { zitadelApiClientCreate } from "../src/features/zitadelMigration/client/zitadelApiClientCreate.js"
import { zitadelMigrationExport } from "../src/features/zitadelMigration/actions/zitadelMigrationExport.js"
import { zitadelMigrationImport } from "../src/features/zitadelMigration/actions/zitadelMigrationImport.js"
import { realmCreate } from "../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../src/features/realms/domain/realmSystemContextCreate.js"
import { realmRepositoryCreate } from "../src/features/realms/persistence/realmRepositoryCreate.js"
import { storageDatabaseOpen } from "../src/platform/storage/storageDatabaseOpen.js"

// Saved source locations so future runs need no questions asked:
// - Remote `.env*` scan: leo@leo-server:~/projects
// - ZITADEL connection: ~/leo_internal/contentoren-server/zitadel
//   (API URL from zitadel-cli.env, token from podman/zitadel.env)
// - Import target: ./authworks.sqlite, realm ensured by domain.
const defaultSshHost = "leo@leo-server"
const defaultProjectsDir = "~/projects"
const defaultZitadelDir = join(homedir(), "leo_internal", "contentoren-server", "zitadel")
const defaultRealmDomain = "authworks.contentoren.de"
const defaultRealmName = "Contentoren"

type RemoteClientRecord = {
  readonly file: string
  readonly project: string
  readonly key: string
  readonly value: string
  readonly kind: "zitadel" | "authworks" | "placeholder" | "other"
  readonly redirectUri: string | undefined
  readonly issuer: string | undefined
}

type RemoteInventory = {
  readonly host: string
  readonly projectsDir: string
  readonly filesScanned: number
  readonly records: readonly RemoteClientRecord[]
  readonly distinctLiveIds: readonly string[]
}

const clientIdKeys = new Set(["ZITADEL_CLIENT_ID", "OIDC_CLIENT_ID", "VITE_ZITADEL_CLIENT_ID", "AUTHWORKS_CLIENT_ID"])
const contextKeys = new Set([
  "ZITADEL_REDIRECT_URI",
  "OIDC_REDIRECT_URI",
  "ZITADEL_POST_LOGOUT_REDIRECT_URI",
  "OIDC_POST_LOGOUT_REDIRECT_URI",
  "ZITADEL_ISSUER",
  "ZITADEL_ISSUER_URL",
])
const placeholderPattern = /^(replace-with-|change-me-|<|example$|your-|test$|.*example\.test$)/i

function flagGet(args: readonly string[], name: string): string | undefined {
  const prefixed = `--${name}=`
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === `--${name}`) return args[index + 1]
    if (arg.startsWith(prefixed)) return arg.slice(prefixed.length)
  }
  return undefined
}

function flagHas(args: readonly string[], name: string): boolean {
  return args.includes(`--${name}`)
}

function environmentText(name: string): string | undefined {
  const value = process.env[name]
  return value !== undefined && value.length > 0 ? value : undefined
}

function valueClean(raw: string): string {
  let value = raw.trim()
  // Strip trailing shell comments (`KEY=value # comment`), keeping quoted `#`.
  if (!value.startsWith('"') && !value.startsWith("'") && value.includes(" #")) {
    value = value.slice(0, value.indexOf(" #")).trim()
  }
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1).trim()
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).trim()
  return value
}

function recordKind(key: string, value: string): RemoteClientRecord["kind"] {
  if (value.length === 0 || placeholderPattern.test(value)) return "placeholder"
  if (key === "AUTHWORKS_CLIENT_ID") return "authworks"
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return "authworks"
  if (/^\d{10,}$/.test(value)) return "zitadel"
  return "other"
}

function projectGet(file: string, projectsDir: string): string {
  const normalizedDir = projectsDir.replace(/\/+$/, "")
  const withoutHome = file.replace(/^~\/projects/, "~/projects")
  const marker = "/projects/"
  const markerIndex = withoutHome.indexOf(marker)
  if (markerIndex !== -1) {
    const remainder = withoutHome.slice(markerIndex + marker.length)
    const segment = remainder.split("/")[0]
    if (segment !== undefined && segment.length > 0) return segment
  }
  void normalizedDir
  const parts = file.split("/")
  return parts.length >= 2 ? (parts[parts.length - 2] ?? "unknown") : "unknown"
}

function remoteInventoryCollect(host: string, projectsDir: string): RemoteInventory {
  const watchedKeys = [...clientIdKeys, ...contextKeys].join("|")
  // Single SSH round-trip: one `KEY=value` line per match, prefixed with the
  // file path. Dependency/cache/vcs/build output is excluded so vendored
  // `.env.example` files do not pollute the inventory.
  const excludeDirs = ["node_modules", ".cache", ".git", "dist", "build", ".next", "coverage"]
    .map((dir) => `--exclude-dir=${dir}`)
    .join(" ")
  const remoteCommand = `grep -R -n -E '^[[:space:]]*(${watchedKeys})[[:space:]]*=' ${projectsDir} --include='.env*' ${excludeDirs} 2>/dev/null`
  let output: string
  try {
    output = execFileSync("ssh", ["-o", "ConnectTimeout=10", host, remoteCommand], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`Remote scan failed on ${host}: ${message}\n`)
    process.exitCode = 1
    process.exit(1)
  }
  const perFile = new Map<string, Map<string, string>>()
  for (const line of output.split("\n")) {
    if (line.length === 0) continue
    // Format: `<file>:<lineno>:KEY=value`
    const firstColon = line.indexOf(":")
    if (firstColon === -1) continue
    const secondColon = line.indexOf(":", firstColon + 1)
    if (secondColon === -1) continue
    const file = line.slice(0, firstColon)
    const assignment = line.slice(secondColon + 1)
    const equals = assignment.indexOf("=")
    if (equals === -1) continue
    const key = assignment.slice(0, equals).trim()
    if (!clientIdKeys.has(key) && !contextKeys.has(key)) continue
    const value = valueClean(assignment.slice(equals + 1))
    const existing = perFile.get(file) ?? new Map<string, string>()
    existing.set(key, value)
    perFile.set(file, existing)
  }
  const records: RemoteClientRecord[] = []
  for (const [file, values] of perFile) {
    const redirectUri = values.get("ZITADEL_REDIRECT_URI") ?? values.get("OIDC_REDIRECT_URI")
    const issuer = values.get("ZITADEL_ISSUER") ?? values.get("ZITADEL_ISSUER_URL")
    for (const key of clientIdKeys) {
      const raw = values.get(key)
      if (raw === undefined) continue
      records.push({
        file,
        project: projectGet(file, projectsDir),
        key,
        value: raw,
        kind: recordKind(key, raw),
        redirectUri,
        issuer,
      })
    }
  }
  records.sort((left, right) => left.file.localeCompare(right.file) || left.key.localeCompare(right.key))
  const liveIds = [
    ...new Set(records.filter((record) => record.kind === "zitadel").map((record) => record.value)),
  ].sort()
  return { host, projectsDir, filesScanned: perFile.size, records, distinctLiveIds: liveIds }
}

function snapshotMatch(
  snapshot: Awaited<ReturnType<typeof zitadelMigrationExport>> extends { success: true; data: infer D }
    ? D["snapshot"]
    : never,
  clientId: string,
) {
  return snapshot.oidcApplications.filter(
    (application) =>
      application.sourceId === clientId ||
      application.clientId === clientId ||
      application.sourceId.split("@")[0] === clientId ||
      application.clientId?.split("@")[0] === clientId,
  )
}

function zitadelEnvGet(zitadelDir: string, relativePath: string, key: string): string | undefined {
  try {
    if (!existsSync(join(zitadelDir, relativePath))) return undefined
    for (const line of readFileSync(join(zitadelDir, relativePath), "utf8").split("\n")) {
      const trimmed = line.trim()
      if (!trimmed.startsWith(`${key}=`)) continue
      const value = valueClean(trimmed.slice(key.length + 1))
      return value.length > 0 ? value : undefined
    }
  } catch {
    return undefined
  }
  return undefined
}

function realmEnsure(
  database: ReturnType<typeof storageDatabaseOpen> extends { success: true; data: infer D } ? D : never,
  args: readonly string[],
  realmDomain: string,
  realmName: string,
): string | undefined {
  const explicit = flagGet(args, "realm-id") ?? environmentText("AUTHWORKS_REALM_ID")
  const repository = realmRepositoryCreate(database.db)
  if (explicit !== undefined) {
    const existing = repository.realmGet(explicit)
    if (!existing.success) {
      process.stderr.write(`${existing.errorMessage}\n`)
      return undefined
    }
    if (existing.data === null || existing.data.status !== "active") {
      process.stderr.write(`The target Authworks realm was not found or is not active: ${explicit}\n`)
      return undefined
    }
    process.stderr.write(`Using Authworks realm ${existing.data.id} (${existing.data.name}).\n`)
    return existing.data.id
  }
  const byDomain = repository.realmFindByDomain(realmDomain)
  if (!byDomain.success) {
    process.stderr.write(`${byDomain.errorMessage}\n`)
    return undefined
  }
  if (byDomain.data !== null) {
    process.stderr.write(`Using existing Authworks realm ${byDomain.data.id} (${byDomain.data.name}).\n`)
    return byDomain.data.id
  }
  const created = realmCreate({
    context: realmSystemContextCreate(),
    database,
    input: { domain: realmDomain, name: realmName },
  })
  if (!created.success) {
    process.stderr.write(`${created.errorMessage}\n`)
    return undefined
  }
  process.stderr.write(
    `Created Authworks realm ${created.data.realm.id} (${created.data.realm.name}, ${realmDomain}).\n`,
  )
  return created.data.realm.id
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const sshHost = flagGet(args, "ssh-host") ?? defaultSshHost
  const projectsDir = flagGet(args, "projects-dir") ?? defaultProjectsDir
  const zitadelDir = flagGet(args, "zitadel-dir") ?? defaultZitadelDir
  const inventoryOnly = flagHas(args, "inventory-only")
  const inventoryOut = flagGet(args, "inventory-out")
  const snapshotOut = flagGet(args, "snapshot-out")
  const databasePath = flagGet(args, "database") ?? environmentText("AUTHWORKS_DATABASE_PATH") ?? "./authworks.sqlite"
  const realmDomain = flagGet(args, "realm-domain") ?? defaultRealmDomain
  const realmName = flagGet(args, "realm-name") ?? defaultRealmName
  const apiUrl =
    flagGet(args, "api-url") ??
    environmentText("ZITADEL_API_URL") ??
    zitadelEnvGet(zitadelDir, "zitadel-cli.env", "ZITADEL_BASE_URL")
  const token =
    flagGet(args, "token") ??
    environmentText("ZITADEL_SERVICE_ACCOUNT_TOKEN") ??
    zitadelEnvGet(zitadelDir, join("podman", "zitadel.env"), "ZITADEL_SERVICE_USER_TOKEN")
  const pageSizeRaw = flagGet(args, "page-size") ?? environmentText("ZITADEL_SEARCH_PAGE_SIZE")
  const pageSize = pageSizeRaw === undefined ? undefined : Number(pageSizeRaw)
  const dryRun = flagHas(args, "dry-run")
  const authoritative = flagHas(args, "authoritative")
  const confirmDestructive = flagHas(args, "confirm-destructive")

  if (flagGet(args, "help") !== undefined || flagHas(args, "help") || args.includes("-h")) {
    process.stdout.write("See the header comment in scripts/zitadelRemoteClientIdsImport.ts for usage.\n")
    return
  }

  process.stderr.write(`Scanning ${sshHost}:${projectsDir} for scattered client IDs…\n`)
  const inventory = remoteInventoryCollect(sshHost, projectsDir)
  const liveCount = inventory.distinctLiveIds.length
  const placeholderCount = inventory.records.filter((record) => record.kind === "placeholder").length
  process.stderr.write(
    `Found ${liveCount} distinct live ZITADEL client IDs in ${inventory.filesScanned} .env* files (${inventory.records.length} records, ${placeholderCount} placeholders skipped).\n`,
  )
  for (const id of inventory.distinctLiveIds) {
    const sources = inventory.records.filter((record) => record.value === id)
    const projects = [...new Set(sources.map((record) => record.project))].join(", ")
    process.stderr.write(`  ${id}  (${projects})\n`)
  }
  if (inventoryOut !== undefined) {
    writeFileSync(inventoryOut, `${JSON.stringify(inventory, undefined, 2)}\n`, "utf8")
    process.stderr.write(`Inventory written to ${inventoryOut}\n`)
  }
  if (inventoryOnly) {
    process.stdout.write(`${JSON.stringify(inventory, undefined, 2)}\n`)
    return
  }

  if (apiUrl === undefined || token === undefined) {
    process.stderr.write(
      "Missing ZITADEL_API_URL or ZITADEL_SERVICE_ACCOUNT_TOKEN; cannot export. Re-run with credentials or --inventory-only.\n",
    )
    process.exitCode = 1
    return
  }
  if (authoritative && !dryRun && !confirmDestructive) {
    process.stderr.write("Authoritative migration requires --confirm-destructive; nothing was imported.\n")
    process.exitCode = 1
    return
  }

  // Reuse the existing ZITADEL import path: export a snapshot, then import it.
  const exported = await zitadelMigrationExport({
    api: zitadelApiClientCreate({ baseUrl: apiUrl, pageSize, token }),
  })
  if (!exported.success) {
    process.stderr.write(`${exported.errorMessage}\n`)
    process.exitCode = 1
    return
  }
  if (snapshotOut !== undefined) {
    writeFileSync(snapshotOut, `${JSON.stringify(exported.data.snapshot)}\n`, { mode: 0o600 })
    chmodSync(snapshotOut, 0o600)
    process.stderr.write(`Snapshot written to ${snapshotOut}\n`)
  }

  const matched: Array<{ readonly clientId: string; readonly applications: readonly string[] }> = []
  const missing: string[] = []
  for (const clientId of inventory.distinctLiveIds) {
    const applications = snapshotMatch(exported.data.snapshot, clientId)
    if (applications.length === 0) {
      missing.push(clientId)
    } else {
      matched.push({
        clientId,
        applications: applications.map((application) => `${application.name} [project ${application.projectId}]`),
      })
    }
  }
  process.stderr.write(`Snapshot coverage: ${matched.length}/${liveCount} remote client IDs exported from ZITADEL.\n`)
  for (const entry of matched) {
    process.stderr.write(`  ✓ ${entry.clientId} → ${entry.applications.join("; ")}\n`)
  }
  for (const clientId of missing) {
    const sources = inventory.records.filter((record) => record.value === clientId)
    const where = [...new Set(sources.map((record) => `${record.project}:${record.file}`))].join(", ")
    process.stderr.write(`  ✗ ${clientId} missing from ZITADEL export (used by ${where})\n`)
  }

  const database = storageDatabaseOpen(databasePath)
  if (!database.success) {
    process.stderr.write(`${database.errorMessage}\n`)
    process.exitCode = 1
    return
  }
  const realmId = realmEnsure(database.data, args, realmDomain, realmName)
  if (realmId === undefined) {
    process.exitCode = 1
    return
  }
  if (!database.success) {
    process.stderr.write(`${database.errorMessage}\n`)
    process.exitCode = 1
    return
  }
  try {
    const imported = zitadelMigrationImport({
      authoritative,
      database: database.data,
      dryRun,
      realmId,
      snapshot: exported.data.snapshot,
    })
    if (!imported.success) {
      process.stderr.write(`${imported.errorMessage}\n`)
      process.exitCode = 1
      return
    }
    const counts = imported.data.counts["oidcApplications"]
    process.stderr.write(
      `Import ${dryRun ? "plan" : "result"} (oidcApplications): ` +
        `created=${counts?.created ?? 0} updated=${counts?.updated ?? 0} ` +
        `unchanged=${counts?.unchanged ?? 0} skipped=${counts?.skipped ?? 0}.\n`,
    )
    process.stdout.write(
      `${JSON.stringify({ inventory, coverage: { matched, missing }, import: imported.data }, undefined, 2)}\n`,
    )
  } finally {
    database.data.close()
  }
}

await main()
