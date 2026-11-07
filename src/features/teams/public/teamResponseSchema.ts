import * as v from "valibot"
import { teamSchema } from "./teamSchema.js"

export const teamResponseSchema = v.strictObject({ team: teamSchema })

export type TeamResponse = v.InferOutput<typeof teamResponseSchema>
