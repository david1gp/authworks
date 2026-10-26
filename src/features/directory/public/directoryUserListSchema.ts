import * as v from "valibot"
import { listQuerySchema } from "../../../platform/http/listQuerySchema.js"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { organizationRoleIdSchema } from "../../organizations/public/organizationRoleIdSchema.js"
import { userStateSchema } from "../../users/public/userStateSchema.js"
import { directoryEntrySchema } from "./directoryEntrySchema.js"

const directorySortBySchema = v.picklist(["createdAt", "lastSignInAt", "userName"])

export const directoryUserListQuerySchema = v.strictObject({
  ...listQuerySchema.entries,
  emailVerified: v.optional(v.boolean()),
  role: v.optional(organizationRoleIdSchema),
  sortBy: v.optional(directorySortBySchema),
  state: v.optional(userStateSchema),
})

export const directoryUserListResponseSchema = listResponseSchemaCreate(directoryEntrySchema)

export type DirectoryUserListQuery = v.InferOutput<typeof directoryUserListQuerySchema>
export type DirectoryUserListResponse = v.InferOutput<typeof directoryUserListResponseSchema>
