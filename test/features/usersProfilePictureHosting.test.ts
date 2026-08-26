import { deflateSync } from "node:zlib"
import { expect, test } from "bun:test"
import { userProfilePictureHost } from "../../src/features/users/actions/userProfilePictureHost.js"
import { userPictureHashCreate } from "../../src/features/users/domain/userPictureHashCreate.js"
import { userPictureObjectKeyCreate } from "../../src/features/users/domain/userPictureObjectKeyCreate.js"
import { userPictureValidate } from "../../src/features/users/domain/userPictureValidate.js"
import { userPictureConstraints } from "../../src/features/users/public/userPictureConstraints.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import { runtimeCreate } from "../../src/platform/runtime/runtimeCreate.js"

const imageCreate = (base64: string) => Uint8Array.from(Buffer.from(base64, "base64"))
const gif = imageCreate("R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==")
const jpeg = imageCreate(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==",
)
const png = imageCreate(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAACYktHRAAB3YoTpAAAAAd0SU1FB+oIGgccHxrvKFMAAAAKSURBVAjXY2gAAACCAIHdQ2r0AAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDI2LTA4LTI2VDA3OjI4OjMxKzAwOjAw7lEr7gAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyNi0wOC0yNlQwNzoyODozMSswMDowMJ8Mk1IAAAAodEVYdGRhdGU6dGltZXN0YW1wADIwMjYtMDgtMjZUMDc6Mjg6MzErMDA6MDDIGbKNAAAAAElFTkSuQmCC",
)
const webp = imageCreate("UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAgA0JaQAA3AA/vuUAAA=")
const animatedWebp = imageCreate(
  "UklGRsAAAABXRUJQVlA4WAoAAAASAAAAAAAAAAAAQU5JTQYAAAD/////AABBTk1GSAAAAAAAAAAAAAAAAAAAAOgDAABWUDggMAAAANABAJ0BKgEAAQACADQloAJ0ugH4AAOwAP7wxAv/ILlhdcjX/yA/5Af8gP/48gAAAEFOTUZEAAAAAAAAAAAAAAAAAAAA6AMAAFZQOCAsAAAAkAEAnQEqAQABAAIANCWgAnS6AAOYAP75k2//kB//kB//kB//ID/iF3sgMAA=",
)
const maximumPicturePixelsPerSide = userPictureConstraints.maximumPixelsPerSide

const webpBytesConcat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

const webpChunkCreate = (type: string, data: Uint8Array): Uint8Array => {
  const result = new Uint8Array(8 + data.length + (data.length % 2))
  result.set(new TextEncoder().encode(type), 0)
  result[4] = data.length & 0xff
  result[5] = (data.length >>> 8) & 0xff
  result[6] = (data.length >>> 16) & 0xff
  result[7] = (data.length >>> 24) & 0xff
  result.set(data, 8)
  return result
}

