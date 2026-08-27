export function httpRequestIdGet(headerValue: string | undefined, fallbackCreate: () => string): string {
  if (headerValue !== undefined && /^[a-z0-9._:-]{1,128}$/i.test(headerValue)) return headerValue
  return fallbackCreate()
}
