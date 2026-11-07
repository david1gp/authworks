import * as v from "valibot"

export const directoryEntryTeamSchema = v.strictObject({
  id: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  slug: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
})

export type DirectoryEntryTeam = v.InferOutput<typeof directoryEntryTeamSchema>
