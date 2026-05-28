import { getEmailFromUserAttribute, apiSchema2Schema } from '../../src/utils'
import { Schema as ApiSchema } from 'sailpoint-api-client'

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

describe('apiSchema2Schema', () => {
    it('should map valid ApiSchema to AccountSchema correctly', () => {
        const apiSchema: ApiSchema = {
            identityAttribute: 'id',
            displayAttribute: 'name',
            attributes: [
                {
                    name: 'id',
                    type: 'STRING',
                    description: 'The unique identifier',
                    isMulti: false,
                    isEntitlement: false,
                    isGroup: false,
                },
                {
                    name: 'groups',
                    type: 'STRING',
                    description: 'Groups',
                    isMulti: true,
                    isEntitlement: true,
                    isGroup: true,
                    schema: {
                        type: 'CONNECTOR_SCHEMA',
                        name: 'groupSchema',
                    },
                },
            ],
        }

        const result = apiSchema2Schema(apiSchema)

        expect(result).toEqual({
            identityAttribute: 'id',
            displayAttribute: 'name',
            groupAttribute: 'types',
            attributes: [
                {
                    name: 'id',
                    description: 'The unique identifier',
                    multi: false,
                    entitlement: false,
                    managed: false,
                    schemaObjectType: undefined,
                    type: 'string',
                },
                {
                    name: 'groups',
                    description: 'Groups',
                    multi: true,
                    entitlement: true,
                    managed: true,
                    schemaObjectType: 'groupSchema',
                    type: 'string',
                },
            ],
        })
    })

    it('should handle attributes with minimal fields', () => {
        const apiSchema: ApiSchema = {
            identityAttribute: 'username',
            displayAttribute: 'username',
            attributes: [
                {
                    name: 'username',
                },
            ],
        }

        const result = apiSchema2Schema(apiSchema)

        expect(result).toEqual({
            identityAttribute: 'username',
            displayAttribute: 'username',
            groupAttribute: 'types',
            attributes: [
                {
                    name: 'username',
                    description: '',
                    multi: undefined,
                    entitlement: undefined,
                    managed: undefined,
                    schemaObjectType: undefined,
                    type: 'string',
                },
            ],
        })
    })
})
