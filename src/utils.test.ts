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
            groupAttribute: 'types',
            attributes: [
                { name: 'firstname', type: 'string', description: 'firstname' },
                { name: 'lastname', type: 'string', description: 'lastname' },
                { name: 'email', type: 'string', description: 'email' },
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
            groupAttribute: 'types',
            attributes: [
                { name: 'firstname', type: 'string', description: 'firstname' },
                { name: 'lastname', type: 'string', description: 'lastname' },
            ],
        }
        const expected: Attributes = {
            firstname: 'John',
            lastname: null,
        }
        expect(resolveUserAttributes(attributes, schema)).toEqual(expected)
    })

    test('should return empty object if schema has no attributes', () => {
        const attributes: Attributes = { foo: 'bar' }
        const schema: AccountSchema = {
            identityAttribute: 'foo',
            displayAttribute: 'foo',
            groupAttribute: 'types',
            attributes: [],
        }
        expect(resolveUserAttributes(attributes, schema)).toEqual({})
    })

    test('should map empty attributes object to null values based on schema', () => {
        const attributes: Attributes = {}
        const schema: AccountSchema = {
            identityAttribute: 'id',
            displayAttribute: 'id',
            groupAttribute: 'types',
            attributes: [
                { name: 'firstname', type: 'string', description: 'firstname' },
                { name: 'age', type: 'int', description: 'age' },
            ],
        }
        const expected: Attributes = {
            firstname: null,
            age: null,
        }
        expect(resolveUserAttributes(attributes, schema)).toEqual(expected)
    })

    test('should retain explicit null values in attributes', () => {
        const attributes: Attributes = {
            firstname: 'John',
            age: null,
        }
        const schema: AccountSchema = {
            identityAttribute: 'id',
            displayAttribute: 'id',
            groupAttribute: 'types',
            attributes: [
                { name: 'firstname', type: 'string', description: 'firstname' },
                { name: 'age', type: 'int', description: 'age' },
            ],
        }
        const expected: Attributes = {
            firstname: 'John',
            age: null,
        }
        expect(resolveUserAttributes(attributes, schema)).toEqual(expected)
    })

    test('should retain falsy values like 0, false, and empty string without converting to null', () => {
        const attributes: Attributes = {
            firstname: '',
            age: 0,
            active: false,
        }
        const schema: AccountSchema = {
            identityAttribute: 'id',
            displayAttribute: 'id',
            groupAttribute: 'types',
            attributes: [
                { name: 'firstname', type: 'string', description: 'firstname' },
                { name: 'age', type: 'int', description: 'age' },
                { name: 'active', type: 'boolean', description: 'active' },
            ],
        }
        const expected: Attributes = {
            firstname: '',
            age: 0,
            active: false,
        }
        expect(resolveUserAttributes(attributes, schema)).toEqual(expected)
    })
})
