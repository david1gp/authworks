/** Redacts a stored OTP code for admin display: short codes collapse fully, longer codes keep the edge characters. */
export function wahaCodeMask(code: string): string {
  if (code.length <= 2) return "***"
  return `${code.slice(0, 1)}***${code.slice(-1)}`
}
