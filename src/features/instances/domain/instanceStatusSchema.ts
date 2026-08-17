import * as v from "valibot"

export const instanceStatusSchema = v.picklist(["active", "disabled"])

export type InstanceStatus = v.InferOutput<typeof instanceStatusSchema>
