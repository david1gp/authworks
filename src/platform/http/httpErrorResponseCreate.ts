import type { HttpErrorResponse } from "./httpErrorResponseSchema.js"

export function httpErrorResponseCreate(code: string, message: string): HttpErrorResponse {
  return { error: { code, message } }
}
