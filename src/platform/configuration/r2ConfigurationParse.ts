import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"
import type { R2Configuration } from "./r2ConfigurationSchema.js"
import { r2ConfigurationSchema } from "./r2ConfigurationSchema.js"

const r2EnvironmentNames = [
  "AUTHWORKS_R2_ACCOUNT_ID",
  "AUTHWORKS_R2_ACCESS_KEY_ID",
  "AUTHWORKS_R2_SECRET_ACCESS_KEY",
  "AUTHWORKS_R2_BUCKET_NAME",
  "AUTHWORKS_R2_PUBLIC_BASE_URL",
] as const

export function r2ConfigurationParse(
  input: Readonly<Record<string, string | undefined>>,
): Result<R2Configuration | undefined> {
  const op = "r2ConfigurationParse"
  const hasConfiguration = r2EnvironmentNames.some((name) => input[name] !== undefined)
  if (!hasConfiguration) return resultCreate(undefined)

  const accountId = r2ValueRequired(input.AUTHWORKS_R2_ACCOUNT_ID, "AUTHWORKS_R2_ACCOUNT_ID")
  if (!accountId.success) return accountId
  const accessKeyId = r2ValueRequired(input.AUTHWORKS_R2_ACCESS_KEY_ID, "AUTHWORKS_R2_ACCESS_KEY_ID")
  if (!accessKeyId.success) return accessKeyId
  const secretAccessKey = r2ValueRequired(input.AUTHWORKS_R2_SECRET_ACCESS_KEY, "AUTHWORKS_R2_SECRET_ACCESS_KEY")
  if (!secretAccessKey.success) return secretAccessKey
  const bucket = r2ValueRequired(input.AUTHWORKS_R2_BUCKET_NAME, "AUTHWORKS_R2_BUCKET_NAME")
  if (!bucket.success) return bucket
  const publicOrigin = r2ValueRequired(input.AUTHWORKS_R2_PUBLIC_BASE_URL, "AUTHWORKS_R2_PUBLIC_BASE_URL")
  if (!publicOrigin.success) return publicOrigin

  const normalizedPublicOrigin = r2PublicOriginNormalize(publicOrigin.data)
  if (!normalizedPublicOrigin.success) return normalizedPublicOrigin
  const parsed = v.safeParse(r2ConfigurationSchema, {
    accessKeyId: accessKeyId.data,
    accountId: accountId.data,
    bucket: bucket.data,
    endpoint: `https://${accountId.data}.r2.cloudflarestorage.com`,
    publicOrigin: normalizedPublicOrigin.data,
    secretAccessKey: secretAccessKey.data,
  })
  if (!parsed.success) return resultErrorCreate(op, "R2 configuration is invalid.")
  return resultCreate(parsed.output)
}

function r2ValueRequired(value: string | undefined, name: string): Result<string> {
  if (value === undefined || value.trim().length === 0)
    return resultErrorCreate("r2ConfigurationParse", `R2 configuration is missing: ${name}.`)
  return resultCreate(value.trim())
}

function r2PublicOriginNormalize(value: string): Result<string> {
  const op = "r2ConfigurationParse"
  if (!URL.canParse(value)) return resultErrorCreate(op, "R2 configuration is invalid.")
  const url = new URL(value)
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "")
    return resultErrorCreate(op, "R2 configuration is invalid.")
  const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "")
  return resultCreate(`${url.origin}${pathname}`)
}
