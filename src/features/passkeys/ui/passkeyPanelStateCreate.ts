export function passkeyPanelStateCreate(options: {
  readonly mfaAvailable: () => boolean | undefined
  readonly mfaContinuation: () => boolean
  readonly supported: () => boolean
}) {
  return {
    canVerify: () => options.supported() && (!options.mfaContinuation() || options.mfaAvailable() === true),
    unavailable: () => options.mfaContinuation() && options.mfaAvailable() !== true,
  }
}
