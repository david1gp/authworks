import * as v from "valibot"
import { authworksProfileSchema } from "./authworksProfileSchema.js"

export const authworksConfigurationSchema = v.strictObject({
  defaultProfile: v.optional(v.pipe(v.string(), v.minLength(1))),
  profiles: v.record(v.string(), authworksProfileSchema),
})

export type AuthworksConfiguration = v.InferOutput<typeof authworksConfigurationSchema>
