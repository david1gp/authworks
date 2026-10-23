import * as v from "valibot"
import { createResult, createResultError, type Result } from "#result"
import { type E2eTarget, e2eTargetSchema } from "./e2eTargetSchema.js"

export type E2eTargetResolved = {
  readonly baseUrl: string
  readonly target: E2eTarget
}

type E2eTargetEnvironment = Readonly<Record<string, string | undefined>>

const productionBaseUrl = "https://authworks.contentoren.de"
const devBaseUrlDefault = "http://127.0.0.1:5190"

export function e2eTargetResolve(environment: E2eTargetEnvironment = process.env): Result<E2eTargetResolved> {
  const op = "e2eTargetResolve"
  const rawTarget = environment.AUTHWORKS_E2E_TARGET
  const parsed = v.safeParse(e2eTargetSchema, rawTarget === undefined || rawTarget === "" ? "production" : rawTarget)
  if (!parsed.success)
    return createResultError(
      op,
      `Invalid AUTHWORKS_E2E_TARGET: ${v.summarize(parsed.issues)}. Expected "production" or "dev".`,
    )
  if (parsed.output === "production") return createResult({ baseUrl: productionBaseUrl, target: parsed.output })
  const baseUrl = environment.AUTHWORKS_E2E_BASE_URL
  return createResult({
    baseUrl: baseUrl === undefined || baseUrl === "" ? devBaseUrlDefault : baseUrl,
    target: parsed.output,
  })
}
