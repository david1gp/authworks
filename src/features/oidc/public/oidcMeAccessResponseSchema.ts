import * as v from "valibot"

const oidcMeAccessNonEmptyStringSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(512))

export const oidcMeAccessResponseSchema = v.strictObject({
  organizations: v.array(
    v.strictObject({
      id: oidcMeAccessNonEmptyStringSchema,
      name: oidcMeAccessNonEmptyStringSchema,
      primaryDomain: v.nullable(oidcMeAccessNonEmptyStringSchema),
      roles: v.array(oidcMeAccessNonEmptyStringSchema),
    }),
  ),
  projectRoles: v.array(
    v.strictObject({
      organizationId: oidcMeAccessNonEmptyStringSchema,
      projectId: oidcMeAccessNonEmptyStringSchema,
      roleKeys: v.array(oidcMeAccessNonEmptyStringSchema),
    }),
  ),
  sub: oidcMeAccessNonEmptyStringSchema,
})

export type OidcMeAccessResponse = v.InferOutput<typeof oidcMeAccessResponseSchema>
