import { AccountSchema, Attributes } from '@sailpoint/connector-sdk'
import { AccountType, Mapping } from '../src/model/config'
import { GenericEntitlement } from '../src/model/entitlement'
import {
    entity2profile,
    genericEntitlement2StdEntitlementListOutput,
    getEmailFromUserAttribute,
    getStatus,
    profile2Entitlement,
    resolveUserAttributes,
} from '../src/utils'

describe('resolveUserAttributes', () => {
    it('should return empty object if schema is undefined', () => {
        const attributes: Attributes = { foo: 'bar' }
        expect(resolveUserAttributes(attributes, undefined)).toEqual({})
    })

    it('should filter attributes based on schema', () => {
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

    it('should include attributes as undefined if they are in schema but missing in input', () => {
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

    it('should return empty object if schema has no attributes', () => {
        const attributes: Attributes = { foo: 'bar' }
        const schema: AccountSchema = {
            identityAttribute: 'foo',
            displayAttribute: 'foo',
            groupAttribute: 'types',
            attributes: [],
        }
        expect(resolveUserAttributes(attributes, schema)).toEqual({})
    })
})

describe('entity2profile', () => {
    it('maps basic attributes and conf.id correctly', () => {
        const conf: Mapping = {
            id: 'userId',
            mapping: {
                firstName: 'first_name',
                lastName: 'last_name',
            },
            index: 'identities',
            search: '*',
            profile: 'test_profile',
            sync: true,
        }

        const mockEntity = {
            id: 'doc123',
            name: 'John Doe',
            enabled: true,
            first_name: 'John',
            last_name: 'Doe',
        }

        const result = entity2profile(mockEntity as any, 'profileType1', conf)

        expect(result).toEqual({
            profile_type_id: 'profileType1',
            status: 'Active',
            name: 'John Doe',
            attributes: {
                firstName: 'John',
                lastName: 'Doe',
                userId: 'doc123',
            },
        })
    })

    it('maps nested attributes using getAttribute', () => {
        const conf: Mapping = {
            id: 'userId',
            mapping: {
                departmentName: 'department.name',
                managerId: 'manager.id',
            },
            index: 'identities',
            search: '*',
            profile: 'test_profile',
            sync: true,
        }

        const mockEntity = {
            id: 'doc456',
            name: 'Jane Smith',
            enabled: true,
            department: {
                name: 'Engineering',
            },
            manager: {
                id: 'mgr789',
            },
        }

        const result = entity2profile(mockEntity as any, 'profileType2', conf)

        expect(result).toEqual({
            profile_type_id: 'profileType2',
            status: 'Active',
            name: 'Jane Smith',
            attributes: {
                departmentName: 'Engineering',
                managerId: 'mgr789',
                userId: 'doc456',
            },
        })
    })

    describe('status mapping logic', () => {
        const createConf = (): Mapping => ({
            id: 'userId',
            mapping: {},
            index: 'identities',
            search: '*',
            profile: 'test_profile',
            sync: true,
        })

        it('returns Active if enabled is true', () => {
            const entity = { id: '1', name: 'Test', enabled: true, inactive: true }
            const result = entity2profile(entity as any, 'type', createConf())
            expect(result.status).toBe('Active')
        })

        it('returns Active if enabled is false but inactive is false', () => {
            const entity = { id: '1', name: 'Test', enabled: false, inactive: false }
            const result = entity2profile(entity as any, 'type', createConf())
            expect(result.status).toBe('Active')
        })

        it('returns Inactive if enabled is false and inactive is true', () => {
            const entity = { id: '1', name: 'Test', enabled: false, inactive: true }
            const result = entity2profile(entity as any, 'type', createConf())
            expect(result.status).toBe('Inactive')
        })

        it('returns Inactive if enabled is undefined and inactive is true', () => {
            const entity = { id: '1', name: 'Test', inactive: true }
            const result = entity2profile(entity as any, 'type', createConf())
            expect(result.status).toBe('Inactive')
        })

        it('returns Active if both enabled and inactive are undefined', () => {
            const entity = { id: '1', name: 'Test' }
            const result = entity2profile(entity as any, 'type', createConf())
            expect(result.status).toBe('Active')
        })
    })
})

describe('profile2Entitlement', () => {
    it('should correctly map a profile to an entitlement with specified attributes', () => {
        const mockProfile = {
            id: '12345',
            name: 'Test Profile',
            attributes: {
                department: 'Engineering',
                title: 'Software Engineer',
                location: 'Remote',
            },
        }
        const type = 'ProfileType'
        const attrs = ['department', 'title']

        const expectedEntitlement = {
            type: 'ProfileType',
            uuid: 'Test Profile',
            identity: '12345',
            attributes: {
                id: '12345',
                name: 'Test Profile',
                department: 'Engineering',
                title: 'Software Engineer',
            },
        }

        const result = profile2Entitlement(mockProfile, type, attrs)
        expect(result).toEqual(expectedEntitlement)
    })

    it('should handle an empty attributes array', () => {
        const mockProfile = {
            id: '67890',
            name: 'Another Profile',
            attributes: {
                department: 'HR',
            },
        }
        const type = 'ProfileType'
        const attrs: string[] = []

        const expectedEntitlement = {
            type: 'ProfileType',
            uuid: 'Another Profile',
            identity: '67890',
            attributes: {
                id: '67890',
                name: 'Another Profile',
            },
        }

        const result = profile2Entitlement(mockProfile, type, attrs)
        expect(result).toEqual(expectedEntitlement)
    })

    it('should set undefined for attributes not present in profile.attributes', () => {
        const mockProfile = {
            id: '999',
            name: 'Incomplete Profile',
            attributes: {
                department: 'Sales',
            },
        }
        const type = 'ProfileType'
        const attrs = ['department', 'missingAttr']

        const expectedEntitlement = {
            type: 'ProfileType',
            uuid: 'Incomplete Profile',
            identity: '999',
            attributes: {
                id: '999',
                name: 'Incomplete Profile',
                department: 'Sales',
                missingAttr: undefined,
            },
        }

        const result = profile2Entitlement(mockProfile, type, attrs)
        expect(result).toEqual(expectedEntitlement)
    })

    it('should handle missing profile attributes object gracefully when asking for empty attrs', () => {
        const mockProfile = {
            id: '111',
            name: 'No Attrs Profile',
        }
        const type = 'ProfileType'
        const attrs: string[] = []

        const expectedEntitlement = {
            type: 'ProfileType',
            uuid: 'No Attrs Profile',
            identity: '111',
            attributes: {
                id: '111',
                name: 'No Attrs Profile',
            },
        }

        const result = profile2Entitlement(mockProfile, type, attrs)
        expect(result).toEqual(expectedEntitlement)
    })

    it('should map profile without attributes object gracefully', () => {
        const mockProfile = {
            id: '222',
            name: 'Bad Profile',
        }
        const type = 'ProfileType'
        const attrs = ['department']

        const result = profile2Entitlement(mockProfile, type, attrs)
        expect(result.attributes.department).toBeUndefined()
    })
})

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
        expect(getStatus('Disabled', 'UnknownType' as AccountType)).toBe('Disabled')
    })
})

