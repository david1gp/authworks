import * as v from "valibot"

export const emailGeneratorLanguageSchema = v.picklist(["de", "en", "ru", "tj"])

export type EmailGeneratorLanguage = v.InferOutput<typeof emailGeneratorLanguageSchema>
