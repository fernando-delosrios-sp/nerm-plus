import { resolveUserAttributes } from './utils'
import { AccountSchema, Attributes } from '@sailpoint/connector-sdk'

describe('resolveUserAttributes', () => {
    test('should return empty object if schema is undefined', () => {
        const attributes: Attributes = { foo: 'bar' }
        expect(resolveUserAttributes(attributes, undefined)).toEqual({})
    })

    test('should filter attributes based on schema', () => {
        const attributes: Attributes = {
            firstname: 'John',
            lastname: 'Doe',
            email: 'john.doe@example.com',
            internalId: '12345',
        }
        const schema: AccountSchema = {
            identityAttribute: 'internalId',
            displayAttribute: 'email',
            attributes: [
                { name: 'firstname', type: 'string' },
                { name: 'lastname', type: 'string' },
                { name: 'email', type: 'string' },
            ],
        }
        const expected: Attributes = {
            firstname: 'John',
            lastname: 'Doe',
            email: 'john.doe@example.com',
        }
        expect(resolveUserAttributes(attributes, schema)).toEqual(expected)
    })

    test('should include attributes as undefined if they are in schema but missing in input', () => {
        const attributes: Attributes = {
            firstname: 'John',
        }
        const schema: AccountSchema = {
            identityAttribute: 'id',
            displayAttribute: 'firstname',
            attributes: [
                { name: 'firstname', type: 'string' },
                { name: 'lastname', type: 'string' },
            ],
        }
        const expected: Attributes = {
            firstname: 'John',
            lastname: undefined,
        }
        expect(resolveUserAttributes(attributes, schema)).toEqual(expected)
    })

    test('should return empty object if schema has no attributes', () => {
        const attributes: Attributes = { foo: 'bar' }
        const schema: AccountSchema = {
            identityAttribute: 'foo',
            displayAttribute: 'foo',
            attributes: [],
        }
        expect(resolveUserAttributes(attributes, schema)).toEqual({})
    })
})
