import { createResult, createResultError, type Result } from "#result"
import { e2eTestNamePattern } from "./e2eTestNamePattern.js"

export function e2eTestNameCreatedAtParse(name: string): Result<Date> {
  const op = "e2eTestNameCreatedAtParse"
  const match = e2eTestNamePattern.exec(name)
  if (match === null || match[1] === undefined)
    return createResultError(op, `Test name does not carry an E2E timestamp: ${name}.`)
  const timestamp = match[1]
  const createdAt = new Date(
    Date.UTC(
      Number(timestamp.slice(0, 4)),
      Number(timestamp.slice(4, 6)) - 1,
      Number(timestamp.slice(6, 8)),
      Number(timestamp.slice(8, 10)),
      Number(timestamp.slice(10, 12)),
    ),
  )
  if (Number.isNaN(createdAt.getTime()))
    return createResultError(op, `Test name carries an invalid timestamp: ${name}.`)
  return createResult(createdAt)
}
