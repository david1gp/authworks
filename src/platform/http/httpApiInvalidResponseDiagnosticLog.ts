import * as v from "valibot"
import { httpDiagnosticPathCreate } from "./httpDiagnosticPathCreate.js"

type HttpApiInvalidResponseReason = "invalid-json" | "invalid-schema" | "unexpected-304"

export function httpApiInvalidResponseDiagnosticLog(options: {
  readonly issues?: readonly v.BaseIssue<unknown>[]
  readonly op?: string
  readonly reason: HttpApiInvalidResponseReason
  readonly requestId?: string
  readonly status: number
  readonly url: string | URL
  readonly log?: (diagnostic: Record<string, unknown>) => void
}): void {
  if ((globalThis as { readonly window?: unknown }).window === undefined) return

  const operation = diagnosticOperationCreate(options.op)
  const diagnostic = {
    event: "authworks.api.invalid-response",
    path: httpDiagnosticPathCreate(options.url),
    reason: options.reason,
    schema: (options.issues ?? []).slice(0, 20).map((issue) => ({
      code: diagnosticCodeCreate(issue.type),
      path: diagnosticIssuePathCreate(issue),
    })),
    status: options.status,
    ...(operation === undefined ? {} : { op: operation }),
    ...(options.requestId === undefined ? {} : { requestId: options.requestId }),
  }
  if (options.log !== undefined) {
    options.log(diagnostic)
    return
  }
  console.error(diagnostic)
}

function diagnosticCodeCreate(value: string): string {
  return /^[a-z][a-z0-9_.-]{0,63}$/i.test(value) ? value : "unknown"
}

function diagnosticIssuePathCreate(issue: v.BaseIssue<unknown>): string {
  return (
    issue.path
      ?.map((item) => {
        if (typeof item.key === "number" && Number.isSafeInteger(item.key) && item.key >= 0) return String(item.key)
        if (typeof item.key === "string" && /^[a-z][a-z0-9_.-]{0,63}$/i.test(item.key)) return item.key
        return "[redacted]"
      })
      .join(".") ?? ""
  )
}

function diagnosticOperationCreate(value: string | undefined): string | undefined {
  return value !== undefined && /^[a-z][a-z0-9_.-]{0,127}$/i.test(value) ? value : undefined
}
