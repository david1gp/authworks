import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function accountFactorsSectionStateCreate(state: () => AccountSecurityViewState) {
  const renameEnrollmentId = createSignalObject<string | undefined>(undefined)
  const renameLabel = createSignalObject("")
  const stepUpFactor = () => {
    const challenge = state().totpRemoveStepUpChallenge()?.challenge
    return challenge?.factor ?? challenge?.availableFactors?.[0] ?? "totp"
  }

  return {
    confirmDisabled: () => state().pendingId() === "totp:confirm" || !/^\d{6}$/.test(state().code()),
    confirmPending: () => state().pendingId() === "totp:confirm",
    enrollments: () => state().methods().totp.enrollments,
    enrolled: () => state().methods().totp.enrolled,
    renameDialogOpen: (enrollmentId: string) => renameEnrollmentId.get() === enrollmentId,
    renameDialogOpenSet: (enrollmentId: string, label: string, open: boolean) => {
      if (open) {
        renameEnrollmentId.set(enrollmentId)
        renameLabel.set(label)
        return
      }
      if (renameEnrollmentId.get() === enrollmentId) renameEnrollmentId.set(undefined)
    },
    renameLabel: renameLabel.get,
    renameLabelInput: (event: InputEvent & { currentTarget: HTMLInputElement }) =>
      renameLabel.set(event.currentTarget.value),
    renameRemove: async (enrollmentId: string) => {
      const removed = await state().totpRemove(enrollmentId)
      if (removed || state().totpRemoveStepUpEnrollmentId() === enrollmentId) renameEnrollmentId.set(undefined)
    },
    renameSubmit: async (event: SubmitEvent) => {
      event.preventDefault()
      const enrollmentId = renameEnrollmentId.get()
      const label = renameLabel.get().trim()
      if (enrollmentId === undefined || label.length === 0) return
      if (await state().totpRename(enrollmentId, label)) renameEnrollmentId.set(undefined)
    },
    startPending: () => state().pendingId() === "totp:start",
    stepUpFactor,
    stepUpOpen: () =>
      state().totpRemoveStepUpEnrollmentId() !== undefined ||
      state().totpRemoveStepUpChallenge() !== undefined ||
      state().totpRemoveStepUpPending() ||
      state().totpRemoveStepUpError() !== undefined,
    stepUpSubmit: (event: SubmitEvent) => {
      event.preventDefault()
      if (!/^\d{6}$/.test(state().totpRemoveStepUpCode())) return
      void state().totpRemoveStepUpComplete({ code: state().totpRemoveStepUpCode(), factor: stepUpFactor() })
    },
  }
}
