import { createSignalObject } from "#ui/utils/createSignalObject.js"

/** Local view state for copying a read-only protocol document to the clipboard. */
export function oidcAdminDocumentCopyStateCreate(options: { readonly writeText?: (value: string) => Promise<void> }) {
  const copiedKey = createSignalObject<string | undefined>(undefined)

  const copy = async (key: string, value: string) => {
    const writeText = options.writeText ?? ((text: string) => navigator.clipboard.writeText(text))
    try {
      await writeText(value)
      copiedKey.set(key)
    } catch {
      // The document remains fully visible and selectable, so a denied clipboard is harmless.
      copiedKey.set(undefined)
    }
  }

  return {
    copied: (key: string) => copiedKey.get() === key,
    copy: (key: string, value: string) => void copy(key, value),
  }
}
