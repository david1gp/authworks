import * as v from "valibot"

export const oidcConsentBrowserResponseSchema = v.strictObject({
  redirect: v.pipe(v.string(), v.minLength(1), v.maxLength(8192)),
})

export type OidcConsentBrowserResponse = v.InferOutput<typeof oidcConsentBrowserResponseSchema>
