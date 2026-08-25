import * as v from "valibot"

export const accountEffectiveAccessSourceSchema = v.picklist(["membership", "project-owner", "project-grant"])

export type AccountEffectiveAccessSource = v.InferOutput<typeof accountEffectiveAccessSourceSchema>
