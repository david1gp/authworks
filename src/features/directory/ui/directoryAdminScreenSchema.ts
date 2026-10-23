import * as v from "valibot"

export const directoryAdminScreenSchema = v.picklist(["users", "user-detail", "roles", "realm-administrators"])

export type DirectoryAdminScreen = v.InferOutput<typeof directoryAdminScreenSchema>
