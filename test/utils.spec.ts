import { getEmailFromUserAttribute } from '../src/utils'

describe('getEmailFromUserAttribute', () => {
    it('should extract email in the format: Name (email)', () => {
        expect(getEmailFromUserAttribute('John Doe (john.doe@example.com)')).toBe('john.doe@example.com')
    })

    it('should return undefined if no parenthesis present', () => {
        expect(getEmailFromUserAttribute('john.doe@example.com')).toBeUndefined()
    })

    it('should return undefined if parenthesis are present but no email format inside', () => {
        expect(getEmailFromUserAttribute('John Doe (no email here)')).toBeUndefined()
    })

    it('should handle parenthesis containing an @ but invalid email format', () => {
        expect(getEmailFromUserAttribute('John Doe (john.doe@a)')).toBe('john.doe@a')
        expect(getEmailFromUserAttribute('John Doe (john.doe@)')).toBeUndefined()
    })

    it('should extract the first matched group if multiple parenthesis are present', () => {
        expect(getEmailFromUserAttribute('John Doe (Admin) (john.doe@example.com)')).toBe('john.doe@example.com')
    })

    it('should return undefined if input is not a string', () => {
        // We have to cast to `any` because TS enforces string in typing, but at runtime it could be anything
        expect(getEmailFromUserAttribute(null as any)).toBeUndefined()
        expect(getEmailFromUserAttribute(undefined as any)).toBeUndefined()
        expect(getEmailFromUserAttribute({} as any)).toBeUndefined()
    })

    it('should return undefined for empty string', () => {
        expect(getEmailFromUserAttribute('')).toBeUndefined()
    })
})
