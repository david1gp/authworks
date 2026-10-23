import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { type Subprocess, spawn } from "bun"
import { createResult, createResultError, type Result } from "#result"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { passwordApiClientCreate } from "../../src/features/passwords/client/passwordApiClientCreate.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import type { E2eDevEnvironmentCredentials } from "./e2eDevEnvironmentCredentials.js"
import {
  e2eDevEnvironmentEnvFileParse,
  e2eDevEnvironmentEnvFileSerialize,
  e2eDevEnvironmentPasswordCreate,
} from "./e2eDevEnvironmentCredentials.js"
import { e2eSecretFileWrite } from "./e2eSecretFileWrite.js"
import { e2eServiceUserEnsure, e2eServiceUserIdentityGet } from "./e2eServiceUserEnsure.js"

export const e2eDevEnvironmentPort = 5190

export const e2eDevEnvironmentHost = "login.localhost"

const devRealmDomain = "login.localhost"

const devRealmName = "Authworks Dev"

const devOrganizationName = "Authworks Dev"

export type E2eDevEnvironment = {
  readonly baseUrl: string
  readonly memberUser: { readonly userId: string; readonly userName: string }
  readonly organizationId: string
  readonly realmId: string
  readonly serviceUser: { readonly userId: string; readonly userName: string }
  readonly stateDir: string
  readonly systemSecret: string
  readonly stop: () => Promise<void>
}

type E2eDevEnvironmentEnsureOptions = {
  readonly rebuild?: boolean
  readonly stateDir: string
}

export function e2eDevEnvironmentEnsure(options: E2eDevEnvironmentEnsureOptions): Promise<Result<E2eDevEnvironment>> {
  const op = "e2eDevEnvironmentEnsure"
  if (options.stateDir.length === 0) return Promise.resolve(createResultError(op, "The state directory is required."))

  const stateDir = `${options.stateDir.replace(/\/+$/, "")}/dev`
  const paths = {
    database: `${stateDir}/authworks.sqlite`,
    env: `${stateDir}/env.json`,
    pid: `${stateDir}/server.pid`,
    systemSecret: `${stateDir}/system-secret`,
  }
  const baseUrl = `http://${e2eDevEnvironmentHost}:${e2eDevEnvironmentPort}`

  return (async (): Promise<Result<E2eDevEnvironment>> => {
    const prepared = e2eDevEnvironmentStatePrepare(stateDir)
    if (!prepared.success) return prepared
    const ensured = await e2eDevServerEnsure({ baseUrl, paths, rebuild: options.rebuild })
    if (!ensured.success) return ensured
    const provisioned = await e2eDevEnvironmentProvision({ baseUrl, paths })
    if (!provisioned.success) return provisioned
    return createResult({
      baseUrl,
      memberUser: provisioned.data.memberUser,
      organizationId: provisioned.data.organizationId,
      realmId: provisioned.data.realmId,
      serviceUser: provisioned.data.serviceUser,
      stateDir,
      systemSecret: provisioned.data.systemSecret,
      stop: async () => {
        e2eDevServerStop(paths.pid)
      },
    })
  })().catch((error) => createResultError(op, errorMessageGet(error)))
}

export function e2eDevEnvironmentStop(stateDir: string): Result<void> {
  const op = "e2eDevEnvironmentStop"
  if (stateDir.length === 0) return createResultError(op, "The state directory is required.")
  const directory = `${stateDir.replace(/\/+$/, "")}/dev`
  e2eDevServerStop(`${directory}/server.pid`)
  return createResult(undefined)
}

export function e2eDevEnvironmentStatusGet(stateDir: string): {
  readonly pid: number | undefined
  readonly running: boolean
} {
  if (stateDir.length === 0) return { pid: undefined, running: false }
  const pid = e2eDevServerPidRead(`${stateDir.replace(/\/+$/, "")}/dev/server.pid`)
  if (pid === undefined) return { pid: undefined, running: false }
  return { pid, running: e2eDevProcessAlive(pid) }
}

type E2eDevServerPaths = {
  readonly database: string
  readonly env: string
  readonly pid: string
  readonly systemSecret: string
}

