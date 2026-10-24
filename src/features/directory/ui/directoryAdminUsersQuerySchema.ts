import * as v from "valibot"
import { organizationRoleIdSchema } from "../../organizations/public/organizationRoleIdSchema.js"
import { directoryAdminTabSchema } from "./directoryAdminTabSchema.js"

const dialogSchema = v.picklist(["invite", "create-user", "create-service-account"])
const scopeSchema = v.picklist(["organization", "all"])
const sortSchema = v.picklist(["lastSignInAt", "userName", "createdAt"])
const directionSchema = v.picklist(["asc", "desc"])

export const directoryAdminUsersQuerySchema = v.strictObject({
  dialog: v.optional(dialogSchema),
  dir: v.optional(directionSchema),
  q: v.optional(v.pipe(v.string(), v.maxLength(200))),
  role: v.optional(organizationRoleIdSchema),
  scope: v.optional(scopeSchema),
  sort: v.optional(sortSchema),
  tab: v.optional(directoryAdminTabSchema),
})

export type DirectoryAdminUsersQuery = v.InferOutput<typeof directoryAdminUsersQuerySchema>

/** Validated URL state for the users page; unknown or absent params fall back to defaults. */
export function directoryAdminUsersQueryParse(search: string): DirectoryAdminUsersQuery {
  const params = new URLSearchParams(search)
  const parsed = v.safeParse(directoryAdminUsersQuerySchema, {
    dialog: params.get("dialog") ?? undefined,
    dir: params.get("dir") ?? undefined,
    q: params.get("q") ?? undefined,
    role: params.get("role") ?? undefined,
    scope: params.get("scope") ?? undefined,
    sort: params.get("sort") ?? undefined,
    tab: params.get("tab") ?? undefined,
  })
  if (!parsed.success) return {}
  return parsed.output
}
