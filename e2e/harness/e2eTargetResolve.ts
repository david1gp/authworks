import * as v from "valibot"
import { createResult, createResultError, type Result } from "#result"
import { type E2eTarget, e2eTargetSchema } from "./e2eTargetSchema.js"

export type E2eTargetResolved = {
  readonly baseUrl: string
  readonly target: E2eTarget
}

type E2eTargetEnvironment = Readonly<Record<string, string | undefined>>

export const e2eProductionBaseUrl = "https://authworks.contentoren.de"
const e2eProductionHostname = "authworks.contentoren.de"
// Canonical dev origin (see e2eDevEnvironmentHost/e2eDevEnvironmentPort in e2eDevEnvironmentEnsure.ts).
const devBaseUrlDefault = "http://login.localhost:5190"

const missingTargetError =
  'AUTHWORKS_E2E_TARGET is not set. Expected "production" or "dev". There is no default environment.'

export function e2eTargetResolve(environment: E2eTargetEnvironment = process.env): Result<E2eTargetResolved> {
  const op = "e2eTargetResolve"
  const rawTarget = environment.AUTHWORKS_E2E_TARGET
  if (rawTarget === undefined || rawTarget === "") return createResultError(op, missingTargetError)
  const parsed = v.safeParse(e2eTargetSchema, rawTarget)
  if (!parsed.success)
    return createResultError(
      op,
      `Invalid AUTHWORKS_E2E_TARGET: ${v.summarize(parsed.issues)}. Expected "production" or "dev".`,
    )
  const override = environment.AUTHWORKS_E2E_BASE_URL
  const baseUrl =
    override === undefined || override === ""
      ? parsed.output === "production"
        ? e2eProductionBaseUrl
        : devBaseUrlDefault
      : override
  const mismatch = e2eTargetBaseUrlAssert(parsed.output, baseUrl)
  if (mismatch !== undefined) return createResultError(op, mismatch)
  return createResult({ baseUrl, target: parsed.output })
}

export function e2eTargetRequire(environment: E2eTargetEnvironment = process.env): E2eTargetResolved {
  const resolved = e2eTargetResolve(environment)
  if (!resolved.success) throw new Error(resolved.errorMessage)
  return resolved.data
}

export function e2eTargetBaseUrlAssert(target: E2eTarget, baseUrl: string): string | undefined {
  let hostname: string
  try {
    hostname = new URL(baseUrl).hostname
  } catch {
    return `Invalid AUTHWORKS_E2E_BASE_URL "${baseUrl}" for target "${target}": not a valid URL.`
  }
  if (target === "dev" && hostname === e2eProductionHostname)
    return (
      `Refusing target "dev" with production AUTHWORKS_E2E_BASE_URL "${baseUrl}". ` +
      `Set AUTHWORKS_E2E_TARGET="production" for production runs.`
    )
  if (target === "production" && e2eTargetHostnameIsLocal(hostname))
    return (
      `Refusing target "production" with local AUTHWORKS_E2E_BASE_URL "${baseUrl}". ` +
      `Set AUTHWORKS_E2E_TARGET="dev" for local runs.`
    )
  return undefined
}

function e2eTargetHostnameIsLocal(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "::1"
}
