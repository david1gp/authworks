import { inflateSync } from "node:zlib"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { userPictureConstraints } from "../public/userPictureConstraints.js"

const maximumPictureBytes = userPictureConstraints.maximumBytes
const maximumPicturePixels = userPictureConstraints.maximumPixels
const maximumPicturePixelsPerSide = userPictureConstraints.maximumPixelsPerSide

type UserPictureWebpChunk = {
  readonly dataLength: number
  readonly dataStart: number
  readonly paddedEnd: number
  readonly type: string
}

type UserPictureImageDimensions = {
  readonly height: number
  readonly width: number
}

type UserPicturePngAdam7Pass = {
  readonly xStart: number
  readonly xStep: number
  readonly yStart: number
  readonly yStep: number
}

type UserPicturePngHeader = UserPictureImageDimensions & {
  readonly bitDepth: number
  readonly colorType: number
  readonly interlace: number
}

type UserPictureWebpExtendedHeader = UserPictureImageDimensions & {
  readonly animation: boolean
}

const userPicturePngAdam7Passes: readonly UserPicturePngAdam7Pass[] = [
  { xStart: 0, xStep: 8, yStart: 0, yStep: 8 },
  { xStart: 4, xStep: 8, yStart: 0, yStep: 8 },
  { xStart: 0, xStep: 4, yStart: 4, yStep: 8 },
  { xStart: 2, xStep: 4, yStart: 0, yStep: 4 },
  { xStart: 0, xStep: 2, yStart: 2, yStep: 4 },
  { xStart: 1, xStep: 2, yStart: 0, yStep: 2 },
  { xStart: 0, xStep: 1, yStart: 1, yStep: 2 },
]

export function userPictureValidate(input: { readonly body: Uint8Array; readonly contentType: string }): Result<{
  contentType: "image/gif" | "image/jpeg" | "image/png" | "image/webp"
  extension: "gif" | "jpg" | "png" | "webp"
}> {
  const op = "userPictureValidate"
  if (!(input.body instanceof Uint8Array) || input.body.length === 0)
    return resultErrorCreate(op, "The user picture must not be empty.")
  if (input.body.length > maximumPictureBytes) return resultErrorCreate(op, "The user picture must not exceed 512 KiB.")

  const contentType = input.contentType.trim().toLowerCase()
  const format = userPictureFormatResolve(contentType)
  if (format === undefined) return resultErrorCreate(op, "The user picture format is not supported.")
  if (!userPictureStructureValid(input.body, contentType))
    return resultErrorCreate(op, "The user picture bytes do not match its content type.")
  return resultCreate(format)
}

function userPictureFormatResolve(
  contentType: string,
):
  | { contentType: "image/gif" | "image/jpeg" | "image/png" | "image/webp"; extension: "gif" | "jpg" | "png" | "webp" }
  | undefined {
  if (contentType === "image/gif") return { contentType, extension: "gif" }
  if (contentType === "image/jpeg") return { contentType, extension: "jpg" }
  if (contentType === "image/png") return { contentType, extension: "png" }
  if (contentType === "image/webp") return { contentType, extension: "webp" }
  return undefined
}

function userPictureStructureValid(body: Uint8Array, contentType: string): boolean {
  if (contentType === "image/jpeg") return userPictureJpegStructureValid(body)
  if (contentType === "image/png") return userPicturePngStructureValid(body)
  if (contentType === "image/webp") return userPictureWebpStructureValid(body)
  return userPictureGifStructureValid(body)
}

