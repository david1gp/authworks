import * as v from "valibot"

const tabSchema = v.optional(v.picklist(["overview", "roles", "applications", "access"]), "overview")

export function projectDetailTabSelect(search: string): v.InferOutput<typeof tabSchema> {
  const parsed = v.safeParse(tabSchema, new URLSearchParams(search).get("tab"))
  return parsed.success ? parsed.output : "overview"
}
