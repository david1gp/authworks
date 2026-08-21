import { createSignalObject } from "#ui/utils/createSignalObject.js"

/**
 * Local view state for the one-time client secret panel. The secret is only ever read
 * from the accessor it is given; it is never copied into storage or a URL.
 */
export function oidcAdminSecretPanelStateCreate(options: {
  readonly onAcknowledge: () => void
  readonly secret: () => string | undefined
  readonly writeText?: (value: string) => Promise<void>
}) {
  const copied = createSignalObject(false)
  const copyFailed = createSignalObject(false)

  const copy = async () => {
    const secret = options.secret()
    if (secret === undefined) return
    const writeText = options.writeText ?? ((value: string) => navigator.clipboard.writeText(value))
    try {
      await writeText(secret)
      copyFailed.set(false)
      copied.set(true)
    } catch {
      // A denied clipboard permission must not block the operator; the value stays selectable.
      copyFailed.set(true)
    }
  }

  return {
    acknowledge: () => {
      copied.set(false)
      copyFailed.set(false)
      options.onAcknowledge()
    },
    copied: copied.get,
    copy: () => void copy(),
    copyFailed: copyFailed.get,
  }
}
