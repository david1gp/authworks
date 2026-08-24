import * as v from "valibot"

export const mfaEmailOtpStageSchema = v.picklist(["code", "enroll", "send"])

export type MfaEmailOtpStage = v.InferOutput<typeof mfaEmailOtpStageSchema>
