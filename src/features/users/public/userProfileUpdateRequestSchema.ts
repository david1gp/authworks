import * as v from "valibot"
import { userProfileSchema } from "./userProfileSchema.js"

export const userProfileUpdateRequestSchema = v.partial(userProfileSchema)

export type UserProfileUpdateRequest = v.InferOutput<typeof userProfileUpdateRequestSchema>
