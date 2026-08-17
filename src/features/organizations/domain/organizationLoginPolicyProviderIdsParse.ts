export function organizationLoginPolicyProviderIdsParse(value: string | null | undefined): string[] | null {
  if (value === null || value === undefined) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed === null) return null
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) return []
    return parsed
  } catch (_error) {
    return []
  }
}
