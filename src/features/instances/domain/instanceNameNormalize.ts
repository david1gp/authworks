import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export function instanceNameNormalize(value: string): Result<string> {
  const name = value.trim().replace(/\s+/g, " ")
  const hasControlCharacter = [...name].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })
  if (name.length === 0 || name.length > 128 || hasControlCharacter)
    return resultErrorCreate("instanceNameNormalize", "The instance name is invalid.")
  return resultCreate(name)
}
