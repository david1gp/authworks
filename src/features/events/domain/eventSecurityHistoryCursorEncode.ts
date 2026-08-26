export function eventSecurityHistoryCursorEncode(position: number): string {
  return Buffer.from(JSON.stringify({ position, version: 1 }), "utf8").toString("base64url")
}
