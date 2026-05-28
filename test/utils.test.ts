import { getStatus, getAttribute } from '../src/utils'
import { AccountType } from '../src/model/config'

describe('getStatus', () => {
    it('should map Profile statuses correctly', () => {
        expect(getStatus('Disabled', 'Profile')).toBe('Inactive')
    })

    it('should map NeprofileUser statuses correctly', () => {
        expect(getStatus('Inactive', 'NeprofileUser')).toBe('Disabled')
        expect(getStatus('On Leave', 'NeprofileUser')).toBe('Disabled')
        expect(getStatus('Terminated', 'NeprofileUser')).toBe('Disabled')
    })

    it('should map NeaccessUser statuses correctly', () => {
        expect(getStatus('Inactive', 'NeaccessUser')).toBe('Disabled')
        expect(getStatus('On Leave', 'NeaccessUser')).toBe('Disabled')
        expect(getStatus('Terminated', 'NeaccessUser')).toBe('Disabled')
    })

    it('should return the original status if not found in the mapping', () => {
        expect(getStatus('Active', 'Profile')).toBe('Active')
        expect(getStatus('Active', 'NeprofileUser')).toBe('Active')
        expect(getStatus('Active', 'NeaccessUser')).toBe('Active')
        expect(getStatus('Unknown', 'Profile')).toBe('Unknown')
    })

    it('should return the original status for unknown AccountType', () => {
        // We cast to AccountType to test what happens if an unexpected string is passed
        expect(getStatus('Disabled', 'UnknownType' as AccountType)).toBe('Disabled')
    })
})

describe('getAttribute', () => {
    it('should return undefined if object is falsy', () => {
        expect(getAttribute(null as any, 'some.path')).toBeUndefined()
        expect(getAttribute(undefined as any, 'some.path')).toBeUndefined()
    })

    it('should correctly access top-level properties', () => {
        const obj = { name: 'John', age: 30 }
        expect(getAttribute(obj, 'name')).toBe('John')
        expect(getAttribute(obj, 'age')).toBe(30)
    })

    it('should correctly access nested properties', () => {
        const obj = { user: { profile: { id: 123, email: 'john@example.com' } } }
        expect(getAttribute(obj, 'user.profile.id')).toBe(123)
        expect(getAttribute(obj, 'user.profile.email')).toBe('john@example.com')
    })

    it('should return undefined when a nested property does not exist', () => {
        const obj = { user: { profile: { id: 123 } } }
        expect(getAttribute(obj, 'user.profile.email')).toBeUndefined()
        expect(getAttribute(obj, 'user.settings.theme')).toBeUndefined()
        expect(getAttribute(obj, 'account.id')).toBeUndefined()
    })

    it('should return undefined when the attribute path is empty and not matched', () => {
        const obj = { name: 'John' }
        expect(getAttribute(obj, '')).toBeUndefined()
    })
})