async function e2eDevServerEnsure(
  options: E2eDevServerEnsureOptions,
): Promise<Result<{ readonly credentials: E2eDevEnvironmentCredentials }>> {
  const ui = await e2eDevUiEnsure(options.rebuild ?? false)
  if (!ui.success) return ui
  const credentials = e2eDevCredentialsEnsure(options.paths)
  if (!credentials.success) return credentials
  const reused = await e2eDevServerReuse(options.baseUrl, options.paths.pid)
  if (!reused.success) return reused
  if (reused.data.reused) return createResult({ credentials: credentials.data })
  const started = await e2eDevServerStart({
    baseUrl: options.baseUrl,
    credentials: credentials.data,
    paths: options.paths,
  })
  if (!started.success) return started
  return createResult({ credentials: credentials.data })
}

async function e2eDevEnvironmentProvision(options: {
  readonly baseUrl: string
  readonly paths: E2eDevServerPaths
}): Promise<
  Result<{
    readonly memberUser: { readonly userId: string; readonly userName: string }
    readonly organizationId: string
    readonly realmId: string
    readonly serviceUser: { readonly userId: string; readonly userName: string }
    readonly systemSecret: string
  }>
> {
  const op = "e2eDevEnvironmentProvision"
  const envRaw = e2eDevFileRead(options.paths.env)
  if (!envRaw.success) return envRaw
  const credentials = e2eDevEnvironmentEnvFileParse(envRaw.data)
  if (!credentials.success) return credentials
  const secretRaw = e2eDevFileRead(options.paths.systemSecret)
  if (!secretRaw.success) return secretRaw
  const systemSecret = secretRaw.data.trim()
  if (systemSecret.length === 0) return createResultError(op, "The E2E dev system secret is empty.")

  const realms = realmApiClientCreate({ baseUrl: options.baseUrl, token: systemSecret })
  const users = userApiClientCreate({ baseUrl: options.baseUrl, systemToken: systemSecret })
  const organizations = organizationApiClientCreate({ baseUrl: options.baseUrl, token: systemSecret })

  const passwords = passwordApiClientCreate({ baseUrl: options.baseUrl, systemToken: systemSecret })
  const realm = await e2eDevRealmEnsure(realms)
  if (!realm.success) return realm
  const realmId = realm.data
  const organization = await e2eDevOrganizationEnsure(organizations, realmId)
  if (!organization.success) return organization
  const seeded = await organizations.organizationDomainRealmSeed(realmId, organization.data, devRealmDomain)
  if (!seeded.success) return seeded
  const service = await e2eServiceUserEnsure({
    baseUrl: options.baseUrl,
    password: credentials.data.servicePassword,
    realmId,
    systemSecret,
  })
  if (!service.success) return service
  const ownership = await e2eDevServiceOwnershipEnsure(organizations, realmId, organization.data, service.data.userId)
  if (!ownership.success) return ownership
  const member = await e2eDevMemberEnsure(
    users,
    organizations,
    passwords,
    {
      password: credentials.data.memberPassword,
      realmId,
    },
    organization.data,
  )
  if (!member.success) return member
  const identity = e2eServiceUserIdentityGet()
  return createResult({
    memberUser: { userId: member.data, userName: e2eDevMemberIdentityGet().userName },
    organizationId: organization.data,
    realmId,
    serviceUser: { userId: service.data.userId, userName: identity.userName },
    systemSecret,
  })
}

async function e2eDevRealmEnsure(realms: ReturnType<typeof realmApiClientCreate>): Promise<Result<string>> {
  const listed = await realms.realmList({ pageSize: 100 })
  if (!listed.success) return listed
  const match = listed.data.items.find(
    (item) => item.domain === devRealmDomain || item.domains.some((candidate) => candidate === devRealmDomain),
  )
  if (match !== undefined) return createResult(match.id)
  const created = await realms.realmCreate({ domain: devRealmDomain, name: devRealmName })
  if (!created.success) {
    if ("code" in created && created.code === "realms.already-exists") {
      const relisted = await realms.realmList({ pageSize: 100 })
      if (!relisted.success) return relisted
      const retry = relisted.data.items.find(
        (item) => item.domain === devRealmDomain || item.domains.some((candidate) => candidate === devRealmDomain),
      )
      if (retry !== undefined) return createResult(retry.id)
    }
    return created
  }
  return createResult(created.data.realm.id)
}

