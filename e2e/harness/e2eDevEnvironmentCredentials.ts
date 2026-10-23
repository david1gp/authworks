import * as v from "valibot"
import { createResult, createResultError, type Result } from "#result"

const envFileSchema = v.strictObject({
  memberPassword: v.pipe(v.string(), v.minLength(1)),
  servicePassword: v.pipe(v.string(), v.minLength(1)),
  systemSecret: v.pipe(v.string(), v.minLength(1)),
})

export type E2eDevEnvironmentCredentials = v.InferOutput<typeof envFileSchema>

export function e2eDevEnvironmentPasswordCreate(randomBytes: (length: number) => Uint8Array): string {
  const bytes = randomBytes(24)
  let binary = ""
  for (const byte of bytes) binary += String.fromCodePoint(byte)
  return Buffer.from(binary, "binary").toString("base64url")
}

export function e2eDevEnvironmentEnvFileParse(raw: string): Result<E2eDevEnvironmentCredentials> {
  const op = "e2eDevEnvironmentEnvFileParse"
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return createResultError(op, "The E2E dev environment file is invalid.")
  }
  const validated = v.safeParse(envFileSchema, parsed)
  if (!validated.success) return createResultError(op, "The E2E dev environment file is invalid.")
  return createResult(validated.output)
}

export function e2eDevEnvironmentEnvFileSerialize(credentials: E2eDevEnvironmentCredentials): string {
  return `${JSON.stringify(credentials, null, 2)}\n`
}
