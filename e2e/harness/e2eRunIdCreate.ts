const runIdRandomLength = 6

function e2eRunIdTimestampCreate(now: Date): string {
  const pad = (value: number, length: number) => String(value).padStart(length, "0")
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1, 2)}${pad(now.getUTCDate(), 2)}` +
    `${pad(now.getUTCHours(), 2)}${pad(now.getUTCMinutes(), 2)}`
  )
}

function e2eRunIdRandomCreate(random: () => number): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
  let suffix = ""
  for (let index = 0; index < runIdRandomLength; index += 1) {
    suffix += alphabet[Math.floor(random() * alphabet.length)] ?? "0"
  }
  return suffix
}

export function e2eRunIdCreate(now: Date = new Date(), random: () => number = Math.random): string {
  return `${e2eRunIdTimestampCreate(now)}-${e2eRunIdRandomCreate(random)}`
}
