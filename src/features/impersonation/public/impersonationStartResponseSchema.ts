import * as v from "valibot"
import type { SessionCredentialResponse } from "../../sessions/public/sessionCredentialResponseSchema.js"
import { sessionSchema } from "../../sessions/public/sessionSchema.js"

/**
 * Bearer clients receive the one-time credential; browser clients receive only session metadata
 * while the server places that credential in an HttpOnly cookie.
 */
export const impersonationStartResponseSchema = v.strictObject({
  session: sessionSchema,
  token: v.optional(v.pipe(v.string(), v.minLength(1))),
})

export type ImpersonationStartResponse = Omit<SessionCredentialResponse, "token"> & { readonly token?: string }