async function e2eDevOrganizationEnsure(
  organizations: ReturnType<typeof organizationApiClientCreate>,
  realmId: string,
): Promise<Result<string>> {
  const listed = await organizations.organizationList(realmId, { pageSize: 100 })
  if (!listed.success) return listed
  const match = listed.data.items.find((item) => item.name === devOrganizationName)
  if (match !== undefined) return createResult(match.id)
  const created = await organizations.organizationCreate(realmId, { name: devOrganizationName })
  if (!created.success) return created
  return createResult(created.data.organization.id)
}

async function e2eDevServiceOwnershipEnsure(
  organizations: ReturnType<typeof organizationApiClientCreate>,
  realmId: string,
  organizationId: string,
  userId: string,
): Promise<Result<void>> {
  const memberships = await organizations.organizationMembershipList(realmId, organizationId, { pageSize: 100 })
  if (!memberships.success) return memberships
  const existing = memberships.data.items.find((item) => item.userId === userId)
  if (existing !== undefined) {
    if (existing.roles.includes("owner")) return createResult(undefined)
    const updated = await organizations.organizationMembershipUpdate(realmId, organizationId, existing.id, {
      roles: ["owner"],
    })
    if (!updated.success) return updated
    return createResult(undefined)
  }
  const added = await organizations.organizationMembershipCreate(realmId, organizationId, {
    roles: ["owner"],
    userId,
  })
  if (!added.success) return added
  return createResult(undefined)
}

function e2eDevMemberIdentityGet(): {
  readonly displayName: string
  readonly email: string
  readonly userName: string
} {
  return {
    displayName: "Authworks E2E Dev Member",
    email: "e2e-dev-member@contentoren.de",
    userName: "e2e-dev-member",
  }
}

async function e2eDevMemberEnsure(
  users: ReturnType<typeof userApiClientCreate>,
  organizations: ReturnType<typeof organizationApiClientCreate>,
  passwords: ReturnType<typeof passwordApiClientCreate>,
  options: { readonly password: string; readonly realmId: string },
  organizationId: string,
): Promise<Result<string>> {
  const identity = e2eDevMemberIdentityGet()
  let user: { readonly id: string; readonly state: string; readonly verificationState: string } | undefined
  let pageToken: string | undefined
  for (let page = 0; page < 20; page += 1) {
    const listed = await users.userList(options.realmId, {
      pageSize: 100,
      ...(pageToken === undefined ? {} : { pageToken }),
      search: identity.userName,
    })
    if (!listed.success) return listed
    const match = listed.data.items.find((item) => item.userName === identity.userName)
    if (match !== undefined) {
      user = { id: match.id, state: match.state, verificationState: match.verificationState }
      break
    }
    const next = listed.data.nextPageToken
    if (next === undefined || next.length === 0) break
    pageToken = next
  }
  if (user === undefined) {
    const created = await users.userCreate(options.realmId, {
      email: identity.email,
      profile: { displayName: identity.displayName },
      userName: identity.userName,
    })
    if (!created.success) return created
    user = {
      id: created.data.user.id,
      state: created.data.user.state,
      verificationState: created.data.user.verificationState,
    }
  }
  const userId: string = user.id
  if (user.state === "initial") {
    const activated = await users.userLifecycleSet(options.realmId, userId, { state: "active" })
    if (!activated.success) return activated
  }
  if (user.verificationState !== "verified") {
    const verified = await users.userEmailVerificationSet(options.realmId, userId, { state: "verified" })
    if (!verified.success) return verified
  }
  const memberships = await organizations.organizationMembershipList(options.realmId, organizationId, { pageSize: 100 })
  if (!memberships.success) return memberships
  if (!memberships.data.items.some((item) => item.userId === userId)) {
    const added = await organizations.organizationMembershipCreate(options.realmId, organizationId, {
      roles: ["member"],
      userId,
    })
    if (!added.success) return added
  }
  const credentialed = await passwords.passwordCredentialReplace(options.realmId, userId, {
    password: options.password,
  })
  if (!credentialed.success) return credentialed
  return createResult(userId)
}

