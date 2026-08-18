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

function scopeIdEnvironmentName(name: ScopeIdName): "AUTHWORKS_ORGANIZATION_ID" | "AUTHWORKS_REALM_ID" {
  if (name === "organization") return "AUTHWORKS_ORGANIZATION_ID"
  return "AUTHWORKS_REALM_ID"
}
