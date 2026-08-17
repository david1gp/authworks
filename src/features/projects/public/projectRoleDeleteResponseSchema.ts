import * as v from "valibot"
import { projectResourceIdSchema } from "./projectResourceIdSchema.js"

export const projectRoleDeleteResponseSchema = v.strictObject({ deleted: v.boolean(), roleId: projectResourceIdSchema })

export type ProjectRoleDeleteResponse = v.InferOutput<typeof projectRoleDeleteResponseSchema>