function e2eDevEnvironmentStatePrepare(stateDir: string): Result<void> {
  const op = "e2eDevEnvironmentStatePrepare"
  try {
    mkdirSync(stateDir, { recursive: true })
    return createResult(undefined)
  } catch {
    return createResultError(op, `Cannot create the E2E dev state directory at ${stateDir}.`)
  }
}

function e2eDevCredentialsEnsure(paths: E2eDevServerPaths): Result<E2eDevEnvironmentCredentials> {
  const op = "e2eDevCredentialsEnsure"
  if (existsSync(paths.systemSecret) && existsSync(paths.env)) {
    const secretRaw = e2eDevFileRead(paths.systemSecret)
    if (!secretRaw.success) return secretRaw
    if (secretRaw.data.trim().length === 0) return createResultError(op, "The E2E dev system secret is empty.")
    const envRaw = e2eDevFileRead(paths.env)
    if (!envRaw.success) return envRaw
    const parsed = e2eDevEnvironmentEnvFileParse(envRaw.data)
    if (!parsed.success) return parsed
    if (parsed.data.systemSecret !== secretRaw.data.trim())
      return createResultError(op, "The E2E dev credentials do not match the stored system secret.")
    return createResult(parsed.data)
  }
  if (existsSync(paths.systemSecret) !== existsSync(paths.env))
    return createResultError(op, "The E2E dev credentials are incomplete. Delete the dev state directory and retry.")
  const bytes = (length: number): Uint8Array => {
    const output = new Uint8Array(length)
    crypto.getRandomValues(output)
    return output
  }
  const credentials: E2eDevEnvironmentCredentials = {
    memberPassword: e2eDevEnvironmentPasswordCreate(bytes),
    servicePassword: e2eDevEnvironmentPasswordCreate(bytes),
    systemSecret: e2eDevEnvironmentPasswordCreate(bytes),
  }
  const secretWritten = e2eSecretFileWrite(paths.systemSecret, credentials.systemSecret)
  if (!secretWritten.success) return secretWritten
  const envWritten = e2eSecretFileWrite(paths.env, e2eDevEnvironmentEnvFileSerialize(credentials).trimEnd())
  if (!envWritten.success) return envWritten
  return createResult(credentials)
}

function e2eDevFileRead(path: string): Result<string> {
  const op = "e2eDevFileRead"
  try {
    return createResult(readFileSync(path, "utf8"))
  } catch {
    return createResultError(op, `Cannot read the E2E dev file at ${path}.`)
  }
}

async function e2eDevUiEnsure(rebuild: boolean): Promise<Result<void>> {
  const op = "e2eDevUiEnsure"
  try {
    const index = Bun.file("dist/ui/index.html")
    const exists = await index.exists()
    if (exists && !rebuild) return createResult(undefined)
    if (exists && rebuild) {
      const stat = await index.stat().catch(() => undefined)
      const newest = await e2eDevSourceNewestGet()
      if (stat !== undefined && newest !== undefined && stat.mtime.getTime() >= newest) return createResult(undefined)
    }
    if (exists && !rebuild) return createResult(undefined)
    const built = Bun.spawnSync(["bun", "run", "build:ui"], { stderr: "pipe", stdout: "pipe" })
    if (built.exitCode !== 0) {
      const detail = new TextDecoder().decode(built.stderr).trim()
      return createResultError(op, `The dev UI build failed.${detail.length > 0 ? ` ${detail}` : ""}`)
    }
    if (!(await Bun.file("dist/ui/index.html").exists()))
      return createResultError(op, "The dev UI build did not produce dist/ui/index.html.")
    return createResult(undefined)
  } catch (error) {
    return createResultError(op, errorMessageGet(error))
  }
}

async function e2eDevSourceNewestGet(): Promise<number | undefined> {
  const candidates = ["src", "ui", "index.html"]
  let newest: number | undefined
  for (const candidate of candidates) {
    const time = await e2eDevDirectoryNewestGet(candidate)
    if (time !== undefined && (newest === undefined || time > newest)) newest = time
  }
  return newest
}

