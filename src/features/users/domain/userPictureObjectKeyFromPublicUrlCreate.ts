import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { userNameNormalize } from "./userNameNormalize.js"

export function userPictureObjectKeyFromPublicUrlCreate(input: {
  readonly publicOrigin: string
  readonly url: string
  readonly userName: string
}): Result<string | undefined> {
  const op = "userPictureObjectKeyFromPublicUrlCreate"
  const userName = userNameNormalize(input.userName)
  if (!userName.success) return userName
  let publicOrigin: URL
  let pictureUrl: URL
  try {
    publicOrigin = new URL(input.publicOrigin)
    pictureUrl = new URL(input.url)
  } catch (_error) {
    return resultErrorCreate(op, "The user picture public URL is invalid.")
  }
  if (
    publicOrigin.protocol !== "https:" ||
    publicOrigin.username !== "" ||
    publicOrigin.password !== "" ||
    publicOrigin.search !== "" ||
    publicOrigin.hash !== ""
  )
    return resultErrorCreate(op, "The user picture public origin is invalid.")
  if (
    pictureUrl.protocol !== "https:" ||
    pictureUrl.origin !== publicOrigin.origin ||
    pictureUrl.username !== "" ||
    pictureUrl.password !== "" ||
    pictureUrl.search !== "" ||
    pictureUrl.hash !== ""
  )
    return resultCreate(undefined)

  const originPath = publicOrigin.pathname === "/" ? "" : publicOrigin.pathname.replace(/\/+$/, "")
  const namespace = `${originPath}/user-pictures/`
  if (!pictureUrl.pathname.startsWith(namespace)) return resultCreate(undefined)
  const encodedKey = pictureUrl.pathname.slice(originPath.length + 1)
  const keySegments = encodedKey.split("/")
  if (keySegments.length !== 2 || keySegments[0] !== "user-pictures") return resultCreate(undefined)

  let key: string
  try {
    key = keySegments.map((segment) => decodeURIComponent(segment)).join("/")
  } catch (_error) {
    return resultCreate(undefined)
  }
  if (!userPictureObjectKeyExpected(key)) return resultCreate(undefined)
  const userPrefix = `user-pictures/${userName.data}_`
  if (
    !key.startsWith(userPrefix) ||
    !/^[0-9a-f]{32}_[0-9a-f]{64}\.(gif|jpg|png|webp)$/.test(key.slice(userPrefix.length))
  )
    return resultErrorCreate(op, "The user picture does not belong to this user.")
  return resultCreate(key)
}

function userPictureObjectKeyExpected(key: string): boolean {
  if (key.startsWith("/") || key.includes("\\") || /[?#\r\n]/.test(key)) return false
  if (!/^user-pictures\/[^/]+_[0-9a-f]{32}_[0-9a-f]{64}\.(gif|jpg|png|webp)$/.test(key)) return false
  return key.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
}
