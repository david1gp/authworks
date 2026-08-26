import * as v from "valibot"

export const r2ConfigurationSchema = v.strictObject({
  accessKeyId: v.pipe(v.string(), v.minLength(1)),
  accountId: v.pipe(v.string(), v.minLength(1)),
  bucket: v.pipe(v.string(), v.minLength(1)),
  endpoint: v.pipe(
    v.string(),
    v.url(),
    v.check((value) => new URL(value).protocol === "https:"),
  ),
  publicOrigin: v.pipe(v.string(), v.url()),
  secretAccessKey: v.pipe(v.string(), v.minLength(1)),
})

export type R2Configuration = v.InferOutput<typeof r2ConfigurationSchema>
