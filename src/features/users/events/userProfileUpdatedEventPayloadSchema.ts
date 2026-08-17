import * as v from "valibot"

export const userProfileUpdatedEventPayloadSchema = v.strictObject({
  fields: v.pipe(
    v.array(v.picklist(["displayName", "firstName", "gender", "lastName", "nickName", "preferredLanguage"])),
    v.minLength(1),
  ),
})

export type UserProfileUpdatedEventPayload = v.InferOutput<typeof userProfileUpdatedEventPayloadSchema>
