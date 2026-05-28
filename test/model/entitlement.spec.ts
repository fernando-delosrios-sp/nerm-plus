import { expect, describe, it } from '@jest/globals'
import { Type } from '../../src/model/entitlement'

describe('model/entitlement', () => {
    describe('Type', () => {
        it('should initialize properties correctly from input', () => {
            const input = {
                id: 'type-id-123',
                name: 'RoleType',
                description: 'A test role type',
            }

            const typeEntitlement = new Type(input)

            expect(typeEntitlement.identity).toBe('type-id-123')
            expect(typeEntitlement.uuid).toBe('RoleType')
            expect(typeEntitlement.type).toBe('type')
            expect(typeEntitlement.attributes).toEqual({
                id: 'type-id-123',
                name: 'RoleType',
                description: 'A test role type',
            })
        })

        it('should handle missing description', () => {
            const input = {
                id: 'type-id-456',
                name: 'OtherType',
            }

            const typeEntitlement = new Type(input)

            expect(typeEntitlement.identity).toBe('type-id-456')
            expect(typeEntitlement.uuid).toBe('OtherType')
            expect(typeEntitlement.type).toBe('type')
            expect(typeEntitlement.attributes).toEqual({
                id: 'type-id-456',
                name: 'OtherType',
                description: undefined,
            })
        })
    })
})
