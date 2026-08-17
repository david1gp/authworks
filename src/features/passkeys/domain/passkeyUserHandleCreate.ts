export function passkeyUserHandleCreate(userId: string): string {
  return Buffer.from(userId, "utf8").toString("base64url")
}
