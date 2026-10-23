import * as v from "valibot"

export const directoryOrganizationUserSummarySchema = v.strictObject({
  roles: v.strictObject({
    admin: v.pipe(v.number(), v.integer(), v.minValue(0)),
    guest: v.pipe(v.number(), v.integer(), v.minValue(0)),
    member: v.pipe(v.number(), v.integer(), v.minValue(0)),
    owner: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
  total: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type DirectoryOrganizationUserSummary = v.InferOutput<typeof directoryOrganizationUserSummarySchema>
