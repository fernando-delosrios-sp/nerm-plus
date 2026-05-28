import { SearchDocument } from 'sailpoint-api-client'
import { genericEntitlement2StdEntitlementListOutput, parents2children } from '../src/utils'
import { GenericEntitlement } from '../src/model/entitlement'

describe('genericEntitlement2StdEntitlementListOutput', () => {
    it('should correctly map generic entitlement properties to standard entitlement list output', () => {
        // Arrange
        const type = 'test_type'
        const genericEntitlement: GenericEntitlement = {
            id: 'test_id',
            name: 'test_name',
            description: 'test description',
        }

        // Act
        const result = genericEntitlement2StdEntitlementListOutput(type, genericEntitlement)

        // Assert
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
        // Arrange
        const type = 'another_type'
        const genericEntitlement: GenericEntitlement = {
            id: 'id_123',
            name: 'name_123',
        }

        // Act
        const result = genericEntitlement2StdEntitlementListOutput(type, genericEntitlement)

        // Assert
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
        // Arrange
        const type = 'role'
        const genericEntitlement: GenericEntitlement = {
            id: 'admin',
            name: 'admin',
        }

        // Act
        const result = genericEntitlement2StdEntitlementListOutput(type, genericEntitlement)

        // Assert
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

describe('parents2children', () => {
    it('should return an empty map if parents array is empty', () => {
        const parents: SearchDocument[] = []
        const result = parents2children(parents, 'accessprofiles')
        expect(result).toBeInstanceOf(Map)
        expect(result.size).toBe(0)
    })

    it('should return an empty map if parent_type is undefined', () => {
        const parents = [{ id: 'p1', name: 'parent1' }] as any as SearchDocument[]
        const result = parents2children(parents, 'accessprofiles')
        expect(result.size).toBe(0)
    })

    it('should return an empty map if attribute for type is not found', () => {
        const parents = [{ _type: 'role', id: 'p1', name: 'parent1' }] as any as SearchDocument[]
        // 'unknown_type' does not exist in PARENTCHILD_ATTRIBUTES['role']
        const result = parents2children(parents, 'unknown_type')
        expect(result.size).toBe(0)
    })

    it('should correctly map children to parents when attribute is not access', () => {
        // PARENTCHILD_ATTRIBUTES.role.accessprofiles -> 'accessProfiles'
        const parents = [
            {
                _type: 'role',
                id: 'role1',
                accessProfiles: [{ id: 'ap1' }, { id: 'ap2' }],
            },
            {
                _type: 'role',
                id: 'role2',
                accessProfiles: [{ id: 'ap2' }, { id: 'ap3' }],
            },
        ] as any as SearchDocument[]

        const result = parents2children(parents, 'accessprofiles')

        expect(result.size).toBe(3)
        expect(result.get('ap1')).toEqual(new Set(['role1']))
        expect(result.get('ap2')).toEqual(new Set(['role1', 'role2']))
        expect(result.get('ap3')).toEqual(new Set(['role2']))
    })

    it('should map and filter children when attribute is access', () => {
        // PARENTCHILD_ATTRIBUTES.identity.roles -> 'access'
        // TYPES.roles -> 'ROLE'
        const parents = [
            {
                _type: 'identity',
                id: 'identity1',
                access: [
                    { id: 'role1', type: 'ROLE' },
                    { id: 'ap1', type: 'ACCESS_PROFILE' },
                    { id: 'role2', type: 'ROLE' },
                ],
            },
            {
                _type: 'identity',
                id: 'identity2',
                access: [
                    { id: 'role2', type: 'ROLE' },
                    { id: 'ap2', type: 'ACCESS_PROFILE' },
                ],
            },
        ] as any as SearchDocument[]

        const result = parents2children(parents, 'roles')

        expect(result.size).toBe(2)
        expect(result.get('role1')).toEqual(new Set(['identity1']))
        expect(result.get('role2')).toEqual(new Set(['identity1', 'identity2']))
        expect(result.has('ap1')).toBeFalsy()
        expect(result.has('ap2')).toBeFalsy()
    })
})
