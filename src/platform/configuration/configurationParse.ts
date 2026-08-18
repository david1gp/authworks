import { createResult, type Result } from "#result"
import * as v from "valibot"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"
import { configurationSchema, type Configuration } from "./configurationSchema.js"

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
  ] as const

  for (const alias of aliases) {
    const internalValue = normalizeConfigurationValue(alias.internal, input[alias.internal])
    const externalValue = normalizeConfigurationValue(alias.internal, input[alias.external])
    if (internalValue !== undefined && externalValue !== undefined && internalValue !== externalValue) {
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

  return createResult(normalized)
}

function normalizeConfigurationValue(field: string, value: unknown): unknown {
  if (field === "port" && typeof value === "string" && /^\d+$/.test(value)) return Number(value)
  return value
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
