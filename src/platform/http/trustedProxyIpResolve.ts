type TrustedProxyIpResolveOptions = {
  readonly directAddress?: string
  readonly forwardedFor?: string
  readonly trustedProxyAddresses?: readonly string[]
}

export function trustedProxyIpResolve(options: TrustedProxyIpResolveOptions): string {
  const directAddress = ipAddressNormalize(options.directAddress)
  if (directAddress === undefined) return "unknown"
  const trustedProxyAddresses = new Set(
    (options.trustedProxyAddresses ?? []).map((address) => ipAddressNormalize(address)).filter(isDefined),
  )
  if (!trustedProxyAddresses.has(directAddress)) return directAddress

  const chain = [
    ...(options.forwardedFor ?? "")
      .split(",")
      .map((address) => ipAddressNormalize(address))
      .filter(isDefined),
    directAddress,
  ]
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const address = chain[index]
    if (address !== undefined && !trustedProxyAddresses.has(address)) return address
  }
  return chain[0] ?? directAddress
}

function ipAddressNormalize(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase()
  if (normalized === undefined || normalized.length === 0) return undefined
  if (normalized.startsWith("[")) {
    const closingBracket = normalized.indexOf("]")
    if (closingBracket > 1) return normalized.slice(1, closingBracket)
  }
  const firstColon = normalized.indexOf(":")
  if (firstColon !== -1 && firstColon === normalized.lastIndexOf(":") && /^\d+$/.test(normalized.slice(firstColon + 1)))
    return normalized.slice(0, firstColon)
  return normalized
}

function isDefined(value: string | undefined): value is string {
  return value !== undefined
}
