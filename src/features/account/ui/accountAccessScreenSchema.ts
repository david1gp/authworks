import * as v from "valibot"

export const accountAccessScreenSchema = v.picklist(["organizations", "consents", "invitations", "invitation"])

export type AccountAccessScreen = v.InferOutput<typeof accountAccessScreenSchema>
