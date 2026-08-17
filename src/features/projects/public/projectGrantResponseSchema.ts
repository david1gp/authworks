import * as v from "valibot"
import { projectGrantSchema } from "./projectGrantSchema.js"

export const projectGrantResponseSchema = v.strictObject({ grant: projectGrantSchema })

export type ProjectGrantResponse = v.InferOutput<typeof projectGrantResponseSchema>
