import type { ResultErr } from "#result"

export type HttpGetResult<T> =
  | {
      readonly success: true
      readonly status: "current"
      readonly data: T
      readonly lastModified?: Date
      readonly requestId?: string
    }
  | {
      readonly success: true
      readonly status: "unchanged"
      readonly lastModified?: Date
      readonly requestId?: string
    }
  | ResultErr
