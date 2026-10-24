import * as v from "valibot"

const dialogSchema = v.picklist(["edit-profile", "assign-roles", "set-password", "delete"])
const tabSchema = v.picklist(["overview", "access", "security"])

const dialogValueGet = (search: string): string | undefined => {
  const value = new URLSearchParams(search).get("dialog")
  return value === null ? undefined : value
}

const tabValueGet = (search: string): string | undefined => {
  const value = new URLSearchParams(search).get("tab")
  return value === null ? undefined : value
}

/** Selected `?dialog=` value of the user profile page; unknown values resolve to undefined. */
export function directoryUserProfileDialogSelect(search: string): v.InferOutput<typeof dialogSchema> | undefined {
  const parsed = v.safeParse(dialogSchema, dialogValueGet(search))
  return parsed.success ? parsed.output : undefined
}

/** Selected `?tab=` value of the user profile page, defaulting to the overview tab. */
export function directoryUserProfileTabSelect(search: string): v.InferOutput<typeof tabSchema> {
  const parsed = v.safeParse(tabSchema, tabValueGet(search))
  return parsed.success ? parsed.output : "overview"
}
