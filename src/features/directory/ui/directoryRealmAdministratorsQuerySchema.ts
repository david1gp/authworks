import * as v from "valibot"

const dialogSchema = v.picklist(["add-admin"])

export const directoryRealmAdministratorsQuerySchema = v.strictObject({
  dialog: v.optional(dialogSchema),
  q: v.optional(v.pipe(v.string(), v.maxLength(200))),
})

export type DirectoryRealmAdministratorsQuery = v.InferOutput<typeof directoryRealmAdministratorsQuerySchema>

/** Validated URL state for the realm administrators page; unknown values fall back to defaults. */
export function directoryRealmAdministratorsQueryParse(search: string): DirectoryRealmAdministratorsQuery {
  const params = new URLSearchParams(search)
  const parsed = v.safeParse(directoryRealmAdministratorsQuerySchema, {
    dialog: params.get("dialog") ?? undefined,
    q: params.get("q") ?? undefined,
  })
  return parsed.success ? parsed.output : {}
}

/** True when the add-administrator picker dialog owns the URL dialog slot. */
export function directoryRealmAdministratorsAddDialogOpenGet(search: string): boolean {
  return directoryRealmAdministratorsQueryParse(search).dialog === "add-admin"
}
