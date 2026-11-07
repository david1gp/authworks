import * as v from "valibot"
import { teamSchema } from "./teamSchema.js"

export const teamMemberAssignResponseSchema = v.strictObject({ team: teamSchema })

export type TeamMemberAssignResponse = v.InferOutput<typeof teamMemberAssignResponseSchema>
