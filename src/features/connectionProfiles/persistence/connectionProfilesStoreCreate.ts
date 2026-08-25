import { randomUUID } from "node:crypto"
import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { connectionProfilesConfigPathResolve } from "../config/connectionProfilesConfigPathResolve.js"
import type { ConnectionProfile } from "../model/connectionProfile.js"
import { connectionProfileSchema } from "../model/connectionProfile.js"
import { connectionProfileNameValidate } from "../model/connectionProfileNameValidate.js"

type ConnectionProfiles = Record<string, ConnectionProfile>

export function connectionProfilesStoreCreate(
  options: {
    readonly environment?: Readonly<Record<string, string | undefined>>
    readonly homeDirectory?: string
    readonly path?: string
  } = {},
) {
  const path = options.path ?? connectionProfilesConfigPathResolve(options)

  return {
    async connectionProfileDelete(name: string): Promise<Result<boolean>> {
      const validName = connectionProfileNameValidate(name)
      if (!validName.success) return validName

      const profiles = await connectionProfilesRead(path)
      if (!profiles.success) return profiles
      if (!connectionProfilesHas(profiles.data, validName.data)) return resultCreate(false)

      delete profiles.data[validName.data]
      const written = await connectionProfilesWrite(path, profiles.data)
      if (!written.success) return written
      return resultCreate(true)
    },

    async connectionProfileGet(name: string): Promise<Result<ConnectionProfile | undefined>> {
      const validName = connectionProfileNameValidate(name)
      if (!validName.success) return validName

      const profiles = await connectionProfilesRead(path)
      if (!profiles.success) return profiles
      return resultCreate(
        connectionProfilesHas(profiles.data, validName.data) ? profiles.data[validName.data] : undefined,
      )
    },

    async connectionProfileList(): Promise<Result<Readonly<ConnectionProfiles>>> {
      return connectionProfilesRead(path)
    },

    async connectionProfileSet(name: string, input: unknown): Promise<Result<ConnectionProfile>> {
      const validName = connectionProfileNameValidate(name)
      if (!validName.success) return validName

      const parsed = v.safeParse(connectionProfileSchema, input)
      if (!parsed.success) return resultErrorCreate("connectionProfileSet", "The connection profile is invalid.")

      const profiles = await connectionProfilesRead(path)
      if (!profiles.success) return profiles
      const existing = connectionProfilesHas(profiles.data, validName.data) ? profiles.data[validName.data] : {}
      const profile = connectionProfileWithoutUndefined({ ...existing, ...parsed.output })
      profiles.data[validName.data] = profile
      const written = await connectionProfilesWrite(path, profiles.data)
      if (!written.success) return written
      return resultCreate(profile)
    },
  }
}

async function connectionProfilesRead(path: string): Promise<Result<ConnectionProfiles>> {
  const op = "connectionProfilesRead"
  let content: string
  try {
    content = await readFile(path, "utf8")
  } catch (error) {
    if (isFileMissing(error)) return resultCreate({})
    return resultErrorCreate(op, "The connection profiles could not be read.")
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(content)
  } catch (_error) {
    return resultErrorCreate(op, "The connection profiles file is malformed.")
  }
  if (!isRecord(decoded)) return resultErrorCreate(op, "The connection profiles file is invalid.")

  const profiles: ConnectionProfiles = {}
  for (const [name, input] of Object.entries(decoded)) {
    const validName = connectionProfileNameValidate(name)
    if (!validName.success) return resultErrorCreate(op, "The connection profiles file is invalid.")
    const parsed = v.safeParse(connectionProfileSchema, input)
    if (!parsed.success) return resultErrorCreate(op, "The connection profiles file is invalid.")
    Object.defineProperty(profiles, name, {
      configurable: true,
      enumerable: true,
      value: parsed.output,
      writable: true,
    })
  }
  return resultCreate(profiles)
}

async function connectionProfilesWrite(path: string, profiles: ConnectionProfiles): Promise<Result<void>> {
  const op = "connectionProfilesWrite"
  let temporaryPath: string | undefined
  try {
    await mkdir(dirname(path), { mode: 0o700, recursive: true })
    temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(profiles, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    })
    await chmod(temporaryPath, 0o600)
    await rename(temporaryPath, path)
    temporaryPath = undefined
    await chmod(path, 0o600)
    return resultCreate(undefined)
  } catch (_error) {
    return resultErrorCreate(op, "The connection profiles could not be written.")
  } finally {
    if (temporaryPath !== undefined) await unlink(temporaryPath).catch(() => undefined)
  }
}

function connectionProfileWithoutUndefined(profile: ConnectionProfile): ConnectionProfile {
  return Object.fromEntries(Object.entries(profile).filter(([, value]) => value !== undefined)) as ConnectionProfile
}

function connectionProfilesHas(profiles: ConnectionProfiles, name: string): boolean {
  return Object.hasOwn(profiles, name)
}

function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
}
