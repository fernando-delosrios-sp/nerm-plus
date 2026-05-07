import { getEmailFromUserAttribute } from '../../src/utils'

describe('getEmailFromUserAttribute', () => {
    it('should extract email in standard format', () => {
        expect(getEmailFromUserAttribute('John Doe (john.doe@example.com)')).toBe('john.doe@example.com')
    })

    it('should extract email without name prefix', () => {
        expect(getEmailFromUserAttribute('(jane.doe@test.org)')).toBe('jane.doe@test.org')
    })

    it('should extract email with special characters in local part', () => {
        expect(getEmailFromUserAttribute('User (first.last+tag@example.co.uk)')).toBe('first.last+tag@example.co.uk')
    })

    it('should return undefined if input is undefined', () => {
        expect(getEmailFromUserAttribute(undefined as any)).toBeUndefined()
    })

    it('should return undefined if input is null', () => {
        expect(getEmailFromUserAttribute(null as any)).toBeUndefined()
    })

    it('should return undefined if input is a number', () => {
        expect(getEmailFromUserAttribute(12345 as any)).toBeUndefined()
    })

    it('should return undefined if input string does not contain parenthesis', () => {
        expect(getEmailFromUserAttribute('john.doe@example.com')).toBeUndefined()
    })

    it('should return undefined if input string contains parenthesis but no email', () => {
        expect(getEmailFromUserAttribute('John Doe (Engineer)')).toBeUndefined()
    })

    it('should return undefined if email is malformed (no @)', () => {
        expect(getEmailFromUserAttribute('John (johndoe.example.com)')).toBeUndefined()
    })

    it('should extract email if there are multiple parentheses, grabbing the first valid match', () => {
        expect(getEmailFromUserAttribute('John (Engineer) (john@example.com)')).toBe('john@example.com')
    })

    it('should not match if email contains spaces inside parenthesis', () => {
        expect(getEmailFromUserAttribute('John (john @ example.com)')).toBeUndefined()
    })
})
