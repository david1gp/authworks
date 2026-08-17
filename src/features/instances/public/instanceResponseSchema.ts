import * as v from "valibot"
import { instanceSchema } from "./instanceSchema.js"

export const instanceResponseSchema = v.strictObject({ instance: instanceSchema })

export type InstanceResponse = v.InferOutput<typeof instanceResponseSchema>
