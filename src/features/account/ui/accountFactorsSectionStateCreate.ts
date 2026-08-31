import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function accountFactorsSectionStateCreate(state: () => AccountSecurityViewState) {
  return {
    confirmDisabled: () => state().pendingId() === "totp:confirm" || !/^\d{6}$/.test(state().code()),
    confirmPending: () => state().pendingId() === "totp:confirm",
    enrollments: () => state().methods().totp.enrollments,
    enrolled: () => state().methods().totp.enrolled,
    startPending: () => state().pendingId() === "totp:start",
  }
}
