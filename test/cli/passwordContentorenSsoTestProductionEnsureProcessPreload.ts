const productionOrigin = "https://authworks.contentoren.de"
const mockOrigin = process.env.AUTHWORKS_CONTENTOREN_SSOTEST_TEST_ORIGIN

if (mockOrigin !== undefined) {
  const fetchOriginal = globalThis.fetch
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.origin !== productionOrigin) return fetchOriginal(input, init)
    const mockUrl = new URL(mockOrigin)
    url.protocol = mockUrl.protocol
    url.host = mockUrl.host
    return fetchOriginal(new Request(url, request))
  }) as typeof globalThis.fetch
}
