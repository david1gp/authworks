import * as v from "valibot"

const oidcUserInfoStringSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(512))
const oidcUserInfoActorSchema = v.strictObject({ sub: oidcUserInfoStringSchema })

export const oidcUserInfoSchema = v.strictObject({
  act: v.optional(oidcUserInfoActorSchema),
  acr: v.optional(v.picklist(["none", "authenticated", "multi_factor"])),
  amr: v.optional(v.array(v.pipe(v.string(), v.minLength(1)))),
  auth_time: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  email: v.optional(v.pipe(v.string(), v.email())),
  email_verified: v.optional(v.boolean()),
  family_name: v.optional(oidcUserInfoStringSchema),
  given_name: v.optional(oidcUserInfoStringSchema),
  locale: v.optional(oidcUserInfoStringSchema),
  name: v.optional(oidcUserInfoStringSchema),
  nickname: v.optional(oidcUserInfoStringSchema),
  preferred_username: v.optional(oidcUserInfoStringSchema),
  sub: oidcUserInfoStringSchema,
})

export type OidcUserInfo = v.InferOutput<typeof oidcUserInfoSchema>
