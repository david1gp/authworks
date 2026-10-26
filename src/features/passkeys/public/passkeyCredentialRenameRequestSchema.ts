import * as v from "valibot"

export const passkeyCredentialRenameRequestSchema = v.strictObject({
  nickname: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128)),
})

export type PasskeyCredentialRenameRequest = v.InferOutput<typeof passkeyCredentialRenameRequestSchema>
