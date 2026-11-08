import * as v from "valibot"

export const organizationSlugSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(64),
  v.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  v.check((slug) => slug !== "new" && slug !== "unassigned"),
)

export type OrganizationSlug = v.InferOutput<typeof organizationSlugSchema>
