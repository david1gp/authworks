import { accessSync, constants, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createResult, createResultError, type Result } from "#result"

type E2eStateDirEnvironment = Readonly<Record<string, string | undefined>>

const sharedStateDir = "/tmp/opencode/authworks/e2e"

export function e2eStateDirResolve(environment: E2eStateDirEnvironment = process.env): Result<string> {
  const op = "e2eStateDirResolve"
  const override = environment.AUTHWORKS_E2E_STATE_DIR
  if (override !== undefined && override !== "") return createResult(override)
  if (e2eStateDirUsable(sharedStateDir)) return createResult(sharedStateDir)
  const fallback = join(tmpdir(), `${e2eStateDirUserName(environment)}-opencode`, "authworks", "e2e")
  if (!e2eStateDirUsable(fallback))
    return createResultError(
      op,
      `Cannot create a writable E2E state directory at ${fallback}. Set AUTHWORKS_E2E_STATE_DIR.`,
    )
  return createResult(fallback)
}

function e2eStateDirUsable(path: string): boolean {
  try {
    mkdirSync(path, { recursive: true })
    accessSync(path, constants.W_OK)
    return true
  } catch {
    return false
  }
}

function e2eStateDirUserName(environment: E2eStateDirEnvironment): string {
  const raw = environment.USER ?? environment.LOGNAME ?? e2eStateDirOsUserName()
  const sanitized = raw.toLowerCase().replace(/[^a-z0-9-]/g, "-")
  return sanitized === "" ? "unknown" : sanitized
}

function e2eStateDirOsUserName(): string {
  try {
    return process.getuid === undefined ? "unknown" : `uid${process.getuid()}`
  } catch {
    return "unknown"
  }
}
