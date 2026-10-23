import * as v from "valibot"

export const directoryAdminTabSchema = v.picklist(["people", "service-accounts", "invitations"])

export type DirectoryAdminTab = v.InferOutput<typeof directoryAdminTabSchema>
