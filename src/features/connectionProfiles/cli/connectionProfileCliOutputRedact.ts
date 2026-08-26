const connectionProfileCliRedactedValue = "[REDACTED]"

type RedactionCandidate = {
  readonly encoded: boolean
  readonly raw: boolean
  readonly value: string
}

type JsonStringRange = {
  readonly end: number
  readonly start: number
}

export function connectionProfileCliOutputRedact(
  output: string,
  secrets: readonly (string | undefined)[] = [],
): string {
  const candidates = connectionProfileCliRedactionCandidatesCreate(secrets)
  if (candidates.length === 0) return output

  const jsonStringRanges = connectionProfileCliJsonStringRangesGet(output)
  let jsonStringRangeIndex = 0
  let redacted = ""

  for (let index = 0; index < output.length; ) {
    const jsonStringRange = jsonStringRanges[jsonStringRangeIndex]
    if (jsonStringRange?.start === index) {
      redacted += '"'
      index += 1
      continue
    }
    if (jsonStringRange?.end === index) {
      redacted += '"'
      index += 1
      jsonStringRangeIndex += 1
      continue
    }
    if (output.startsWith(connectionProfileCliRedactedValue, index)) {
      redacted += connectionProfileCliRedactedValue
      index += connectionProfileCliRedactedValue.length
      continue
    }

    const insideJsonString =
      jsonStringRange !== undefined && index > jsonStringRange.start && index < jsonStringRange.end
    const candidate = candidates.find((entry) => {
      if (insideJsonString && !entry.encoded && !entry.raw) return false
      return output.startsWith(entry.value, index)
    })

    if (candidate) {
      redacted += connectionProfileCliRedactedValue
      index += candidate.value.length
      continue
    }

    redacted += output[index]
    index += 1
  }

  return redacted
}

function connectionProfileCliRedactionCandidatesCreate(
  secrets: readonly (string | undefined)[],
): readonly RedactionCandidate[] {
  const candidates = new Map<string, RedactionCandidate>()

  for (const secret of secrets) {
    if (secret === undefined || secret.length === 0 || secret === connectionProfileCliRedactedValue) continue

    const rawCandidate = candidates.get(secret)
    candidates.set(secret, {
      encoded: rawCandidate?.encoded ?? false,
      raw: rawCandidate?.raw ?? connectionProfileCliRawJsonStringSafe(secret),
      value: secret,
    })

    const encoded = JSON.stringify(secret).slice(1, -1)
    const encodedCandidate = candidates.get(encoded)
    candidates.set(encoded, {
      encoded: true,
      raw: encodedCandidate?.raw ?? false,
      value: encoded,
    })
  }

  return [...candidates.values()].sort((left, right) => right.value.length - left.value.length)
}

function connectionProfileCliRawJsonStringSafe(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code === 0x22 || code === 0x5c || code <= 0x1f) return false
  }

  return true
}

function connectionProfileCliJsonStringRangesGet(output: string): readonly JsonStringRange[] {
  const ranges: JsonStringRange[] = []

  for (let index = 0; index < output.length; index += 1) {
    if (output[index] !== '"' || !connectionProfileCliJsonStringStartIsLikely(output, index)) continue

    const end = connectionProfileCliJsonStringEndGet(output, index + 1)
    if (end !== -1 && connectionProfileCliJsonStringEndIsLikely(output, end)) {
      ranges.push({ end, start: index })
      index = end
    }
  }

  return ranges
}

function connectionProfileCliJsonStringStartIsLikely(output: string, index: number): boolean {
  let previous = index - 1
  while (previous >= 0 && /\s/u.test(output[previous] ?? "")) previous -= 1
  return previous < 0 || "{[:,".includes(output[previous] ?? "")
}

function connectionProfileCliJsonStringEndGet(output: string, start: number): number {
  for (let index = start; index < output.length; index += 1) {
    if (output[index] === "\\") {
      index += 1
      continue
    }
    if (output[index] === '"') return index
  }

  return -1
}

function connectionProfileCliJsonStringEndIsLikely(output: string, index: number): boolean {
  let next = index + 1
  while (next < output.length && /\s/u.test(output[next] ?? "")) next += 1
  return next === output.length || "}],:".includes(output[next] ?? "")
}
