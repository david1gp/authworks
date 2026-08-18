import type { ResultErr } from "#result"

export function resultErrorDetailsParse(result: ResultErr): Record<string, unknown> | undefined {
  if (typeof result.errorData !== "string") return undefined
  try {
    const parsed: unknown = JSON.parse(result.errorData)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined
    return parsed as Record<string, unknown>
  } catch (_error) {
    return undefined
  }
}
