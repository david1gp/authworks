import { type WahaClientConfigInput, wahaClientConfig } from "@adaptive-ds/waha-client"
import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { WahaConfiguration } from "./wahaConfiguration.js"
import type { WahaEndpointConfiguration } from "./wahaEndpointConfiguration.js"

const defaultFreshnessTtlMs = 90_000
const defaultRefreshIntervalMs = 30_000
const wahaEndpointIdPattern = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$/
const wahaEndpointFields = new Set(["apiKey", "baseUrl", "id", "retries", "session", "timeoutMs"])
const wahaEndpointSchema = v.strictObject({
  apiKey: v.optional(v.string()),
  baseUrl: v.pipe(v.string(), v.minLength(1)),
  id: v.string(),
  retries: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  session: v.optional(v.string()),
  timeoutMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
})

export function wahaConfigurationParse(
  input: Readonly<Record<string, string | undefined>>,
): Result<WahaConfiguration | undefined> {
  const op = "wahaConfigurationParse"
  if (!wahaEnabled(input.AUTHWORKS_WAHA_ENABLED)) return resultCreate(undefined)

  const endpoints = wahaEndpointsParse(input.AUTHWORKS_WAHA_ENDPOINTS)
  if (!endpoints.success) return endpoints
  const refreshIntervalMs = positiveIntegerParse(
    input.AUTHWORKS_WAHA_REFRESH_INTERVAL_MS,
    defaultRefreshIntervalMs,
    "AUTHWORKS_WAHA_REFRESH_INTERVAL_MS",
  )
  if (!refreshIntervalMs.success) return refreshIntervalMs
  const freshnessTtlMs = positiveIntegerParse(
    input.AUTHWORKS_WAHA_FRESHNESS_TTL_MS,
    defaultFreshnessTtlMs,
    "AUTHWORKS_WAHA_FRESHNESS_TTL_MS",
  )
  if (!freshnessTtlMs.success) return freshnessTtlMs
  if (freshnessTtlMs.data < refreshIntervalMs.data)
    return resultErrorCreate(
      op,
      "WAHA configuration is invalid: freshness TTL must not be shorter than refresh interval.",
    )

  return resultCreate({
    endpoints: endpoints.data,
    freshnessTtlMs: freshnessTtlMs.data,
    refreshIntervalMs: refreshIntervalMs.data,
  })
}

function wahaEnabled(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes"
}

function wahaEndpointsParse(value: string | undefined): Result<readonly WahaEndpointConfiguration[]> {
  const op = "wahaConfigurationParse"
  if (value === undefined || value.length === 0)
    return resultErrorCreate(op, "WAHA configuration is missing: AUTHWORKS_WAHA_ENDPOINTS.")

  let decoded: unknown
  try {
    decoded = JSON.parse(value)
  } catch {
    return resultErrorCreate(op, "WAHA configuration is invalid: AUTHWORKS_WAHA_ENDPOINTS must be valid JSON.")
  }
  if (!Array.isArray(decoded) || decoded.length === 0)
    return resultErrorCreate(op, "WAHA configuration is invalid: at least one endpoint is required.")

  const endpoints: WahaEndpointConfiguration[] = []
  const ids = new Set<string>()
  for (const [index, candidate] of decoded.entries()) {
    const endpoint = wahaEndpointParse(candidate, index)
    if (!endpoint.success) return endpoint
    if (ids.has(endpoint.data.id))
      return resultErrorCreate(op, "WAHA configuration is invalid: endpoint IDs must be unique.")
    ids.add(endpoint.data.id)
    endpoints.push(endpoint.data)
  }
  return resultCreate(endpoints)
}

function wahaEndpointParse(value: unknown, index: number): Result<WahaEndpointConfiguration> {
  const op = "wahaConfigurationParse"
  const parsed = v.safeParse(wahaEndpointSchema, value)
  if (!parsed.success) {
    const field = wahaEndpointIssueField(parsed.issues)
    return resultErrorCreate(
      op,
      field
        ? `WAHA configuration is invalid: endpoint ${index + 1}.${field} is invalid.`
        : `WAHA configuration is invalid: endpoint ${index + 1} is invalid.`,
    )
  }

  const { apiKey, baseUrl, id, retries, session, timeoutMs } = parsed.output
  if (!wahaEndpointIdPattern.test(id))
    return resultErrorCreate(
      op,
      `WAHA configuration is invalid: endpoint ${index + 1}.id must be a stable non-secret identifier of 1-128 characters using letters, numbers, '.', '_' or '-'.`,
    )
  if (!urlValid(baseUrl))
    return resultErrorCreate(op, `WAHA configuration is invalid: endpoint ${index + 1}.baseUrl is invalid.`)

  const clientInput: WahaClientConfigInput = {
    baseUrl,
    ...(apiKey === undefined ? {} : { apiKey }),
    ...(session === undefined ? {} : { session }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    ...(retries === undefined ? {} : { retries }),
  }
  const client = wahaClientConfig(clientInput)
  if (!client.success)
    return resultErrorCreate(op, `WAHA configuration is invalid: endpoint ${index + 1}.baseUrl is invalid.`)
  return resultCreate({ client: client.data, id })
}

function wahaEndpointIssueField(issues: readonly { path?: readonly { key?: unknown }[] }[]): string | undefined {
  const path = issues[0]?.path
  const key = path?.[path.length - 1]?.key
  return typeof key === "string" && wahaEndpointFields.has(key) ? key : undefined
}

function positiveIntegerParse(value: string | undefined, defaultValue: number, name: string): Result<number> {
  if (value === undefined) return resultCreate(defaultValue)
  if (!/^\d+$/.test(value))
    return resultErrorCreate("wahaConfigurationParse", `WAHA configuration has an invalid ${name}.`)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    return resultErrorCreate("wahaConfigurationParse", `WAHA configuration has an invalid ${name}.`)
  return resultCreate(parsed)
}

function urlValid(value: string): boolean {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return (url.protocol === "http:" || url.protocol === "https:") && url.username === "" && url.password === ""
}
