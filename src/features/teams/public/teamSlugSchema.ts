import * as v from "valibot"

export const teamSlugSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(64),
  v.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  v.check((slug) => slug !== "unassigned"),
)

export type TeamSlug = v.InferOutput<typeof teamSlugSchema>
