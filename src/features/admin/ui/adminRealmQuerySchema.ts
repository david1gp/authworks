import * as v from "valibot"

const dialogSchema = v.picklist(["edit-realm"])

export const adminRealmQuerySchema = v.strictObject({
  dialog: v.optional(dialogSchema),
})

export type AdminRealmQuery = v.InferOutput<typeof adminRealmQuerySchema>

/** Validated URL state for the realm page; unknown or absent params fall back to defaults. */
export function adminRealmQueryParse(search: string): AdminRealmQuery {
  const params = new URLSearchParams(search)
  const parsed = v.safeParse(adminRealmQuerySchema, {
    dialog: params.get("dialog") ?? undefined,
  })
  if (!parsed.success) return {}
  return parsed.output
}
