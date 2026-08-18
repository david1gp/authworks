import type { ContentfulStatusCode } from "hono/utils/http-status"
import type { Result } from "#result"
import { httpErrorResultCreate } from "./httpErrorResultCreate.js"
import { httpRequestIdGet } from "./httpRequestIdGet.js"

type HttpResultResponseContext = {
  readonly json: (body: unknown, status?: ContentfulStatusCode) => Response
  readonly req: {
    readonly header: (name: string) => string | undefined
  }
}

export function httpResultResponseCreate<T>(
  context: HttpResultResponseContext,
  result: Result<T>,
  status = 200,
): Response {
  const requestId = httpRequestIdGet(context.req.header("x-request-id"), () => crypto.randomUUID())
  if (!result.success) {
    const mapped = httpErrorResultCreate({ requestId, result })
    const response = context.json(mapped.body, mapped.status as ContentfulStatusCode)
    response.headers.set("x-request-id", requestId)
    if (mapped.retryable) response.headers.set("retry-after", "1")
    return response
  }
  const response = context.json(result.data, status as ContentfulStatusCode)
  response.headers.set("x-request-id", requestId)
  return response
}
