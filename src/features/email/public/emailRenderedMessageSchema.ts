import * as v from "valibot"

export const emailRenderedMessageSchema = v.strictObject({
  html: v.string(),
  subject: v.string(),
  text: v.string(),
})

export type EmailRenderedMessage = v.InferOutput<typeof emailRenderedMessageSchema>
