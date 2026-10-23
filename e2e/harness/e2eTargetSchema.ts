import * as v from "valibot"

export const e2eTargetSchema = v.picklist(["production", "dev"])

export type E2eTarget = v.InferOutput<typeof e2eTargetSchema>
