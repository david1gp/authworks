import { readFile } from "node:fs/promises"
import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { connectionProfileNameValidate } from "../../connectionProfiles/public/connectionProfileNameValidate.js"
import { authworksProjectPathResolve, type AuthworksProjectPathOptions } from "./authworksProjectPathResolve.js"
import { type AuthworksProject } from "../public/authworksProjectSchema.js"
import { authworksProjectSchema } from "../public/authworksProjectSchema.js"

export type AuthworksProjectLoadOptions = AuthworksProjectPathOptions

export async function authworksProjectLoad(
  project: string,
  options: AuthworksProjectLoadOptions = {},
): Promise<Result<AuthworksProject>> {
  const op = "authworksProjectLoad"
  const validProject = connectionProfileNameValidate(project)
  if (!validProject.success) return validProject

  const path = authworksProjectPathResolve(validProject.data, options)
  let content: string
  try {
    content = await readFile(path, "utf8")
  } catch (error) {
    if (isFileMissing(error))
      return resultErrorCreate(op, `The Authworks project "${validProject.data}" was not found.`)
    return resultErrorCreate(op, "The Authworks project could not be read.")
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(content)
  } catch (_error) {
    return resultErrorCreate(op, "The Authworks project file is malformed.")
  }

  const parsed = v.safeParse(authworksProjectSchema, decoded)
  if (!parsed.success) return resultErrorCreate(op, "The Authworks project file is invalid.")
  const validProfile = connectionProfileNameValidate(parsed.output.profile)
  if (!validProfile.success) return resultErrorCreate(op, "The Authworks project file is invalid.")
  return resultCreate(parsed.output)
}

function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}
