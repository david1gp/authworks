import * as v from "valibot"

export const userPhoneNumberSchema = v.pipe(v.string(), v.regex(/^\+[1-9]\d{1,14}$/))

export type UserPhoneNumber = v.InferOutput<typeof userPhoneNumberSchema>
