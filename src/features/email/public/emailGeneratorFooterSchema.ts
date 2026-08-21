import * as v from "valibot"
import { emailGeneratorLanguageSchema } from "./emailGeneratorLanguageSchema.js"

export const emailGeneratorFooterSchema = v.strictObject({
  homepageText: v.pipe(v.string(), v.minLength(1)),
  homepageUrl: v.pipe(v.string(), v.minLength(1)),
  hompageSubtitle: v.pipe(v.string(), v.minLength(1)),
  l: v.optional(emailGeneratorLanguageSchema),
  legalCompanySignature: v.optional(v.pipe(v.string(), v.minLength(1))),
})

export type EmailGeneratorFooter = v.InferOutput<typeof emailGeneratorFooterSchema>
