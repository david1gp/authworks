export class Secret {
  #value: string

  constructor(value: string) {
    this.#value = value
  }

  toJSON(): string {
    return "[REDACTED]"
  }

  toString(): string {
    return "[REDACTED]"
  }

  valueGet(): string {
    return this.#value
  }
}