async function e2eDevDirectoryNewestGet(path: string): Promise<number | undefined> {
  try {
    const glob = new Bun.Glob("**/*.{ts,tsx,css,html}")
    let newest: number | undefined
    for await (const file of glob.scan({ absolute: true, cwd: path, onlyFiles: true })) {
      const stat = await Bun.file(file)
        .stat()
        .catch(() => undefined)
      if (stat === undefined) continue
      const time = stat.mtime.getTime()
      if (newest === undefined || time > newest) newest = time
    }
    return newest
  } catch {
    return undefined
  }
}

type E2eDevServerEnsureOptions = {
  readonly baseUrl: string
  readonly paths: E2eDevServerPaths
  readonly rebuild?: boolean
}

type E2eDevServerStartOptions = {
  readonly baseUrl: string
  readonly credentials: E2eDevEnvironmentCredentials
  readonly paths: E2eDevServerPaths
}

async function e2eDevServerStart(options: E2eDevServerStartOptions): Promise<Result<void>> {
  const op = "e2eDevServerStart"
  e2eDevServerStop(options.paths.pid)
  const environment: Record<string, string> = {
    AUTHWORKS_DATABASE_PATH: options.paths.database,
    AUTHWORKS_EMAIL_DELIVERY_ENABLED: "false",
    AUTHWORKS_HOST: "127.0.0.1",
    AUTHWORKS_PORT: String(e2eDevEnvironmentPort),
    AUTHWORKS_PUBLIC_ORIGIN: options.baseUrl,
    AUTHWORKS_SYSTEM_SECRET: options.credentials.systemSecret,
    NODE_ENV: "development",
  }
  let child: Subprocess
  try {
    child = spawn(["bun", "run", "src/outputs/server.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, ...environment },
      stderr: "pipe",
      stdout: "pipe",
    })
  } catch (error) {
    return createResultError(op, errorMessageGet(error))
  }
  try {
    Bun.write(options.paths.pid, `${child.pid}\n`)
  } catch {
    try {
      child.kill()
    } catch {
      // ignore
    }
    return createResultError(op, "Cannot write the E2E dev server pid file.")
  }
  child.unref()
  const ready = await e2eDevHealthWait(options.baseUrl)
  if (!ready.success) {
    e2eDevServerStop(options.paths.pid)
    return ready
  }
  return createResult(undefined)
}

async function e2eDevServerReuse(baseUrl: string, pidPath: string): Promise<Result<{ readonly reused: boolean }>> {
  const pid = e2eDevServerPidRead(pidPath)
  if (pid === undefined) return createResult({ reused: false })
  if (!e2eDevProcessAlive(pid)) {
    e2eDevPidFileRemove(pidPath)
    return createResult({ reused: false })
  }
  const healthy = await e2eDevHealthCheck(baseUrl)
  if (!healthy) {
    e2eDevServerStop(pidPath)
    return createResult({ reused: false })
  }
  return createResult({ reused: true })
}

async function e2eDevHealthWait(baseUrl: string): Promise<Result<void>> {
  const op = "e2eDevServerStart"
  const deadline = Date.now() + 30_000
  let lastError = "The E2E dev server did not become healthy."
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2_000) })
      if (response.ok) return createResult(undefined)
      lastError = `The E2E dev server health check failed with status ${response.status}.`
    } catch (error) {
      lastError = errorMessageGet(error)
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 250))
  }
  return createResultError(op, lastError)
}

async function e2eDevHealthCheck(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2_000) })
    return response.ok
  } catch {
    return false
  }
}

function e2eDevServerPidRead(pidPath: string): number | undefined {
  try {
    const raw = readFileSync(pidPath, "utf8").trim()
    if (!/^\d+$/.test(raw)) return undefined
    const pid = Number(raw)
    return Number.isSafeInteger(pid) && pid > 0 ? pid : undefined
  } catch {
    return undefined
  }
}

function e2eDevPidFileRemove(pidPath: string): void {
  try {
    rmSync(pidPath, { force: true })
  } catch {
    // ignore
  }
}

function e2eDevProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function e2eDevServerStop(pidPath: string): void {
  const pid = e2eDevServerPidRead(pidPath)
  e2eDevPidFileRemove(pidPath)
  if (pid === undefined) return
  try {
    process.kill(pid, "SIGTERM")
  } catch {
    // ignore
  }
}

function errorMessageGet(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : "The E2E dev environment could not be prepared."
}

void e2eDevEnvironmentEnvFileParse
