import * as v from "valibot"
import { instanceSchema } from "./instanceSchema.js"

export const instanceListResponseSchema = v.strictObject({ instances: v.array(instanceSchema) })

export type InstanceListResponse = v.InferOutput<typeof instanceListResponseSchema>
