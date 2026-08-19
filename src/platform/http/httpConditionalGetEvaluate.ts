import { httpDateFormat } from "./httpDateFormat.js"
import { httpDateParse } from "./httpDateParse.js"

export type HttpConditionalGetDecision = {
  readonly lastModified: string
  readonly status: 200 | 304
}

export function httpConditionalGetEvaluate(input: {
  readonly lastModified: Date
  readonly ifModifiedSince?: string
}): HttpConditionalGetDecision {
  const lastModified = httpDateFormat(input.lastModified)
  const lastModifiedDate = httpDateParse(lastModified)
  const ifModifiedSinceDate = httpDateParse(input.ifModifiedSince)

  if (lastModifiedDate === undefined || ifModifiedSinceDate === undefined) return { lastModified, status: 200 }
  if (lastModifiedDate.getTime() <= ifModifiedSinceDate.getTime()) return { lastModified, status: 304 }
  return { lastModified, status: 200 }
}
