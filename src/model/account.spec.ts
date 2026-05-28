import { NeprofileUserAccount } from './account'

describe('NeprofileUserAccount', () => {
    it('should set disabled to false when status is Active', () => {
        const input = { status: 'Active', id: '123', name: 'John Doe' }
        const account = new NeprofileUserAccount(input)
        expect(account.disabled).toBe(false)
        expect(account.identity).toBe('123')
        expect(account.uuid).toBe('John Doe')
        expect(account.attributes).toEqual({ types: ['NeprofileUser'] })
    })

    it('should set disabled to true when status is not Active', () => {
        const input = { status: 'Inactive', id: '123', name: 'John Doe' }
        const account = new NeprofileUserAccount(input)
        expect(account.disabled).toBe(true)
    })

    it('should set uuid to empty string if name is not provided', () => {
        const input = { status: 'Active', id: '123' }
        const account = new NeprofileUserAccount(input)
        expect(account.uuid).toBe('')
    })
})
