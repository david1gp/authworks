import * as v from "valibot"

export const passkeyCeremonyPurposeSchema = v.picklist(["passwordless", "mfa", "step_up"])

export type PasskeyCeremonyPurpose = v.InferOutput<typeof passkeyCeremonyPurposeSchema>
