import { chmodSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { createResult, createResultError, type Result } from "#result"

export function e2eSecretFileWrite(path: string, secret: string): Result<void> {
  const op = "e2eSecretFileWrite"
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${secret}\n`, { encoding: "utf8", mode: 0o600 })
    chmodSync(path, 0o600)
    return createResult(undefined)
  } catch {
    return createResultError(op, `Cannot write the E2E secret file at ${path}.`)
  }
}
