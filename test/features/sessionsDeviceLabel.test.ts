import { expect, test } from "bun:test"
import { sessionUserAgentParse } from "../../src/features/sessions/domain/sessionUserAgentParse.js"
import { sessionDeviceLabelGet } from "../../src/features/sessions/ui/sessionDeviceLabelGet.js"
import { sessionDeviceLocationGet } from "../../src/features/sessions/ui/sessionDeviceLocationGet.js"

const chromeWindows =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
const safariIphone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
const safariMacos =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
const firefoxLinux = "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0"
const edgeWindows =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0"
const chromeAndroid =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
const samsungAndroid =
  "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/126.0.0.0 Mobile Safari/537.36"
const firefoxIos =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15"

test("session user agent parsing detects common browsers and systems", () => {
  expect(sessionUserAgentParse(chromeWindows)).toEqual({ browser: "Chrome", os: "Windows" })
  expect(sessionUserAgentParse(safariIphone)).toEqual({ browser: "Safari", os: "iPhone" })
  expect(sessionUserAgentParse(safariMacos)).toEqual({ browser: "Safari", os: "macOS" })
  expect(sessionUserAgentParse(firefoxLinux)).toEqual({ browser: "Firefox", os: "Linux" })
  expect(sessionUserAgentParse(edgeWindows)).toEqual({ browser: "Edge", os: "Windows" })
  expect(sessionUserAgentParse(chromeAndroid)).toEqual({ browser: "Chrome", os: "Android" })
  expect(sessionUserAgentParse(samsungAndroid)).toEqual({ browser: "Samsung Internet", os: "Android" })
  expect(sessionUserAgentParse(firefoxIos)).toEqual({ browser: "Firefox", os: "iPhone" })
})

test("session user agent parsing tolerates partial and unknown agents", () => {
  expect(sessionUserAgentParse("")).toEqual({ browser: null, os: null })
  expect(sessionUserAgentParse("not-a-user-agent")).toEqual({ browser: null, os: null })
  expect(sessionUserAgentParse("curl/8.4.0")).toEqual({ browser: null, os: null })
  expect(sessionUserAgentParse("Chrome/126.0.0.0")).toEqual({ browser: "Chrome", os: null })
  expect(sessionUserAgentParse("Mozilla/5.0 (Windows NT 10.0)")).toEqual({ browser: null, os: "Windows" })
})

test("session device label prefers an explicit description over the parsed agent", () => {
  expect(sessionDeviceLabelGet({ description: "Laptop", userAgent: chromeWindows })).toBe("Laptop")
  expect(sessionDeviceLabelGet({ description: "  Tablet  ", userAgent: chromeWindows })).toBe("Tablet")
  expect(sessionDeviceLabelGet({ userAgent: chromeWindows })).toBe("Chrome on Windows")
  expect(sessionDeviceLabelGet({ userAgent: safariIphone })).toBe("Safari on iPhone")
  expect(sessionDeviceLabelGet({ userAgent: "Chrome/126.0.0.0" })).toBe("Chrome")
  expect(sessionDeviceLabelGet({ userAgent: "Mozilla/5.0 (Windows NT 10.0)" })).toBe("Windows")
  expect(sessionDeviceLabelGet({})).toBe("Unknown device")
  expect(sessionDeviceLabelGet({ userAgent: "  " })).toBe("Unknown device")
  expect(sessionDeviceLabelGet({ userAgent: "curl/8.4.0" })).toBe("Unknown device")
})

test("session device location joins region and country code only when present", () => {
  expect(sessionDeviceLocationGet({ countryCode: "DE", region: "Bavaria" })).toBe("Bavaria, DE")
  expect(sessionDeviceLocationGet({ region: "Bavaria" })).toBe("Bavaria")
  expect(sessionDeviceLocationGet({ countryCode: "DE" })).toBe("DE")
  expect(sessionDeviceLocationGet({})).toBeNull()
  expect(sessionDeviceLocationGet({ countryCode: "  ", region: "" })).toBeNull()
})
