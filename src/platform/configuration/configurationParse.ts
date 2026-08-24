import * as v from "valibot"
import { createResult, type Result } from "#result"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"
import { type Configuration, configurationSchema } from "./configurationSchema.js"

const defaultValues = {
  databasePath: "authworks.sqlite",
  host: "127.0.0.1",
  nodeEnv: "development",
  port: 3000,
} as const

export function configurationParse(input: unknown): Result<Configuration> {
  const op = "configurationParse"
  if (!isRecord(input)) return resultErrorCreate(op, "Configuration must be an object.")

  const normalized = configurationInputNormalize(input)
  if (!normalized.success) return normalized

  const parsed = v.safeParse(configurationSchema, normalized.data)
  if (!parsed.success) {
    const fields = parsed.issues
      .map((issue) => issue.path?.at(-1)?.key)
      .filter((field): field is string => typeof field === "string")
    const uniqueFields = [...new Set(fields)]
    const suffix = uniqueFields.length > 0 ? ` Invalid fields: ${uniqueFields.join(", ")}.` : ""
    return resultErrorCreate(op, `Configuration is invalid.${suffix}`)
  }

  const publicOrigin = new URL(parsed.output.publicOrigin)
  if (!isPublicOrigin(publicOrigin, parsed.output.publicOrigin))
    return resultErrorCreate(op, "Configuration is invalid. Invalid fields: publicOrigin.")
  if (parsed.output.nodeEnv === "production" && publicOrigin.protocol !== "https:") {
    return resultErrorCreate(op, "Configuration is invalid. Invalid fields: publicOrigin.")
  }

  const pathname = publicOrigin.pathname === "/" ? "" : publicOrigin.pathname.replace(/\/+$/, "")
  return createResult({ ...parsed.output, publicOrigin: publicOrigin.origin + pathname })
}

function configurationInputNormalize(input: Record<string, unknown>): Result<Record<string, unknown>> {
  const op = "configurationParse"
  const normalized = { ...input }
  const aliases = [
    { internal: "databasePath", external: "DATABASE_PATH" },
    { internal: "host", external: "HOST" },
    { internal: "nodeEnv", external: "NODE_ENV" },
    { internal: "port", external: "PORT" },
    { internal: "publicOrigin", external: "PUBLIC_ORIGIN" },
    { internal: "trustedProxyAddresses", external: "AUTHWORKS_TRUSTED_PROXY_ADDRESSES" },
  ] as const

  for (const alias of aliases) {
    const internalValue = normalizeConfigurationValue(alias.internal, input[alias.internal])
    const externalValue = normalizeConfigurationValue(alias.internal, input[alias.external])
    if (
      internalValue !== undefined &&
      externalValue !== undefined &&
      !configurationValuesEqual(internalValue, externalValue)
    ) {
      return resultErrorCreate(
        op,
        `Configuration is invalid. Conflicting values for ${alias.internal} and ${alias.external}.`,
      )
    }
    const value = internalValue ?? externalValue
    if (value !== undefined) normalized[alias.internal] = value
    delete normalized[alias.external]
  }

  normalized.databasePath ??= defaultValues.databasePath
  normalized.host ??= defaultValues.host
  normalized.nodeEnv ??= defaultValues.nodeEnv
  normalized.port ??= defaultValues.port
  normalized.trustedProxyAddresses ??= []

  return createResult(normalized)
}

function normalizeConfigurationValue(field: string, value: unknown): unknown {
  if (field === "port" && typeof value === "string" && /^\d+$/.test(value)) return Number(value)
  if (field === "trustedProxyAddresses" && typeof value === "string")
    return value
      .split(",")
      .map((address) => address.trim())
      .filter((address) => address.length > 0)
  return value
}

function configurationValuesEqual(first: unknown, second: unknown): boolean {
  if (Array.isArray(first) && Array.isArray(second))
    return first.length === second.length && first.every((value, index) => value === second[index])
  return first === second
}

function isPublicOrigin(url: URL, input: string): boolean {
  const rawPathname = input.match(/^[a-z][a-z\d+.-]*:\/\/[^/?#]*(\/[^?#]*)?/i)?.[1] ?? "/"
  const normalizedRawPathname = rawPathname.replaceAll(/%2e/gi, ".")
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.username === "" &&
    url.password === "" &&
    url.pathname.startsWith("/") &&
    !normalizedRawPathname.includes("..") &&
    url.search === "" &&
    url.hash === ""
  )
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
}
