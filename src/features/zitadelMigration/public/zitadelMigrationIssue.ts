import * as v from "valibot"

export const zitadelMigrationIssueSchema = v.strictObject({
  collection: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
  code: v.picklist([
    "source-config-invalid",
    "source-permission-denied",
    "source-unauthenticated",
    "source-unavailable",
    "source-malformed-request",
    "source-request-failed",
    "source-unavailable",
    "source-invalid",
    "page-repeated",
    "total-mismatch",
    "pagination-budget",
    "mapping-incomplete",
    "ownership-incomplete",
    "fallback-used",
  ]),
  reason: v.pipe(v.string(), v.minLength(1), v.maxLength(160)),
})

export type ZitadelMigrationIssue = v.InferOutput<typeof zitadelMigrationIssueSchema>
