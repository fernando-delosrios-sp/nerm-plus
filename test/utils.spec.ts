import { genericEntitlement2StdEntitlementListOutput, getRoleType } from '../src/utils'
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

describe('getRoleType', () => {
    it('should return NeprofileUser when uid ends with neprofile_role', () => {
        const role = { uid: 'some_user_neprofile_role' }
        expect(getRoleType(role)).toBe('NeprofileUser')
    })

    it('should return NeaccessUser when uid does not end with neprofile_role', () => {
        const role = { uid: 'some_user_other_role' }
        expect(getRoleType(role)).toBe('NeaccessUser')
    })

    it('should return NeaccessUser when uid is an empty string', () => {
        const role = { uid: '' }
        expect(getRoleType(role)).toBe('NeaccessUser')
    })

    it('should return NeaccessUser when uid is undefined', () => {
        const role = {}
        expect(getRoleType(role)).toBe('NeaccessUser')
    })

    it('should return NeaccessUser when uid is null', () => {
        const role = { uid: null }
        expect(getRoleType(role)).toBe('NeaccessUser')
    })
})
