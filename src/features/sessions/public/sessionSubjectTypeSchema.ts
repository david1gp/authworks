import * as v from "valibot"

export const sessionSubjectTypeSchema = v.picklist(["user", "bootstrap_admin"])

export type SessionSubjectType = v.InferOutput<typeof sessionSubjectTypeSchema>
