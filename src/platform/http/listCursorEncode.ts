export function listCursorEncode(payload: { id: string; k: string | number | null }): string {
  return Buffer.from(JSON.stringify({ v: 1, id: payload.id, k: payload.k }), "utf8").toString("base64url")
}
