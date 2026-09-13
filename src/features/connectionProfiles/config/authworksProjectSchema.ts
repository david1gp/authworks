import * as v from "valibot"

export const authworksProjectSchema = v.strictObject({
  profile: v.pipe(v.string(), v.minLength(1)),
  projectId: v.pipe(v.string(), v.minLength(1)),
})

export type AuthworksProject = v.InferOutput<typeof authworksProjectSchema>
