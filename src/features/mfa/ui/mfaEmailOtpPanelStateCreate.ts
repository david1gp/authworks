import type { MfaEmailOtpStage } from "./mfaEmailOtpStageSchema.js"

export function mfaEmailOtpPanelStateCreate(stage: () => MfaEmailOtpStage) {
  return {
    isCode: () => stage() === "code",
    isEnroll: () => stage() === "enroll",
    isSend: () => stage() === "send",
  }
}
