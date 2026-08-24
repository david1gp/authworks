export function whatsappOtpAvailabilityPredicate(input: {
  readonly configured: boolean
  readonly freshHealthyCandidate: boolean
  readonly policyEnabled: boolean
}): boolean {
  return input.configured && input.policyEnabled && input.freshHealthyCandidate
}
