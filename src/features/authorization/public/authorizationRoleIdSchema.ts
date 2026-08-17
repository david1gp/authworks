import * as v from "valibot"

export const authorizationRoleIdSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(128),
  v.regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/),
)

export type AuthorizationRoleId = v.InferOutput<typeof authorizationRoleIdSchema>