function userPictureJpegStructureValid(body: Uint8Array): boolean {
  if (body.length < 4 || body[0] !== 0xff || body[1] !== 0xd8) return false
  let offset = 2
  let frameFound = false
  let frameDimensions: UserPictureImageDimensions | undefined
  let scanFound = false

  while (offset < body.length) {
    if (body[offset] !== 0xff) return false
    while (body[offset] === 0xff) offset += 1
    if (offset >= body.length) return false
    const marker = body[offset]!
    offset += 1
    if (marker === 0xd9) return frameFound && scanFound && offset === body.length
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > body.length) return false
    const segmentLength = userPictureUint16Read(body, offset)
    if (segmentLength < 2 || segmentLength > body.length - offset) return false
    const segmentStart = offset + 2
    const segmentEnd = offset + segmentLength

    if (userPictureJpegFrameMarker(marker)) {
      if (segmentLength < 8 || body[segmentStart] === 0) return false
      const components = body[segmentStart + 5]!
      if (components === 0 || segmentLength < 8 + components * 3) return false
      const height = userPictureUint16Read(body, segmentStart + 1)
      const width = userPictureUint16Read(body, segmentStart + 3)
      const dimensions = { height, width }
      if (!userPictureImageDimensionsValid(dimensions)) return false
      if (
        frameDimensions !== undefined &&
        (frameDimensions.width !== dimensions.width || frameDimensions.height !== dimensions.height)
      )
        return false
      frameDimensions = dimensions
      frameFound = true
    }

    if (marker === 0xda) {
      if (!userPictureJpegScanValid(body, segmentStart, segmentLength)) return false
      offset = segmentEnd
      scanFound = true
      let entropyBytes = 0
      while (offset < body.length) {
        if (body[offset] !== 0xff) {
          offset += 1
          entropyBytes += 1
          continue
        }
        if (offset + 1 >= body.length) return false
        const next = body[offset + 1]!
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
          offset += 2
          entropyBytes += 1
          continue
        }
        if (next === 0xff) {
          offset += 1
          continue
        }
        if (next === 0xd9) {
          return frameFound && entropyBytes > 0 && offset + 2 === body.length
        }
        break
      }
      if (entropyBytes === 0 || offset >= body.length) return false
      continue
    }

    offset = segmentEnd
  }
  return false
}

function userPictureJpegFrameMarker(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  )
}

function userPictureJpegScanValid(body: Uint8Array, segmentStart: number, segmentLength: number): boolean {
  const dataLength = segmentLength - 2
  if (dataLength < 4) return false
  const components = body[segmentStart]!
  if (components === 0 || components > 4 || dataLength < 4 + components * 2) return false
  const spectralStart = segmentStart + 1 + components * 2
  const spectralSelection = body[spectralStart]!
  const spectralEnd = body[spectralStart + 1]!
  const successive = body[spectralStart + 2]!
  return (
    spectralSelection <= spectralEnd &&
    spectralSelection <= 63 &&
    spectralEnd <= 63 &&
    successive >> 4 <= 13 &&
    (successive & 0x0f) <= 13
  )
}

