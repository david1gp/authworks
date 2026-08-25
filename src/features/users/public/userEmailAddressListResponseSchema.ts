import type * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { userEmailAddressSchema } from "./userEmailAddressSchema.js"

export const userEmailAddressListResponseSchema = listResponseSchemaCreate(userEmailAddressSchema)

export type UserEmailAddressListResponse = v.InferOutput<typeof userEmailAddressListResponseSchema>
