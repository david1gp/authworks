import { i18nStore } from "../i18n/model/i18nStore.js"
import { authenticatedAbsoluteTimeFormat } from "./authenticatedAbsoluteTimeFormat.js"
import { authenticatedRelativeTimeFormat } from "./authenticatedRelativeTimeFormat.js"

function relativeTimeTimestampNormalize(value: Date | number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined
  const timestamp = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value)
  return Number.isNaN(timestamp) ? undefined : timestamp
}

export function authenticatedRelativeTimeStateCreate(value: () => Date | number | string | null | undefined) {
  const timestamp = () => relativeTimeTimestampNormalize(value())
  return {
    absolute: () => {
      const resolved = timestamp()
      return resolved === undefined ? undefined : authenticatedAbsoluteTimeFormat(resolved, i18nStore.language.get())
    },
    dateTime: () => {
      const resolved = timestamp()
      return resolved === undefined ? undefined : new Date(resolved).toISOString()
    },
    text: () => {
      const resolved = timestamp()
      return resolved === undefined
        ? undefined
        : authenticatedRelativeTimeFormat(resolved, Date.now(), i18nStore.language.get())
    },
  }
}
