import * as v from "valibot"
import { patchClearableSchemaCreate } from "../../../platform/http/patchClearableSchemaCreate.js"

const userProfileFieldSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(128))
const userProfileLanguageSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(16))
const userProfileGenderSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(64))

export const userProfileUpdateRequestSchema = v.strictObject({
  displayName: patchClearableSchemaCreate(userProfileFieldSchema),
  firstName: patchClearableSchemaCreate(userProfileFieldSchema),
  gender: patchClearableSchemaCreate(userProfileGenderSchema),
  lastName: patchClearableSchemaCreate(userProfileFieldSchema),
  nickName: patchClearableSchemaCreate(userProfileFieldSchema),
  preferredLanguage: patchClearableSchemaCreate(userProfileLanguageSchema),
})

export type UserProfileUpdateRequest = v.InferOutput<typeof userProfileUpdateRequestSchema>
