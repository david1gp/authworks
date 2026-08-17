import type { Result } from "#result"
import type { PasswordAuthentication } from "./passwordAuthenticationSchema.js"

export type PasswordSessionCreate = (authentication: PasswordAuthentication) => Result<unknown>
