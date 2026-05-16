import { toLogString } from '../src/logging'

describe('logging', () => {
    it('redacts passwords, tokens, and secrets', () => {
        const input = {
            password: 'my-password',
            token: 'my-token',
            secret: 'my-secret',
            my_password: '123',
            clientSecret: '456',
            accessToken: '789',
            normalKey: 'normalValue',
            changes: [
                { attribute: 'password', value: 'secret1' },
                { attribute: 'token', value: 'secret2' },
                { attribute: 'secret', value: 'secret3' },
                { attribute: 'normal', value: 'normalValue' },
                { attribute: 'nested', value: { secret: 'hidden' } },
            ],
        }
        const logStr = toLogString(input)
        const logged = JSON.parse(logStr)
        expect(logged.password).toBe('[REDACTED]')
        expect(logged.token).toBe('[REDACTED]')
        expect(logged.secret).toBe('[REDACTED]')
        expect(logged.my_password).toBe('[REDACTED]')
        expect(logged.clientSecret).toBe('[REDACTED]')
        expect(logged.accessToken).toBe('[REDACTED]')
        expect(logged.normalKey).toBe('normalValue')
        expect(logged.changes[0].value).toBe('[REDACTED]')
        expect(logged.changes[1].value).toBe('[REDACTED]')
        expect(logged.changes[2].value).toBe('[REDACTED]')
        expect(logged.changes[3].value).toBe('normalValue')
        expect(logged.changes[4].value.secret).toBe('[REDACTED]')
    })

    it('redacts secrets inside stringified JSON payloads', () => {
        const input = {
            url: 'http://example.com/api',
            config: {
                data: JSON.stringify({
                    password: 'my-super-secret-password',
                    token: '123456',
                    public_info: 'hello',
                    nested: {
                        secretKey: 'hidden',
                    },
                }),
            },
        }

        const logStr = toLogString(input)
        const logged = JSON.parse(logStr)

        // The data string should still be a string, but its contents should be redacted JSON
        expect(typeof logged.config.data).toBe('string')

        const dataPayload = JSON.parse(logged.config.data)
        expect(dataPayload.password).toBe('[REDACTED]')
        expect(dataPayload.token).toBe('[REDACTED]')
        expect(dataPayload.public_info).toBe('hello')
        expect(dataPayload.nested.secretKey).toBe('[REDACTED]')
    })

    it('redacts stringified JSON passed directly to toLogString', () => {
        const inputStr = JSON.stringify({
            api_key: 'top-secret',
            status: 'active',
        })

        const logStr = toLogString(inputStr)
        const logged = JSON.parse(logStr)

        expect(logged.api_key).toBe('[REDACTED]')
        expect(logged.status).toBe('active')
    })

    it('redacts URL-encoded strings', () => {
        const input = {
            config: {
                data: 'grant_type=client_credentials&client_id=myclient&client_secret=supersecret123&password=my-password&api_key=my-key',
            },
        }

        const logStr = toLogString(input)
        const logged = JSON.parse(logStr)

        expect(logged.config.data).toBe(
            'grant_type=client_credentials&client_id=myclient&client_secret=[REDACTED]&password=[REDACTED]&api_key=[REDACTED]'
        )
    })
})
