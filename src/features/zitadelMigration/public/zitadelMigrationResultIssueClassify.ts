import type { ZitadelMigrationIssue } from "./zitadelMigrationIssue.js"

type FailedResult = Readonly<Record<string, unknown>>

export function zitadelMigrationResultIssueClassify(collection: string, result: FailedResult): ZitadelMigrationIssue {
  const nestedError = result.error as Readonly<Record<string, unknown>> | undefined
  const code = (stringGet(result.code) ?? stringGet(result.errorCode) ?? stringGet(nestedError?.code))?.toLowerCase()
  const statusName = stringGet(result.status)?.toLowerCase()
  const status = numberGet(result.status ?? result.statusCode)
  if (code === "invalid_argument" || code === "invalid-argument" || statusName === "invalid_argument" || status === 400)
    return { collection, code: "source-malformed-request", reason: "request was rejected as malformed" }
  if (
    code === "permission_denied" ||
    code === "permission-denied" ||
    statusName === "permission_denied" ||
    status === 403
  )
    return { collection, code: "source-permission-denied", reason: "service account lacks permission" }
  if (code === "unauthenticated" || statusName === "unauthenticated" || status === 401)
    return { collection, code: "source-unauthenticated", reason: "service account authentication failed" }
  if (
    code === "unavailable" ||
    code === "deadline_exceeded" ||
    statusName === "unavailable" ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503
  )
    return { collection, code: "source-unavailable", reason: "source service was unavailable" }
  if (
    code === "config" ||
    code === "configuration" ||
    code === "invalid_config" ||
    /config(?:uration)?\s+(?:validation|invalid)|invalid\s+config(?:uration)?/i.test(
      stringGet(result.errorMessage) ?? "",
    )
  )
    return { collection, code: "source-config-invalid", reason: "source client configuration is invalid" }
  if (code === "not_found" || code === "unimplemented" || status === 404 || status === 501)
    return { collection, code: "source-request-failed", reason: "source endpoint or method is unavailable" }
  return { collection, code: "source-request-failed", reason: "source request failed" }
}

function stringGet(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function numberGet(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined
}
