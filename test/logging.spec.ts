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
})
