import { existsSync, readFileSync } from "node:fs"
import { createResult, createResultError, type Result } from "#result"
import { e2eDevEnvironmentEnvFileParse } from "./e2eDevEnvironmentCredentials.js"
import { e2eServiceUserIdentityGet } from "./e2eServiceUserEnsure.js"
import type { E2eTarget } from "./e2eTargetSchema.js"

export type E2eLiveCredentials = {
  readonly memberPassword: string
  readonly memberUsername: string
  readonly servicePassword: string | undefined
  readonly serviceUsername: string | undefined
}

type E2eCredentialsResolveOptions = {
  readonly environment?: Readonly<Record<string, string | undefined>>
  readonly stateDir?: string
  readonly target: E2eTarget
}

const devMemberUserName = "e2e-dev-member"

const productionMemberError =
  "Live account E2E requires AUTHWORKS_SSOTEST_USERNAME and AUTHWORKS_SSOTEST_PASSWORD (loaded from .env)."

function e2eDotEnvFileParse(raw: string): Record<string, string> {
  const entries: Record<string, string> = {}
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (trimmed === "" || trimmed.startsWith("#")) continue
    const separator = trimmed.indexOf("=")
    if (separator < 0) continue
    const key = trimmed.slice(0, separator).trim()
    if (key.length === 0 || entries[key] !== undefined) continue
    entries[key] = trimmed.slice(separator + 1).trim()
  }
  return entries
}

export function e2eProductionEnvironmentMerged(
  environment: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
  const merged: Record<string, string | undefined> = { ...environment }
  for (const file of [".env", ".env.production"]) {
    if (!existsSync(file)) continue
    let raw: string
    try {
      raw = readFileSync(file, "utf8")
    } catch {
      continue
    }
    for (const [key, value] of Object.entries(e2eDotEnvFileParse(raw))) {
      if (merged[key] === undefined) merged[key] = value
    }
  }
  return merged
}

export function e2eCredentialsResolve(options: E2eCredentialsResolveOptions): Result<E2eLiveCredentials> {
  const op = "e2eCredentialsResolve"
  if (options.target === "production") {
    const environment = e2eProductionEnvironmentMerged(options.environment ?? process.env)
    const memberUsername = environment.AUTHWORKS_SSOTEST_USERNAME?.trim() ?? ""
    const memberPassword = environment.AUTHWORKS_SSOTEST_PASSWORD ?? ""
    if (memberUsername.length === 0 || memberPassword.length === 0) return createResultError(op, productionMemberError)
    const serviceUsername = environment.AUTHWORKS_E2E_SERVICE_USERNAME?.trim() ?? ""
    const servicePassword = environment.AUTHWORKS_E2E_SERVICE_PASSWORD ?? ""
    return createResult({
      memberPassword,
      memberUsername,
      servicePassword: serviceUsername.length === 0 || servicePassword.length === 0 ? undefined : servicePassword,
      serviceUsername: serviceUsername.length === 0 || servicePassword.length === 0 ? undefined : serviceUsername,
    })
  }
  if (options.stateDir === undefined || options.stateDir.length === 0)
    return createResultError(op, "The E2E state directory is required to resolve dev credentials.")
  let raw: string
  try {
    raw = readFileSync(`${options.stateDir.replace(/\/+$/, "")}/dev/env.json`, "utf8")
  } catch {
    return createResultError(
      op,
      "The dev environment is not provisioned. Run the dev target first so `<stateDir>/dev/env.json` exists.",
    )
  }
  const parsed = e2eDevEnvironmentEnvFileParse(raw)
  if (!parsed.success) return parsed
  return createResult({
    memberPassword: parsed.data.memberPassword,
    memberUsername: devMemberUserName,
    servicePassword: parsed.data.servicePassword,
    serviceUsername: e2eServiceUserIdentityGet().userName,
  })
}

export function e2eServiceCredentialsRequire(environment: Readonly<Record<string, string | undefined>> = process.env): {
  readonly password: string
  readonly username: string
} {
  const username = environment.AUTHWORKS_E2E_SERVICE_USERNAME?.trim() ?? ""
  const password = environment.AUTHWORKS_E2E_SERVICE_PASSWORD ?? ""
  if (username.length === 0 || password.length === 0)
    throw new Error(
      "Live admin E2E requires AUTHWORKS_E2E_SERVICE_USERNAME and AUTHWORKS_E2E_SERVICE_PASSWORD: " +
        "on production provision the service user (task 23) and write .env.production; " +
        "on dev they come from <stateDir>/dev/env.json via the orchestrator.",
    )
  return { password, username }
}
