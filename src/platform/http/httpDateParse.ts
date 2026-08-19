const httpDateMonthIndexes: Readonly<Record<string, number>> = {
  Apr: 3,
  Aug: 7,
  Dec: 11,
  Feb: 1,
  Jan: 0,
  Jul: 6,
  Jun: 5,
  Mar: 2,
  May: 4,
  Nov: 10,
  Oct: 9,
  Sep: 8,
}

const httpDateImfFixdatePattern =
  /^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/
const httpDateRfc850Pattern =
  /^(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT$/
const httpDateAsctimePattern =
  /^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (?:(\d{2})| (\d)) (\d{2}):(\d{2}):(\d{2}) (\d{4})$/

function httpDateCreate(
  year: number,
  monthName: string,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date | undefined {
  const month = httpDateMonthIndexes[monthName]
  if (month === undefined || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return undefined

  const date = new Date(Date.UTC(year, month, day, hour, minute, second))
  if (year >= 0 && year <= 99) date.setUTCFullYear(year)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  )
    return undefined
  return date
}

export function httpDateParse(value: string | undefined): Date | undefined {
  if (value === undefined || value.length === 0) return undefined

  const imfFixdate = httpDateImfFixdatePattern.exec(value)
  if (imfFixdate !== null) {
    const monthName = imfFixdate[2]
    if (monthName === undefined) return undefined
    return httpDateCreate(
      Number(imfFixdate[3]),
      monthName,
      Number(imfFixdate[1]),
      Number(imfFixdate[4]),
      Number(imfFixdate[5]),
      Number(imfFixdate[6]),
    )
  }

  const rfc850 = httpDateRfc850Pattern.exec(value)
  if (rfc850 !== null) {
    const twoDigitYear = Number(rfc850[3])
    const year = twoDigitYear <= 69 ? 2000 + twoDigitYear : 1900 + twoDigitYear
    const monthName = rfc850[2]
    if (monthName === undefined) return undefined
    return httpDateCreate(year, monthName, Number(rfc850[1]), Number(rfc850[4]), Number(rfc850[5]), Number(rfc850[6]))
  }

  const asctime = httpDateAsctimePattern.exec(value)
  if (asctime === null) return undefined
  const monthName = asctime[1]
  if (monthName === undefined) return undefined
  return httpDateCreate(
    Number(asctime[7]),
    monthName,
    Number(asctime[2] ?? asctime[3]),
    Number(asctime[4]),
    Number(asctime[5]),
    Number(asctime[6]),
  )
}
