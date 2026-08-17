import * as v from "valibot"
import { oidcClientStatusSchema } from "../domain/oidcClientStatusSchema.js"

export const oidcClientStatusChangedEventPayloadSchema = v.strictObject({ status: oidcClientStatusSchema })

export type OidcClientStatusChangedEventPayload = v.InferOutput<typeof oidcClientStatusChangedEventPayloadSchema>