const webpContainerCreate = (...chunks: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(12 + chunks.reduce((length, chunk) => length + chunk.length, 0))
  result.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
  const size = result.length - 8
  result[4] = size & 0xff
  result[5] = (size >>> 8) & 0xff
  result[6] = (size >>> 16) & 0xff
  result[7] = (size >>> 24) & 0xff
  let offset = 12
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

const animatedWebpFirstFrameCreate = (frameData: Uint8Array): Uint8Array =>
  webpContainerCreate(
    animatedWebp.subarray(12, 44),
    webpChunkCreate("ANMF", webpBytesConcat(animatedWebp.subarray(52, 68), frameData)),
    animatedWebp.subarray(124),
  )

const jpegDimensionsCreate = (width: number, height: number): Uint8Array => {
  const body = jpeg.slice()
  const frameMarker = body.findIndex((byte, index) => byte === 0xff && body[index + 1] === 0xc0)
  if (frameMarker < 0) throw new Error("The JPEG fixture has no frame marker.")
  body[frameMarker + 5] = height >>> 8
  body[frameMarker + 6] = height & 0xff
  body[frameMarker + 7] = width >>> 8
  body[frameMarker + 8] = width & 0xff
  return body
}

const pngBytesConcat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

const pngChunkCreate = (type: string, data: Uint8Array): Uint8Array => {
  const result = new Uint8Array(12 + data.length)
  uint32BigEndianWrite(result, 0, data.length)
  result.set(new TextEncoder().encode(type), 4)
  result.set(data, 8)
  uint32BigEndianWrite(result, 8 + data.length, pngCrc32(result, 4, 4 + data.length))
  return result
}

const pngCreate = (input: {
  readonly bitDepth?: number
  readonly colorType?: number
  readonly compressedData: Uint8Array
  readonly compressedDataChunks?: readonly Uint8Array[]
  readonly height?: number
  readonly interlace?: number
  readonly width?: number
}): Uint8Array => {
  const header = new Uint8Array(13)
  uint32BigEndianWrite(header, 0, input.width ?? 1)
  uint32BigEndianWrite(header, 4, input.height ?? 1)
  header[8] = input.bitDepth ?? 8
  header[9] = input.colorType ?? 0
  header[10] = 0
  header[11] = 0
  header[12] = input.interlace ?? 0
  const compressedDataChunks = input.compressedDataChunks ?? [input.compressedData]
  return pngBytesConcat(
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunkCreate("IHDR", header),
    ...compressedDataChunks.map((data) => pngChunkCreate("IDAT", data)),
    pngChunkCreate("IEND", new Uint8Array()),
  )
}

const pngDimensionsCreate = (width: number, height: number): Uint8Array => {
  const rowLength = Math.ceil(width / 8)
  const scanlines = new Uint8Array(height * (rowLength + 1))
  return pngCreate({ compressedData: deflateSync(scanlines), height, width, bitDepth: 1 })
}

const gifDimensionsCreate = (input: {
  readonly canvasHeight: number
  readonly canvasWidth: number
  readonly frameHeight: number
  readonly frameWidth: number
  readonly frameX?: number
  readonly frameY?: number
}): Uint8Array => {
  const body = gif.slice()
  uint16LittleEndianWrite(body, 6, input.canvasWidth)
  uint16LittleEndianWrite(body, 8, input.canvasHeight)
  const imageDescriptor = body.findIndex((byte, index) => byte === 0x2c && index > 13)
  if (imageDescriptor < 0) throw new Error("The GIF fixture has no image descriptor.")
  uint16LittleEndianWrite(body, imageDescriptor + 1, input.frameX ?? 0)
  uint16LittleEndianWrite(body, imageDescriptor + 3, input.frameY ?? 0)
  uint16LittleEndianWrite(body, imageDescriptor + 5, input.frameWidth)
  uint16LittleEndianWrite(body, imageDescriptor + 7, input.frameHeight)
  return body
}

const webpVp8DimensionsCreate = (width: number, height: number): Uint8Array => {
  const body = webp.slice()
  uint16LittleEndianWrite(body, 26, width)
  uint16LittleEndianWrite(body, 28, height)
  return body
}

const animatedWebpDimensionsCreate = (input: {
  readonly canvasHeight: number
  readonly canvasWidth: number
  readonly frameHeight: number
  readonly frameIndex?: 0 | 1
  readonly frameWidth: number
  readonly frameX?: number
  readonly frameY?: number
}): Uint8Array => {
  const body = animatedWebp.slice()
  const frameIndex = input.frameIndex ?? 0
  const frameOffset = frameIndex === 0 ? 52 : 132
  const imageDataOffset = frameIndex === 0 ? 76 : 156
  uint24LittleEndianWrite(body, 24, input.canvasWidth - 1)
  uint24LittleEndianWrite(body, 27, input.canvasHeight - 1)
  uint24LittleEndianWrite(body, frameOffset, (input.frameX ?? 0) / 2)
  uint24LittleEndianWrite(body, frameOffset + 3, (input.frameY ?? 0) / 2)
  uint24LittleEndianWrite(body, frameOffset + 6, input.frameWidth - 1)
  uint24LittleEndianWrite(body, frameOffset + 9, input.frameHeight - 1)
  uint16LittleEndianWrite(body, imageDataOffset + 6, input.frameWidth)
  uint16LittleEndianWrite(body, imageDataOffset + 8, input.frameHeight)
  return body
}

const uint16LittleEndianWrite = (body: Uint8Array, offset: number, value: number): void => {
  body[offset] = value & 0xff
  body[offset + 1] = value >>> 8
}

const uint24LittleEndianWrite = (body: Uint8Array, offset: number, value: number): void => {
  body[offset] = value & 0xff
  body[offset + 1] = (value >>> 8) & 0xff
  body[offset + 2] = (value >>> 16) & 0xff
}

const uint32BigEndianWrite = (body: Uint8Array, offset: number, value: number): void => {
  body[offset] = (value >>> 24) & 0xff
  body[offset + 1] = (value >>> 16) & 0xff
  body[offset + 2] = (value >>> 8) & 0xff
  body[offset + 3] = value & 0xff
}

const pngCrc32 = (body: Uint8Array, offset: number, length: number): number => {
  let crc = 0xffffffff
  for (let index = 0; index < length; index += 1) {
    crc ^= body[offset + index]!
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

test("profile picture validation accepts structurally valid GIF, JPEG, PNG, and WebP images", () => {
  const formats = [
    { body: jpeg, contentType: "image/jpeg", extension: "jpg" },
    { body: png, contentType: "image/png", extension: "png" },
    { body: webp, contentType: "image/webp", extension: "webp" },
    { body: gif, contentType: "image/gif", extension: "gif" },
  ] as const

  for (const format of formats) {
    expect(userPictureValidate({ body: format.body, contentType: format.contentType })).toMatchObject({
      data: { contentType: format.contentType, extension: format.extension },
      success: true,
    })
  }
})

test("profile picture validation enforces dimensions from every supported image header", () => {
  const boundaryValid = [
    { body: jpegDimensionsCreate(maximumPicturePixelsPerSide, maximumPicturePixelsPerSide), contentType: "image/jpeg" },
    { body: pngDimensionsCreate(maximumPicturePixelsPerSide, maximumPicturePixelsPerSide), contentType: "image/png" },
    {
      body: webpVp8DimensionsCreate(maximumPicturePixelsPerSide, maximumPicturePixelsPerSide),
      contentType: "image/webp",
    },
    {
      body: gifDimensionsCreate({
        canvasHeight: maximumPicturePixelsPerSide,
        canvasWidth: maximumPicturePixelsPerSide,
        frameHeight: maximumPicturePixelsPerSide,
        frameWidth: maximumPicturePixelsPerSide,
      }),
      contentType: "image/gif",
    },
    {
      body: animatedWebpDimensionsCreate({
        canvasHeight: maximumPicturePixelsPerSide,
        canvasWidth: maximumPicturePixelsPerSide,
        frameHeight: maximumPicturePixelsPerSide,
        frameWidth: maximumPicturePixelsPerSide,
      }),
      contentType: "image/webp",
    },
  ] as const
  for (const fixture of boundaryValid) expect(userPictureValidate(fixture).success).toBe(true)

  const oversizedTinyCompressed = [
    { body: jpegDimensionsCreate(maximumPicturePixelsPerSide + 1, 1), contentType: "image/jpeg" },
    { body: pngDimensionsCreate(maximumPicturePixelsPerSide + 1, 1), contentType: "image/png" },
    { body: webpVp8DimensionsCreate(maximumPicturePixelsPerSide + 1, 1), contentType: "image/webp" },
    {
      body: gifDimensionsCreate({
        canvasHeight: 1,
        canvasWidth: maximumPicturePixelsPerSide + 1,
        frameHeight: 1,
        frameWidth: 1,
      }),
      contentType: "image/gif",
    },
    {
      body: animatedWebpDimensionsCreate({
        canvasHeight: 1,
        canvasWidth: maximumPicturePixelsPerSide + 1,
        frameHeight: 1,
        frameWidth: 1,
      }),
      contentType: "image/webp",
    },
  ] as const
  for (const fixture of oversizedTinyCompressed) expect(userPictureValidate(fixture).success).toBe(false)

  expect(
    userPictureValidate({
      body: animatedWebpDimensionsCreate({
        canvasHeight: maximumPicturePixelsPerSide,
        canvasWidth: maximumPicturePixelsPerSide,
        frameHeight: maximumPicturePixelsPerSide + 1,
        frameWidth: 1,
      }),
      contentType: "image/webp",
    }).success,
  ).toBe(false)
  expect(
    userPictureValidate({
      body: animatedWebpDimensionsCreate({
        canvasHeight: maximumPicturePixelsPerSide,
        canvasWidth: maximumPicturePixelsPerSide,
        frameHeight: maximumPicturePixelsPerSide,
        frameWidth: maximumPicturePixelsPerSide,
        frameX: 2,
      }),
      contentType: "image/webp",
    }).success,
  ).toBe(false)
  expect(
    userPictureValidate({
      body: gifDimensionsCreate({
        canvasHeight: maximumPicturePixelsPerSide,
        canvasWidth: maximumPicturePixelsPerSide,
        frameHeight: maximumPicturePixelsPerSide,
        frameWidth: maximumPicturePixelsPerSide,
        frameX: 1,
      }),
      contentType: "image/gif",
    }).success,
  ).toBe(false)
  expect(
    userPictureValidate({
      body: animatedWebpDimensionsCreate({
        canvasHeight: maximumPicturePixelsPerSide,
        canvasWidth: maximumPicturePixelsPerSide,
        frameHeight: maximumPicturePixelsPerSide + 1,
        frameIndex: 1,
        frameWidth: 1,
      }),
      contentType: "image/webp",
    }).success,
  ).toBe(false)
})

test("profile picture validation accepts valid animation and rejects malformed ANMF frame fixtures", () => {
  expect(userPictureValidate({ body: animatedWebp, contentType: "image/webp" }).success).toBe(true)

  const missingImage = animatedWebpFirstFrameCreate(webpChunkCreate("JUNK", new Uint8Array([0])))
  const truncatedImage = animatedWebpFirstFrameCreate(webpChunkCreate("VP8 ", animatedWebp.subarray(76, 87)))
  const invalidFlagsHeader = animatedWebp.slice(52, 68)
  invalidFlagsHeader[15] = 0x04
  const invalidFlags = animatedWebpFirstFrameCreate(webpBytesConcat(invalidFlagsHeader, animatedWebp.subarray(68, 124)))
  const outOfBoundsHeader = animatedWebp.slice(52, 68)
  outOfBoundsHeader[6] = 1
  const outOfBounds = animatedWebpFirstFrameCreate(webpBytesConcat(outOfBoundsHeader, animatedWebp.subarray(68, 124)))
  const invalidPadding = webpBytesConcat(animatedWebp.subarray(68, 124), webpChunkCreate("JUNK", new Uint8Array([0])))
  invalidPadding[invalidPadding.length - 1] = 1
  const invalidPaddingFrame = animatedWebpFirstFrameCreate(invalidPadding)

  for (const body of [missingImage, truncatedImage, invalidFlags, outOfBounds, invalidPaddingFrame]) {
    expect(userPictureValidate({ body, contentType: "image/webp" }).success).toBe(false)
  }
})

test("profile picture validation accepts a valid image exactly at the 512 KiB boundary", () => {
  const body = new Uint8Array(512 * 1024)
  body.set(jpeg.subarray(0, jpeg.length - 2))
  body.set([0xff, 0xd9], body.length - 2)
  expect(userPictureValidate({ body, contentType: "image/jpeg" }).success).toBe(true)
})

test("profile picture PNG validation verifies zlib streams and exact non-interlaced and Adam7 scanlines", () => {
  const compressedData = deflateSync(Uint8Array.from([0, 0]))
  const validNonInterlaced = pngCreate({ compressedData })
  const validSplitIdat = pngCreate({
    compressedData,
    compressedDataChunks: [compressedData.subarray(0, 2), compressedData.subarray(2)],
  })
  const validAdam7 = pngCreate({ compressedData: deflateSync(Uint8Array.from([0, 0])), interlace: 1 })
  expect(userPictureValidate({ body: validNonInterlaced, contentType: "image/png" }).success).toBe(true)
  expect(userPictureValidate({ body: validSplitIdat, contentType: "image/png" }).success).toBe(true)
  expect(userPictureValidate({ body: validAdam7, contentType: "image/png" }).success).toBe(true)

  const badChecksum = compressedData.slice()
  badChecksum[badChecksum.length - 1] = (badChecksum[badChecksum.length - 1] ?? 0) ^ 0x01
  const malformed = [
    pngCreate({ compressedData: new Uint8Array() }),
    pngCreate({ compressedData: Uint8Array.from([1, 2, 3, 4]) }),
    pngCreate({ compressedData: badChecksum }),
    pngCreate({ compressedData: pngBytesConcat(compressedData, Uint8Array.from([0])) }),
    pngCreate({ compressedData: deflateSync(Uint8Array.from([5, 0])) }),
    pngCreate({ compressedData: deflateSync(Uint8Array.from([0])) }),
    pngCreate({ compressedData: deflateSync(Uint8Array.from([0, 0, 0])) }),
  ]
  for (const body of malformed) expect(userPictureValidate({ body, contentType: "image/png" }).success).toBe(false)
})

test("profile picture PNG validation rejects illegal IHDR combinations", () => {
  const invalidHeaders = [
    { bitDepth: 16, colorType: 3 },
    { bitDepth: 8, colorType: 1 },
    { bitDepth: 1, colorType: 2 },
  ]
  for (const header of invalidHeaders) {
    const body = pngCreate({ ...header, compressedData: deflateSync(Uint8Array.from([0, 0])) })
    expect(userPictureValidate({ body, contentType: "image/png" }).success).toBe(false)
  }
})

test("profile picture validation rejects empty, oversized, malformed, unsupported, and mismatched bytes", () => {
  expect(userPictureValidate({ body: new Uint8Array(), contentType: "image/png" }).success).toBe(false)
  expect(userPictureValidate({ body: new Uint8Array(512 * 1024 + 1), contentType: "image/png" }).success).toBe(false)
  expect(userPictureValidate({ body: Uint8Array.from([1, 2, 3]), contentType: "image/png" }).success).toBe(false)
  expect(userPictureValidate({ body: Uint8Array.from([1, 2, 3]), contentType: "image/bmp" }).success).toBe(false)
  expect(
    userPictureValidate({ body: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]), contentType: "image/jpeg" }).success,
  ).toBe(false)
  expect(userPictureValidate({ body: jpeg.subarray(0, jpeg.length - 2), contentType: "image/jpeg" }).success).toBe(
    false,
  )
  expect(userPictureValidate({ body: png.subarray(0, png.length - 12), contentType: "image/png" }).success).toBe(false)
  expect(userPictureValidate({ body: webp.subarray(0, webp.length - 1), contentType: "image/webp" }).success).toBe(
    false,
  )
  expect(userPictureValidate({ body: gif.subarray(0, gif.length - 1), contentType: "image/gif" }).success).toBe(false)
  const corruptedPng = png.slice()
  corruptedPng[corruptedPng.length - 1] = (corruptedPng[corruptedPng.length - 1] ?? 0) ^ 0x01
  expect(userPictureValidate({ body: corruptedPng, contentType: "image/png" }).success).toBe(false)
})

test("profile picture hashing and naming are deterministic and normalize the current username", () => {
  const hash = userPictureHashCreate(new TextEncoder().encode("hello"))
  expect(hash).toEqual({
    data: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    success: true,
  })
  if (!hash.success) return
  expect(
    userPictureObjectKeyCreate({
      extension: "jpg",
      generation: "0123456789abcdef0123456789abcdef",
      sha256: hash.data,
      userName: "  Alice  ",
    }),
  ).toEqual({
    data: "user-pictures/alice_0123456789abcdef0123456789abcdef_2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824.jpg",
    success: true,
  })
})

test("profile picture hosting validates, hashes, names, uploads, and returns the public asset", async () => {
  const body = webp
  const uploads: { body: Uint8Array; cacheControl: string; contentType: string; key: string }[] = []
  let randomByte = 0x10
  const runtime = runtimeCreate({
    randomBytes: (length) => {
      const bytes = new Uint8Array(length)
      bytes.fill(randomByte)
      randomByte += 1
      return bytes
    },
  })
  const host = () =>
    userProfilePictureHost({
      body,
      contentType: "image/webp",
      publicOrigin: "https://assets.authworks.contentoren.de",
      runtime,
      storage: {
        delete: async () => ({ data: undefined, success: true }),
        put: async (input) => {
          uploads.push(input)
          return resultCreate(undefined)
        },
      },
      userName: "Alice",
    })
  const hosted = await host()

  expect(hosted).toEqual({
    data: {
      contentType: "image/webp",
      objectKey:
        "user-pictures/alice_10101010101010101010101010101010_a8e1378cd74e08b2553bf313f676885cc7a6d590cfe79ca1b5f9d49215b5efa3.webp",
      url: "https://assets.authworks.contentoren.de/user-pictures/alice_10101010101010101010101010101010_a8e1378cd74e08b2553bf313f676885cc7a6d590cfe79ca1b5f9d49215b5efa3.webp",
    },
    success: true,
  })
  const hostedAgain = await host()
  expect(hostedAgain.success).toBe(true)
  if (!hostedAgain.success) return
  if (!hosted.success) return
  expect(hostedAgain.data.objectKey).not.toBe(hosted.data.objectKey)
  expect(hostedAgain.data.objectKey).toMatch(
    /^user-pictures\/alice_[0-9a-f]{32}_a8e1378cd74e08b2553bf313f676885cc7a6d590cfe79ca1b5f9d49215b5efa3\.webp$/,
  )
  expect(uploads).toHaveLength(2)
  expect(uploads[0]).toMatchObject({
    cacheControl: "public, max-age=31536000, immutable",
    contentType: "image/webp",
    key: "user-pictures/alice_10101010101010101010101010101010_a8e1378cd74e08b2553bf313f676885cc7a6d590cfe79ca1b5f9d49215b5efa3.webp",
  })
  expect(uploads[1]).toMatchObject({
    key: "user-pictures/alice_11111111111111111111111111111111_a8e1378cd74e08b2553bf313f676885cc7a6d590cfe79ca1b5f9d49215b5efa3.webp",
  })
})
