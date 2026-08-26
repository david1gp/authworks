/** Shared upload limits for profile pictures; the server validator and the account UI use the same values. */
export const userPictureConstraints = {
  contentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] as const,
  maximumBytes: 512 * 1024,
  maximumPixels: 16_777_216,
  maximumPixelsPerSide: 4096,
} as const
