import { readFile } from "node:fs/promises"
import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { connectionProfileNameValidate } from "../../connectionProfiles/public/connectionProfileNameValidate.js"
import {
  authworksConfigurationPathResolve,
  type AuthworksConfigurationFilePathOptions,
} from "./authworksConfigurationPathResolve.js"
import { type AuthworksConfiguration } from "../public/authworksConfigurationSchema.js"
import { authworksConfigurationSchema } from "../public/authworksConfigurationSchema.js"

export type AuthworksConfigurationLoadOptions = AuthworksConfigurationFilePathOptions

export async function authworksConfigurationLoad(
  options: AuthworksConfigurationLoadOptions = {},
): Promise<Result<AuthworksConfiguration>> {
  const op = "authworksConfigurationLoad"
  const path = authworksConfigurationPathResolve(options)
  let content: string
  try {
    content = await readFile(path, "utf8")
  } catch (error) {
    if (isFileMissing(error)) return resultCreate({ profiles: {} })
    return resultErrorCreate(op, "The Authworks configuration could not be read.")
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(content)
  } catch (_error) {
    return resultErrorCreate(op, "The Authworks configuration file is malformed.")
  }

  const parsed = v.safeParse(authworksConfigurationSchema, decoded)
  if (!parsed.success) return resultErrorCreate(op, "The Authworks configuration file is invalid.")

  if (parsed.output.defaultProfile !== undefined) {
    const validDefaultProfile = connectionProfileNameValidate(parsed.output.defaultProfile)
    if (!validDefaultProfile.success) return resultErrorCreate(op, "The Authworks configuration file is invalid.")
  }

  const profiles: Record<string, AuthworksConfiguration["profiles"][string]> = {}
  for (const [name, profile] of Object.entries(parsed.output.profiles)) {
    const validName = connectionProfileNameValidate(name)
    if (!validName.success) return resultErrorCreate(op, "The Authworks configuration file is invalid.")
    Object.defineProperty(profiles, name, {
      configurable: true,
      enumerable: true,
      value: profile,
      writable: true,
    })
  }

  return resultCreate({
    ...(parsed.output.defaultProfile === undefined ? {} : { defaultProfile: parsed.output.defaultProfile }),
    profiles,
  })
}

function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}
