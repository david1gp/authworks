import type { ContentfulStatusCode } from "hono/utils/http-status"
import type { Result } from "#result"
import { httpConditionalGetEvaluate } from "./httpConditionalGetEvaluate.js"
import { httpErrorResultCreate } from "./httpErrorResultCreate.js"
import { httpRequestIdGet } from "./httpRequestIdGet.js"

type HttpResultResponseContext = {
  readonly json: (body: unknown, status?: ContentfulStatusCode) => Response
  readonly req: {
    readonly header: (name: string) => string | undefined
    readonly method?: string
  }
}

type HttpResultResponseMetadataContext = HttpResultResponseContext & {
  readonly get?: (name: string) => unknown
  readonly set?: (name: string, value: unknown) => void
}

export function httpResultResponseCreate<T>(
  context: HttpResultResponseContext,
  result: Result<T>,
  status = 200,
  lastModified?: Date,
): Response {
  const metadataContext = context as HttpResultResponseMetadataContext
  const contextualRequestId = metadataContext.get?.("httpRequestId")
  const requestId =
    typeof contextualRequestId === "string"
      ? httpRequestIdGet(contextualRequestId, () => crypto.randomUUID())
      : crypto.randomUUID()
  metadataContext.set?.("httpRequestId", requestId)
  if (!result.success) metadataContext.set?.("httpOperation", result.op)
  if (!result.success) {
    const mapped = httpErrorResultCreate({ requestId, result })
    const response = context.json(mapped.body, mapped.status as ContentfulStatusCode)
    response.headers.set("x-request-id", requestId)
    if (mapped.retryAfterSeconds !== undefined) response.headers.set("retry-after", String(mapped.retryAfterSeconds))
    else if (mapped.retryable) response.headers.set("retry-after", "1")
    return response
  }
  if (lastModified === undefined) {
    const response = context.json(result.data, status as ContentfulStatusCode)
    response.headers.set("x-request-id", requestId)
    return response
  }

  const decision = httpConditionalGetEvaluate({
    ifModifiedSince: context.req.header("if-modified-since"),
    lastModified,
  })
  const method = (context.req.method ?? "GET").toUpperCase()
  if (status === 200 && (method === "GET" || method === "HEAD") && decision.status === 304) {
    return new Response(null, {
      headers: {
        "Cache-Control": "private, no-cache",
        "Last-Modified": decision.lastModified,
        "x-request-id": requestId,
      },
      status: 304,
    })
  }

  const response = context.json(result.data, status as ContentfulStatusCode)
  response.headers.set("x-request-id", requestId)
  response.headers.set("Last-Modified", decision.lastModified)
  response.headers.set("Cache-Control", "private, no-cache")
  return response
}
