import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

function translationCsvRowsParse(csv: string): Result<string[][]> {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  let afterQuote = false

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    if (quoted) {
      if (char === '"') {
        if (csv[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
          afterQuote = true
        }
      } else {
        field += char
      }
      continue
    }

    if (afterQuote) {
      if (char === ",") {
        row.push(field)
        field = ""
        afterQuote = false
        continue
      }
      if (char === "\r" || char === "\n") {
        row.push(field)
        rows.push(row)
        row = []
        field = ""
        afterQuote = false
        if (char === "\r" && csv[index + 1] === "\n") index += 1
        continue
      }
      return resultErrorCreate("translationCsvParse", "Translation file contains malformed CSV.")
    }

    if (char === '"') {
      if (field !== "") return resultErrorCreate("translationCsvParse", "Translation file contains malformed CSV.")
      quoted = true
      continue
    }
    if (char === ",") {
      row.push(field)
      field = ""
      continue
    }
    if (char === "\r" || char === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      if (char === "\r" && csv[index + 1] === "\n") index += 1
      continue
    }
    field += char
  }

  if (quoted) return resultErrorCreate("translationCsvParse", "Translation file contains malformed CSV.")
  if (afterQuote || row.length > 0 || field !== "") {
    row.push(field)
    rows.push(row)
  }
  return resultCreate(rows.filter((entry) => entry.some((value) => value.trim() !== "")))
}

/** Parses the `english,{locale}` or `key,{locale}` catalog format used by the UI. */
export function translationCsvParse(csv: string): Result<Record<string, string>> {
  const parsedRows = translationCsvRowsParse(csv)
  if (!parsedRows.success) return parsedRows

  const header = parsedRows.data[0]
  const firstHeader = header?.[0]
    ?.replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
  if (header?.length !== 2 || (firstHeader !== "english" && firstHeader !== "key")) {
    return resultErrorCreate("translationCsvParse", "Translation file header must start with an english or key column.")
  }

  const dictionary: Record<string, string> = {}
  for (const entry of parsedRows.data.slice(1)) {
    if (entry.length > 2) return resultErrorCreate("translationCsvParse", "Translation file contains too many columns.")
    const key = entry[0]
    const translated = entry[1]
    if (!key || !translated || translated.trim() === "") continue
    Object.defineProperty(dictionary, key, {
      configurable: true,
      enumerable: true,
      value: translated,
      writable: true,
    })
  }
  return resultCreate(dictionary)
}
