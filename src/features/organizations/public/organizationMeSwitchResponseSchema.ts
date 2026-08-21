import type * as v from "valibot"
import { organizationSwitchResponseSchema } from "./organizationSwitchResponseSchema.js"

export const organizationMeSwitchResponseSchema = organizationSwitchResponseSchema

export type OrganizationMeSwitchResponse = v.InferOutput<typeof organizationMeSwitchResponseSchema>
