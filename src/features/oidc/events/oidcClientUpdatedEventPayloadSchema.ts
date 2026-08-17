import * as v from "valibot"
import { oidcClientCreatedEventPayloadSchema } from "./oidcClientCreatedEventPayloadSchema.js"

export const oidcClientUpdatedEventPayloadSchema = oidcClientCreatedEventPayloadSchema

export type OidcClientUpdatedEventPayload = v.InferOutput<typeof oidcClientUpdatedEventPayloadSchema>
