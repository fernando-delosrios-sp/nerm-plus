import { ProfileAccount, NeprofileUserAccount, NeaccessUserAccount } from '../src/model/account'

describe('Account Models', () => {
    describe('ProfileAccount', () => {
        it('should correctly map input with Active status and valid name', () => {
            const input = { id: '123', name: 'John Doe', status: 'Active' }
            const account = new ProfileAccount(input)

            expect(account.identity).toBe('123')
            expect(account.uuid).toBe('John Doe')
            expect(account.disabled).toBe(false)
            expect(account.attributes).toEqual({
                id: '123',
                name: 'John Doe',
                types: ['Profile'],
            })
        })

        it('should correctly map input with non-Active status and missing name', () => {
            const input = { id: '456', status: 'Inactive' }
            const account = new ProfileAccount(input)

            expect(account.identity).toBe('456')
            expect(account.uuid).toBe('')
            expect(account.disabled).toBe(true)
            expect(account.attributes).toEqual({
                id: '456',
                name: undefined,
                types: ['Profile'],
            })
        })
    })

    describe('NeprofileUserAccount', () => {
        it('should correctly map input with Active status and valid name', () => {
            const input = { id: '123', name: 'John Doe', status: 'Active' }
            const account = new NeprofileUserAccount(input)

            expect(account.identity).toBe('123')
            expect(account.uuid).toBe('John Doe')
            expect(account.disabled).toBe(false)
            expect(account.attributes).toEqual({
                types: ['NeprofileUser'],
            })
        })

        it('should correctly map input with non-Active status and missing name', () => {
            const input = { id: '456', status: 'Inactive' }
            const account = new NeprofileUserAccount(input)

            expect(account.identity).toBe('456')
            expect(account.uuid).toBe('')
            expect(account.disabled).toBe(true)
            expect(account.attributes).toEqual({
                types: ['NeprofileUser'],
            })
        })
    })

    describe('NeaccessUserAccount', () => {
        it('should correctly map input with Active status and valid name', () => {
            const input = { id: '123', name: 'John Doe', status: 'Active' }
            const account = new NeaccessUserAccount(input)

            expect(account.identity).toBe('123')
            expect(account.uuid).toBe('John Doe')
            expect(account.disabled).toBe(false)
            expect(account.attributes).toEqual({
                types: ['NeaccessUser'],
            })
        })

        it('should correctly map input with non-Active status and missing name', () => {
            const input = { id: '456', status: 'Inactive' }
            const account = new NeaccessUserAccount(input)

            expect(account.identity).toBe('456')
            expect(account.uuid).toBe('')
            expect(account.disabled).toBe(true)
            expect(account.attributes).toEqual({
                types: ['NeaccessUser'],
            })
        })
    })
})
