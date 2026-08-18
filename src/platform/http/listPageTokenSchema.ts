import * as v from "valibot"

export const listPageTokenSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(2048))
