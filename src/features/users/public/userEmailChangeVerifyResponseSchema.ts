import { userResponseSchema } from "./userResponseSchema.js"

export const userEmailChangeVerifyResponseSchema = userResponseSchema

export type UserEmailChangeVerifyResponse = import("./userResponseSchema.js").UserResponse
