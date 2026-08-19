import { expect, test } from "bun:test"
import { httpConditionalGetEvaluate } from "../../src/platform/http/httpConditionalGetEvaluate.js"
import { httpDateFormat } from "../../src/platform/http/httpDateFormat.js"
import { httpDateParse } from "../../src/platform/http/httpDateParse.js"

test("HTTP-date IMF-fixdate parse and format round-trip", () => {
  const parsed = httpDateParse("Sun, 06 Nov 1994 08:49:37 GMT")

  expect(parsed?.toISOString()).toBe("1994-11-06T08:49:37.000Z")
  expect(parsed === undefined ? undefined : httpDateFormat(parsed)).toBe("Sun, 06 Nov 1994 08:49:37 GMT")
})

test("HTTP-date parses RFC 850 and asctime dates", () => {
  expect(httpDateParse("Sunday, 06-Nov-94 08:49:37 GMT")?.toISOString()).toBe("1994-11-06T08:49:37.000Z")
  expect(httpDateParse("Sun Nov  6 08:49:37 1994")?.toISOString()).toBe("1994-11-06T08:49:37.000Z")
})

test("invalid HTTP-dates are ignored", () => {
  expect(httpDateParse(undefined)).toBeUndefined()
  expect(httpDateParse("")).toBeUndefined()
  expect(httpDateParse("Sun, 31 Feb 1994 08:49:37 GMT")).toBeUndefined()
  expect(httpDateParse("not a date")).toBeUndefined()
  expect(
    httpConditionalGetEvaluate({
      ifModifiedSince: "not a date",
      lastModified: new Date("1994-11-06T08:49:37.000Z"),
    }),
  ).toEqual({ lastModified: "Sun, 06 Nov 1994 08:49:37 GMT", status: 200 })
})

test("HTTP-date format drops milliseconds", () => {
  expect(httpDateFormat(new Date("1994-11-06T08:49:37.999Z"))).toBe("Sun, 06 Nov 1994 08:49:37 GMT")
})

test("conditional GET returns 200 when the resource is newer", () => {
  expect(
    httpConditionalGetEvaluate({
      ifModifiedSince: "Sun, 06 Nov 1994 08:49:37 GMT",
      lastModified: new Date("1994-11-06T08:49:38.000Z"),
    }).status,
  ).toBe(200)
})

test("conditional GET returns 304 when last-modified is earlier than the validator", () => {
  expect(
    httpConditionalGetEvaluate({
      ifModifiedSince: "Sun, 06 Nov 1994 08:49:38 GMT",
      lastModified: new Date("1994-11-06T08:49:37.999Z"),
    }).status,
  ).toBe(304)
})

test("conditional GET returns 304 for equal second-truncated timestamps", () => {
  expect(
    httpConditionalGetEvaluate({
      ifModifiedSince: "Sun, 06 Nov 1994 08:49:37 GMT",
      lastModified: new Date("1994-11-06T08:49:37.999Z"),
    }).status,
  ).toBe(304)
})

test("conditional GET returns 200 without If-Modified-Since", () => {
  expect(httpConditionalGetEvaluate({ lastModified: new Date("1994-11-06T08:49:37.000Z") }).status).toBe(200)
})
