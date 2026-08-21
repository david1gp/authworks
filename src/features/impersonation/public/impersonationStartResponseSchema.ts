import type { SessionCredentialResponse } from "../../sessions/public/sessionCredentialResponseSchema.js"
import { sessionCredentialResponseSchema } from "../../sessions/public/sessionCredentialResponseSchema.js"

export const impersonationStartResponseSchema = sessionCredentialResponseSchema

export type ImpersonationStartResponse = SessionCredentialResponse