function userPicturePngStructureValid(body: Uint8Array): boolean {
  if (body.length < 8 || !userPictureBytesEqual(body, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return false
  let offset = 8
  let header: UserPicturePngHeader | undefined
  let dataFound = false
  let dataGroupClosed = false
  let paletteFound = false
  const dataChunks: Uint8Array[] = []

  while (offset < body.length) {
    if (offset + 12 > body.length) return false
    const dataLength = userPictureUint32Read(body, offset)
    if (dataLength > body.length - offset - 12) return false
    const typeStart = offset + 4
    const dataStart = offset + 8
    const chunkEnd = dataStart + dataLength
    if (!userPicturePngChunkTypeValid(body, typeStart)) return false
    if (userPictureUint32Read(body, chunkEnd) !== userPictureCrc32(body, typeStart, 4 + dataLength)) return false

    const type = userPictureAsciiRead(body, typeStart, 4)
    if (header === undefined && type !== "IHDR") return false
    if (type !== "IDAT" && dataFound) dataGroupClosed = true
    if (type === "IHDR") {
      if (header !== undefined || dataLength !== 13) return false
      header = userPicturePngHeaderRead(body, dataStart)
      if (header === undefined) return false
    } else if (type === "PLTE") {
      if (header === undefined || paletteFound || dataFound || !userPicturePngPaletteValid(header, dataLength))
        return false
      paletteFound = true
    }
    if (type === "IDAT") {
      if (header === undefined || dataGroupClosed) return false
      dataChunks.push(body.subarray(dataStart, chunkEnd))
      dataFound = true
    }
    if (type === "IEND") {
      if (dataLength !== 0 || header === undefined || !dataFound || chunkEnd + 4 !== body.length) return false
      if (header.colorType === 3 && !paletteFound) return false
      return userPicturePngImageDataValid(header, dataChunks)
    }
    if (type !== "IHDR" && type !== "PLTE" && type !== "IDAT" && type !== "IEND" && type.charCodeAt(0) <= 0x5a)
      return false
    offset = chunkEnd + 4
  }
  return false
}

function userPicturePngChunkTypeValid(body: Uint8Array, offset: number): boolean {
  for (let index = 0; index < 4; index += 1) {
    const byte = body[offset + index]!
    if (!((byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a))) return false
  }
  return body[offset + 2]! <= 0x5a
}

function userPicturePngHeaderRead(body: Uint8Array, offset: number): UserPicturePngHeader | undefined {
  const dimensions = {
    height: userPictureUint32Read(body, offset + 4),
    width: userPictureUint32Read(body, offset),
  }
  if (!userPictureImageDimensionsValid(dimensions)) return undefined
  const bitDepth = body[offset + 8]!
  const colorType = body[offset + 9]!
  const compression = body[offset + 10]!
  const filter = body[offset + 11]!
  const interlace = body[offset + 12]!
  if (compression !== 0 || filter !== 0 || (interlace !== 0 && interlace !== 1)) return undefined
  if (colorType === 0 && bitDepth !== 1 && bitDepth !== 2 && bitDepth !== 4 && bitDepth !== 8 && bitDepth !== 16)
    return undefined
  if ((colorType === 2 || colorType === 4 || colorType === 6) && bitDepth !== 8 && bitDepth !== 16) return undefined
  if (colorType === 3 && bitDepth !== 1 && bitDepth !== 2 && bitDepth !== 4 && bitDepth !== 8) return undefined
  if (colorType !== 0 && colorType !== 2 && colorType !== 3 && colorType !== 4 && colorType !== 6) return undefined
  return { ...dimensions, bitDepth, colorType, interlace }
}

function userPicturePngPaletteValid(header: UserPicturePngHeader, length: number): boolean {
  if (header.colorType === 0 || header.colorType === 4 || length < 3 || length > 768 || length % 3 !== 0) return false
  return header.colorType !== 3 || length / 3 <= 2 ** header.bitDepth
}

function userPicturePngImageDataValid(header: UserPicturePngHeader, chunks: readonly Uint8Array[]): boolean {
  const expectedLength = userPicturePngScanlineLengthExpected(header)
  if (expectedLength === undefined) return false
  const compressedLength = chunks.reduce((length, chunk) => length + chunk.length, 0)
  const compressed = new Uint8Array(compressedLength)
  let compressedOffset = 0
  for (const chunk of chunks) {
    compressed.set(chunk, compressedOffset)
    compressedOffset += chunk.length
  }

  try {
    const inflated = inflateSync(compressed, { info: true, maxOutputLength: expectedLength }) as unknown as {
      readonly buffer: Uint8Array
      readonly engine: { readonly bytesRead: number }
    }
    if (inflated.buffer.length !== expectedLength || inflated.engine.bytesRead !== compressed.length) return false
    return userPicturePngScanlinesValid(header, inflated.buffer)
  } catch (_error) {
    return false
  }
}

function userPicturePngScanlineLengthExpected(header: UserPicturePngHeader): number | undefined {
  const passes = header.interlace === 0 ? [{ xStart: 0, xStep: 1, yStart: 0, yStep: 1 }] : userPicturePngAdam7Passes
  let expectedLength = 0
  for (const pass of passes) {
    const width = userPicturePngPassDimension(header.width, pass.xStart, pass.xStep)
    const height = userPicturePngPassDimension(header.height, pass.yStart, pass.yStep)
    if (width === 0 || height === 0) continue
    const scanlineLength = userPicturePngRowDataLength(header, width) + 1
    const passLength = height * scanlineLength
    if (!Number.isSafeInteger(passLength) || expectedLength > Number.MAX_SAFE_INTEGER - passLength) return undefined
    expectedLength += passLength
  }
  return expectedLength
}

function userPicturePngScanlinesValid(header: UserPicturePngHeader, body: Uint8Array): boolean {
  const passes = header.interlace === 0 ? [{ xStart: 0, xStep: 1, yStart: 0, yStep: 1 }] : userPicturePngAdam7Passes
  let offset = 0
  for (const pass of passes) {
    const width = userPicturePngPassDimension(header.width, pass.xStart, pass.xStep)
    const height = userPicturePngPassDimension(header.height, pass.yStart, pass.yStep)
    if (width === 0 || height === 0) continue
    const scanlineLength = userPicturePngRowDataLength(header, width) + 1
    for (let row = 0; row < height; row += 1) {
      if (scanlineLength > body.length - offset || body[offset]! > 4) return false
      offset += scanlineLength
    }
  }
  return offset === body.length
}

function userPicturePngPassDimension(fullSize: number, start: number, step: number): number {
  if (fullSize <= start) return 0
  return Math.floor((fullSize - start + step - 1) / step)
}

function userPicturePngRowDataLength(header: UserPicturePngHeader, width: number): number {
  const channels =
    header.colorType === 0 || header.colorType === 3 ? 1 : header.colorType === 2 ? 3 : header.colorType === 4 ? 2 : 4
  return Math.ceil((width * channels * header.bitDepth) / 8)
}

function userPictureWebpStructureValid(body: Uint8Array): boolean {
  if (body.length < 20 || userPictureAsciiRead(body, 0, 4) !== "RIFF" || userPictureAsciiRead(body, 8, 4) !== "WEBP")
    return false
  if (userPictureUint32ReadLittleEndian(body, 4) !== body.length - 8) return false
  let offset = 12
  let imageDataFound = false
  let rootImageDimensions: UserPictureImageDimensions | undefined
  let extendedHeader: UserPictureWebpExtendedHeader | undefined
  let animationChunkFound = false
  let frameFound = false

  while (offset < body.length) {
    const chunk = userPictureWebpChunkRead(body, offset, body.length)
    if (chunk === undefined) return false
    const { type, dataStart, dataLength } = chunk

    if (type === "VP8 ") {
      if (frameFound || rootImageDimensions !== undefined) return false
      const dimensions = userPictureWebpVp8DimensionsRead(body, dataStart, dataLength)
      if (dimensions === undefined) return false
      rootImageDimensions = dimensions
      imageDataFound = true
    }
    if (type === "VP8L") {
      if (frameFound || rootImageDimensions !== undefined) return false
      const dimensions = userPictureWebpVp8lDimensionsRead(body, dataStart, dataLength)
      if (dimensions === undefined) return false
      rootImageDimensions = dimensions
      imageDataFound = true
    }
    if (type === "VP8X") {
      if (offset !== 12 || extendedHeader !== undefined) return false
      const header = userPictureWebpVp8xRead(body, dataStart, dataLength)
      if (header === undefined) return false
      extendedHeader = header
    }
    if (type === "ANIM") {
      if (animationChunkFound || dataLength !== 6) return false
      animationChunkFound = true
    }
    if (type === "ANMF") {
      if (extendedHeader?.animation !== true || !animationChunkFound || rootImageDimensions !== undefined) return false
      if (!userPictureWebpAnmfValid(body, dataStart, dataLength, extendedHeader.width, extendedHeader.height))
        return false
      frameFound = true
      imageDataFound = true
    }
    offset = chunk.paddedEnd
  }
  if (offset !== body.length || !imageDataFound) return false
  if (extendedHeader === undefined) return rootImageDimensions !== undefined && !frameFound && !animationChunkFound
  if (extendedHeader.animation) return animationChunkFound && frameFound && rootImageDimensions === undefined
  return (
    rootImageDimensions !== undefined &&
    rootImageDimensions.width === extendedHeader.width &&
    rootImageDimensions.height === extendedHeader.height &&
    !frameFound
  )
}

function userPictureWebpChunkTypeValid(type: string): boolean {
  return [...type].every((character) => {
    const code = character.charCodeAt(0)
    return code >= 0x20 && code <= 0x7e
  })
}

function userPictureWebpChunkRead(body: Uint8Array, offset: number, limit: number): UserPictureWebpChunk | undefined {
  if (offset > limit || limit - offset < 8) return undefined
  const type = userPictureAsciiRead(body, offset, 4)
  const dataLength = userPictureUint32ReadLittleEndian(body, offset + 4)
  const dataStart = offset + 8
  if (dataLength > limit - dataStart) return undefined
  const chunkEnd = dataStart + dataLength
  const paddedEnd = chunkEnd + (dataLength % 2)
  if (paddedEnd > limit || (dataLength % 2 === 1 && body[chunkEnd] !== 0)) return undefined
  if (!userPictureWebpChunkTypeValid(type)) return undefined
  return { dataLength, dataStart, paddedEnd, type }
}

function userPictureWebpAnmfValid(
  body: Uint8Array,
  offset: number,
  length: number,
  canvasWidth: number,
  canvasHeight: number,
): boolean {
  if (length < 16) return false
  const frameEnd = offset + length
  const frameX = userPictureUint24ReadLittleEndian(body, offset) * 2
  const frameY = userPictureUint24ReadLittleEndian(body, offset + 3) * 2
  const frameWidth = userPictureUint24ReadLittleEndian(body, offset + 6) + 1
  const frameHeight = userPictureUint24ReadLittleEndian(body, offset + 9) + 1
  const flags = body[offset + 15]!
  if (flags & 0xfc) return false
  if (
    !userPictureImageDimensionsValid({ height: frameHeight, width: frameWidth }) ||
    !userPictureRectangleWithinCanvasValid({
      canvasHeight,
      canvasWidth,
      height: frameHeight,
      width: frameWidth,
      x: frameX,
      y: frameY,
    })
  )
    return false

  let innerOffset = offset + 16
  let alphaFound = false
  let imageFound = false
  while (innerOffset < frameEnd) {
    const chunk = userPictureWebpChunkRead(body, innerOffset, frameEnd)
    if (chunk === undefined) return false
    const { type, dataStart, dataLength } = chunk
    if (type === "ALPH") {
      if (alphaFound || imageFound || !userPictureWebpAlphValid(body, dataStart, dataLength, frameWidth, frameHeight))
        return false
      alphaFound = true
    }
    if (type === "VP8 " || type === "VP8L") {
      if (imageFound) return false
      const dimensions =
        type === "VP8 "
          ? userPictureWebpVp8DimensionsRead(body, dataStart, dataLength)
          : userPictureWebpVp8lDimensionsRead(body, dataStart, dataLength)
      if (dimensions === undefined || dimensions.width !== frameWidth || dimensions.height !== frameHeight) return false
      imageFound = true
    }
    if (type !== "ALPH" && type !== "VP8 " && type !== "VP8L" && !imageFound) return false
    innerOffset = chunk.paddedEnd
  }
  return innerOffset === frameEnd && imageFound
}

function userPictureWebpAlphValid(
  body: Uint8Array,
  offset: number,
  length: number,
  width: number,
  height: number,
): boolean {
  if (length < 2 || (body[offset]! & 0xc0) !== 0) return false
  if ((body[offset]! & 0x03) === 0) return length - 1 === width * height
  return true
}

function userPictureWebpVp8DimensionsRead(
  body: Uint8Array,
  offset: number,
  length: number,
): UserPictureImageDimensions | undefined {
  if (length < 11 || body[offset + 3]! !== 0x9d || body[offset + 4]! !== 0x01 || body[offset + 5]! !== 0x2a)
    return undefined
  const frameTag = userPictureUint24ReadLittleEndian(body, offset)
  const firstPartitionLength = frameTag >>> 5
  if (
    (frameTag & 0x01) !== 0 ||
    (frameTag & 0x10) === 0 ||
    firstPartitionLength < 7 ||
    firstPartitionLength >= length - 3
  )
    return undefined
  const width = userPictureUint16ReadLittleEndian(body, offset + 6) & 0x3fff
  const height = userPictureUint16ReadLittleEndian(body, offset + 8) & 0x3fff
  const dimensions = { height, width }
  return userPictureImageDimensionsValid(dimensions) ? dimensions : undefined
}

function userPictureWebpVp8lDimensionsRead(
  body: Uint8Array,
  offset: number,
  length: number,
): UserPictureImageDimensions | undefined {
  if (length < 6 || body[offset]! !== 0x2f) return undefined
  const header =
    (body[offset + 1]! | (body[offset + 2]! << 8) | (body[offset + 3]! << 16) | (body[offset + 4]! << 24)) >>> 0
  if (header >>> 29 !== 0) return undefined
  const width = 1 + (header & 0x3fff)
  const height = 1 + ((header >>> 14) & 0x3fff)
  const dimensions = { height, width }
  return userPictureImageDimensionsValid(dimensions) ? dimensions : undefined
}

function userPictureWebpVp8xRead(
  body: Uint8Array,
  offset: number,
  length: number,
): UserPictureWebpExtendedHeader | undefined {
  if (
    length !== 10 ||
    (body[offset]! & 0xc1) !== 0 ||
    body[offset + 1] !== 0 ||
    body[offset + 2] !== 0 ||
    body[offset + 3] !== 0
  )
    return undefined
  const width = 1 + userPictureUint24ReadLittleEndian(body, offset + 4)
  const height = 1 + userPictureUint24ReadLittleEndian(body, offset + 7)
  if (!userPictureImageDimensionsValid({ height, width })) return undefined
  return { animation: (body[offset]! & 0x02) !== 0, height, width }
}

function userPictureGifStructureValid(body: Uint8Array): boolean {
  if (
    body.length < 14 ||
    (userPictureAsciiRead(body, 0, 6) !== "GIF87a" && userPictureAsciiRead(body, 0, 6) !== "GIF89a")
  )
    return false
  const canvasWidth = userPictureUint16ReadLittleEndian(body, 6)
  const canvasHeight = userPictureUint16ReadLittleEndian(body, 8)
  if (!userPictureImageDimensionsValid({ height: canvasHeight, width: canvasWidth })) return false
  const screenPacked = body[10]!
  let offset = 13
  const globalColorTableFound = (screenPacked & 0x80) !== 0
  if (globalColorTableFound) {
    const colorTableEnd = offset + 3 * (2 << (screenPacked & 0x07))
    if (colorTableEnd > body.length) return false
    offset = colorTableEnd
  }
  let imageFound = false

  while (offset < body.length) {
    const block = body[offset]!
    offset += 1
    if (block === 0x3b) return imageFound && offset === body.length
    if (block === 0x2c) {
      if (offset + 9 > body.length) return false
      const frameX = userPictureUint16ReadLittleEndian(body, offset)
      const frameY = userPictureUint16ReadLittleEndian(body, offset + 2)
      const frameWidth = userPictureUint16ReadLittleEndian(body, offset + 4)
      const frameHeight = userPictureUint16ReadLittleEndian(body, offset + 6)
      if (
        !userPictureImageDimensionsValid({ height: frameHeight, width: frameWidth }) ||
        !userPictureRectangleWithinCanvasValid({
          canvasHeight,
          canvasWidth,
          height: frameHeight,
          width: frameWidth,
          x: frameX,
          y: frameY,
        })
      )
        return false
      const imagePacked = body[offset + 8]!
      const localColorTableFound = (imagePacked & 0x80) !== 0
      if (!globalColorTableFound && !localColorTableFound) return false
      offset += 9
      if (localColorTableFound) {
        const colorTableEnd = offset + 3 * (2 << (imagePacked & 0x07))
        if (colorTableEnd > body.length) return false
        offset = colorTableEnd
      }
      if (offset >= body.length || body[offset]! < 2 || body[offset]! > 8) return false
      offset += 1
      const dataEnd = userPictureGifSubBlocksEnd(body, offset, true)
      if (dataEnd === undefined) return false
      offset = dataEnd
      imageFound = true
      continue
    }
    if (block !== 0x21 || offset >= body.length) return false
    const extension = body[offset]!
    offset += 1
    if (extension === 0xf9) {
      if (offset + 6 > body.length || body[offset]! !== 4 || body[offset + 5]! !== 0) return false
      offset += 6
      continue
    }
    if (extension === 0x01 || extension === 0xff) {
      const blockSize = extension === 0x01 ? 12 : 11
      if (offset >= body.length || body[offset]! !== blockSize || offset + 1 + blockSize > body.length) return false
      offset += 1 + blockSize
    }
    const dataEnd = userPictureGifSubBlocksEnd(body, offset, false)
    if (dataEnd === undefined) return false
    offset = dataEnd
  }
  return false
}

function userPictureGifSubBlocksEnd(body: Uint8Array, start: number, requireData: boolean): number | undefined {
  let offset = start
  let dataFound = false
  while (offset < body.length) {
    const length = body[offset]!
    offset += 1
    if (length === 0) return !requireData || dataFound ? offset : undefined
    if (offset + length > body.length) return undefined
    offset += length
    dataFound = true
  }
  return undefined
}

function userPictureImageDimensionsValid(dimensions: UserPictureImageDimensions): boolean {
  const { height, width } = dimensions
  return (
    Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= maximumPicturePixelsPerSide &&
    height <= maximumPicturePixelsPerSide &&
    width <= maximumPicturePixels / height
  )
}

function userPictureRectangleWithinCanvasValid(input: {
  readonly canvasHeight: number
  readonly canvasWidth: number
  readonly height: number
  readonly width: number
  readonly x: number
  readonly y: number
}): boolean {
  return (
    Number.isSafeInteger(input.x) &&
    Number.isSafeInteger(input.y) &&
    input.x >= 0 &&
    input.y >= 0 &&
    input.x <= input.canvasWidth - input.width &&
    input.y <= input.canvasHeight - input.height
  )
}

function userPictureBytesEqual(body: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((byte, index) => body[offset + index]! === byte)
}

function userPictureAsciiRead(body: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...body.slice(offset, offset + length))
}

function userPictureUint16Read(body: Uint8Array, offset: number): number {
  return (body[offset]! << 8) | body[offset + 1]!
}

function userPictureUint16ReadLittleEndian(body: Uint8Array, offset: number): number {
  return body[offset]! | (body[offset + 1]! << 8)
}

function userPictureUint24ReadLittleEndian(body: Uint8Array, offset: number): number {
  return body[offset]! | (body[offset + 1]! << 8) | (body[offset + 2]! << 16)
}

function userPictureUint32Read(body: Uint8Array, offset: number): number {
  return body[offset]! * 0x1000000 + (body[offset + 1]! << 16) + (body[offset + 2]! << 8) + body[offset + 3]!
}

function userPictureUint32ReadLittleEndian(body: Uint8Array, offset: number): number {
  return body[offset]! + (body[offset + 1]! << 8) + (body[offset + 2]! << 16) + body[offset + 3]! * 0x1000000
}

function userPictureCrc32(body: Uint8Array, offset: number, length: number): number {
  let crc = 0xffffffff
  for (let index = 0; index < length; index += 1) {
    crc ^= body[offset + index]!
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
