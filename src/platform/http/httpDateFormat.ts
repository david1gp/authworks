const httpDateWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const httpDateMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function httpDateNumberFormat(value: number): string {
  return value.toString().padStart(2, "0")
}

export function httpDateFormat(value: Date): string {
  const timestamp = Math.floor(value.getTime() / 1000) * 1000
  const date = new Date(timestamp)
  const weekday = httpDateWeekdays[date.getUTCDay()] ?? ""
  const month = httpDateMonths[date.getUTCMonth()] ?? ""

  const year = date.getUTCFullYear().toString().padStart(4, "0")
  return `${weekday}, ${httpDateNumberFormat(date.getUTCDate())} ${month} ${year} ${httpDateNumberFormat(date.getUTCHours())}:${httpDateNumberFormat(date.getUTCMinutes())}:${httpDateNumberFormat(date.getUTCSeconds())} GMT`
}
