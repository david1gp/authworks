/** Joins stored geo data into a display string, or null when nothing is known. */
export function sessionDeviceLocationGet(device: {
  readonly countryCode?: string | undefined
  readonly region?: string | undefined
}): string | null {
  const parts = [device.region?.trim(), device.countryCode?.trim()].filter(
    (part): part is string => part !== undefined && part.length > 0,
  )
  if (parts.length === 0) return null
  return parts.join(", ")
}