describe('genericEntitlement2StdEntitlementListOutput', () => {
    it('should correctly map generic entitlement properties to standard entitlement list output', () => {
        const type = 'test_type'
        const genericEntitlement: GenericEntitlement = {
            id: 'test_id',
            name: 'test_name',
            description: 'test description',
        }

        const result = genericEntitlement2StdEntitlementListOutput(type, genericEntitlement)

        expect(result).toEqual({
            type: 'test_type',
            identity: 'test_id',
            uuid: 'test_name',
            attributes: {
                id: 'test_id',
                name: 'test_name',
                description: 'test description',
            },
        })
    })

    it('should handle generic entitlement without description', () => {
        const type = 'another_type'
        const genericEntitlement: GenericEntitlement = {
            id: 'id_123',
            name: 'name_123',
        }

        const result = genericEntitlement2StdEntitlementListOutput(type, genericEntitlement)

        expect(result).toEqual({
            type: 'another_type',
            identity: 'id_123',
            uuid: 'name_123',
            attributes: {
                id: 'id_123',
                name: 'name_123',
            },
        })
    })

    it('should correctly map even when id and name are the same', () => {
        const type = 'role'
        const genericEntitlement: GenericEntitlement = {
            id: 'admin',
            name: 'admin',
        }

        const result = genericEntitlement2StdEntitlementListOutput(type, genericEntitlement)

        expect(result).toEqual({
            type: 'role',
            identity: 'admin',
            uuid: 'admin',
            attributes: {
                id: 'admin',
                name: 'admin',
            },
        })
    })
})

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
