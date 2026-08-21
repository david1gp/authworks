type PlaceholderValues = Readonly<Record<string, string | number>> | readonly (string | number)[]

/** Applies named `{value}` and legacy `[X]` placeholders without changing unknown tokens. */
export function translationPlaceholdersApply(template: string, values?: PlaceholderValues): string {
  if (!values) return template

  return template.replace(/\{([A-Za-z0-9_.-]+)\}|\[(X\d*)\]/g, (match, named: string, positional: string) => {
    if (Array.isArray(values)) {
      if (named) {
        const numericIndex = Number(named)
        if (Number.isInteger(numericIndex) && numericIndex >= 0) return String(values[numericIndex] ?? match)
        return match
      }
      const index = positional === "X" ? 0 : Number(positional.slice(1)) - 1
      if (!Number.isInteger(index) || index < 0) return match
      return String(values[index] ?? match)
    }

    const key = named ?? positional
    if (!key) return match
    const namedValues = values as Readonly<Record<string, string | number>>
    const value = namedValues[key]
    return value === undefined ? match : String(value)
  })
}
