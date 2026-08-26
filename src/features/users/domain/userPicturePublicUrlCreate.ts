import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export function userPicturePublicUrlCreate(input: {
  readonly objectKey: string
  readonly publicOrigin: string
}): Result<string> {
  const op = "userPicturePublicUrlCreate"
  if (
    input.objectKey.length === 0 ||
    input.objectKey.startsWith("/") ||
    input.objectKey.includes("\\") ||
    /[?#\r\n]/.test(input.objectKey)
  )
    return resultErrorCreate(op, "The user picture key is invalid.")
  if (input.objectKey.split("/").some((segment) => segment.length === 0))
    return resultErrorCreate(op, "The user picture key is invalid.")

  let origin: URL
  try {
    origin = new URL(input.publicOrigin)
  } catch (_error) {
    return resultErrorCreate(op, "The user picture public origin is invalid.")
  }
  if (
    origin.protocol !== "https:" ||
    origin.username !== "" ||
    origin.password !== "" ||
    origin.search !== "" ||
    origin.hash !== ""
  )
    return resultErrorCreate(op, "The user picture public origin is invalid.")
  const originPath = origin.pathname === "/" ? "" : origin.pathname.replace(/\/+$/, "")
  origin.pathname = `${originPath}/${input.objectKey.split("/").map(encodeURIComponent).join("/")}`
  return resultCreate(origin.toString())
}
