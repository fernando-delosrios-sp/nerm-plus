import { NeaccessUserAccount } from '../../src/model/account'

describe('NeaccessUserAccount', () => {
    it('should set disabled to false when status is Active', () => {
        const input = { id: 'test-id', name: 'test-name', status: 'Active' }
        const account = new NeaccessUserAccount(input)
        expect(account.disabled).toBe(false)
    })

    it('should set disabled to true when status is not Active', () => {
        const input = { id: 'test-id', name: 'test-name', status: 'Inactive' }
        const account = new NeaccessUserAccount(input)
        expect(account.disabled).toBe(true)
    })

    it('should set disabled to true when status is missing', () => {
        const input = { id: 'test-id', name: 'test-name' }
        const account = new NeaccessUserAccount(input)
        expect(account.disabled).toBe(true)
    })

    it('should set identity to input.id', () => {
        const input = { id: 'test-id', name: 'test-name', status: 'Active' }
        const account = new NeaccessUserAccount(input)
        expect(account.identity).toBe('test-id')
    })

    it('should set uuid to input.name', () => {
        const input = { id: 'test-id', name: 'test-name', status: 'Active' }
        const account = new NeaccessUserAccount(input)
        expect(account.uuid).toBe('test-name')
    })

    it('should set uuid to empty string if input.name is missing', () => {
        const input = { id: 'test-id', status: 'Active' }
        const account = new NeaccessUserAccount(input)
        expect(account.uuid).toBe('')
    })

    it('should set attributes to { types: ["NeaccessUser"] }', () => {
        const input = { id: 'test-id', name: 'test-name', status: 'Active' }
        const account = new NeaccessUserAccount(input)
        expect(account.attributes).toEqual({ types: ['NeaccessUser'] })
    })
})
