import * as v from "valibot"
import { projectApplicationSchema } from "./projectApplicationSchema.js"

export const projectApplicationResponseSchema = v.strictObject({ application: projectApplicationSchema })

export type ProjectApplicationResponse = v.InferOutput<typeof projectApplicationResponseSchema>
