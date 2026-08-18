import type { ApplicationContext } from "@stricli/core"

type ScopeIdName = "organization" | "realm"

export function scopeIdResolve(
  context: ApplicationContext,
  flagValue: string | undefined,
  name: ScopeIdName,
  required = true,
): string | undefined {
  const value = flagValue ?? context.process.env?.[scopeIdEnvironmentName(name)]
  if (value !== undefined && value.trim().length > 0) return value
  if (!required) return undefined

  context.process.stderr.write(`Expected input for flag --${name}-id\n`)
  context.process.exitCode = 1
  return undefined
}

function scopeIdEnvironmentName(name: ScopeIdName): "ZITADEL_V2_ORGANIZATION_ID" | "ZITADEL_V2_REALM_ID" {
  if (name === "organization") return "ZITADEL_V2_ORGANIZATION_ID"
  return "ZITADEL_V2_REALM_ID"
}
