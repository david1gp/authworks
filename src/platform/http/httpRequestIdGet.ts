export function httpRequestIdGet(headerValue: string | undefined, fallbackCreate: () => string): string {
  if (headerValue !== undefined && headerValue.length > 0 && headerValue.length <= 128 && !/\s/.test(headerValue))
    return headerValue
  return fallbackCreate()
}
