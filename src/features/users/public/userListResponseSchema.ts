import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { userSchema } from "./userSchema.js"

export const userListResponseSchema = listResponseSchemaCreate(userSchema)

export type UserListResponse = v.InferOutput<typeof userListResponseSchema>
