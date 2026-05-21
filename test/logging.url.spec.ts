import { toLogString } from '../src/logging'

describe('URL encoded logging', () => {
    it('redacts URL-encoded form data', () => {
        const input = 'client_id=123&client_secret=supersecret&grant_type=client_credentials&password=abc'
        const logStr = toLogString(input)
        expect(logStr).toBe('client_id=123&client_secret=[REDACTED]&grant_type=client_credentials&password=[REDACTED]')
    })
    it('does not mangle regular strings', () => {
        const input = 'This is a regular string with spaces and an = sign'
        const logStr = toLogString(input)
        expect(logStr).toBe(input)
    })
    it('does not mangle urls', () => {
        const input = 'https://example.com/api?client_secret=supersecret'
        const logStr = toLogString(input)
        expect(logStr).toBe(input)
    })
})
