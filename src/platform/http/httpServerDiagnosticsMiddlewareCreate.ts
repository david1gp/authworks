import type { MiddlewareHandler } from "hono"
import { httpDiagnosticPathCreate } from "./httpDiagnosticPathCreate.js"

type HttpServerDiagnostic = {
  readonly event: "authworks.http.error" | "authworks.http.request"
  readonly method: string
  readonly op?: string
  readonly path: string
  readonly requestId: string
  readonly status: number
}

export function httpServerDiagnosticsMiddlewareCreate(
  options: { readonly enabled?: boolean; readonly log?: (diagnostic: HttpServerDiagnostic) => void } = {},
): MiddlewareHandler {
  const log = options.log ?? httpServerDiagnosticConsoleLog
  return async (context, next) => {
    if (options.enabled === false) {
      await next()
      return
    }
    const requestId = crypto.randomUUID()
    context.set("httpRequestId", requestId)
    context.header("x-request-id", requestId)

    try {
      await next()
    } catch (error) {
      log(
        httpServerDiagnosticCreate({
          context,
          event: "authworks.http.error",
          requestId,
          status: 500,
        }),
      )
      throw error
    }

    const status = context.res.status
    log(
      httpServerDiagnosticCreate({
        context,
        event: status >= 400 ? "authworks.http.error" : "authworks.http.request",
        requestId,
        status,
      }),
    )
  }
}

function httpServerDiagnosticConsoleLog(diagnostic: HttpServerDiagnostic): void {
  if (diagnostic.event === "authworks.http.error") console.error(diagnostic)
  else console.info(diagnostic)
}

function httpServerDiagnosticCreate(input: {
  readonly context: Parameters<MiddlewareHandler>[0]
  readonly event: HttpServerDiagnostic["event"]
  readonly requestId: string
  readonly status: number
}): HttpServerDiagnostic {
  const operation = httpServerDiagnosticOperationGet(input.context)
  return {
    event: input.event,
    method: input.context.req.method,
    path: httpDiagnosticPathCreate(input.context.req.raw.url),
    requestId: input.requestId,
    status: input.status,
    ...(operation === undefined ? {} : { op: operation }),
  }
}

function httpServerDiagnosticOperationGet(context: Parameters<MiddlewareHandler>[0]): string | undefined {
  const errorOperation = context.get("httpOperation")
  if (typeof errorOperation === "string" && /^[a-z][a-z0-9_.-]{0,127}$/i.test(errorOperation)) return errorOperation
  const routePath = context.req.routePath
  return !routePath.includes("*") && routePath.length > 0 && routePath.length <= 256 ? routePath : undefined
}
