const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Builds an in-memory file payload for the account profile-picture chooser. */
export function accountPictureFileFixture(options: {
  readonly bytes: number
  readonly mimeType: string
  readonly name: string
}) {
  const buffer = Buffer.alloc(options.bytes, 0x2a)
  if (options.mimeType === "image/png" && options.bytes >= pngSignature.length) pngSignature.copy(buffer)
  return { buffer, mimeType: options.mimeType, name: options.name }
}
