import { genericEntitlement2StdEntitlementListOutput } from '../src/utils'
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
