import * as v from "valibot"
import { userProfileSchema } from "./userProfileSchema.js"

export const userCreateProfileSchema = v.omit(userProfileSchema, ["picture"])

export type UserCreateProfile = v.InferOutput<typeof userCreateProfileSchema>
