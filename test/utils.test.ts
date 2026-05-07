import { parents2children } from '../src/utils'
import { SearchDocument } from 'sailpoint-api-client'

describe('parents2children', () => {
    it('should return an empty map when parents array is empty', () => {
        const parents: SearchDocument[] = []
        const result = parents2children(parents, 'role')
        expect(result.size).toBe(0)
    })

    it('should handle undefined _type gracefully', () => {
        const parents = [{ id: 'parent1' }] as any as SearchDocument[]
        const result = parents2children(parents, 'role')
        expect(result.size).toBe(0)
    })

    it('should safely skip parents with missing children array', () => {
        const parents = [
            { id: 'parent1', _type: 'role' }, // missing accessProfiles
            { id: 'parent2', _type: 'role', accessProfiles: [{ id: 'child1' }] }
        ] as any as SearchDocument[]
        const result = parents2children(parents, 'accessprofiles')
        expect(result.size).toBe(1)
        expect(result.get('child1')).toEqual(new Set(['parent2']))
    })

    it('should map correctly when the attribute is not access', () => {
        const parents = [
            { id: 'parent1', _type: 'role', entitlements: [{ id: 'child1' }, { id: 'child2' }] },
            { id: 'parent2', _type: 'role', entitlements: [{ id: 'child2' }, { id: 'child3' }] }
        ] as any as SearchDocument[]
        const result = parents2children(parents, 'entitlements')
        expect(result.size).toBe(3)
        expect(result.get('child1')).toEqual(new Set(['parent1']))
        expect(result.get('child2')).toEqual(new Set(['parent1', 'parent2']))
        expect(result.get('child3')).toEqual(new Set(['parent2']))
    })

    it('should filter effectively by ACCESSTYPE_MAPPING when attribute is access', () => {
        const parents = [
            {
                id: 'identity1',
                _type: 'identity',
                access: [
                    { id: 'childRole1', type: 'ROLE' },
                    { id: 'childAccessProfile1', type: 'ACCESS_PROFILE' }
                ]
            }
        ] as any as SearchDocument[]

        // Testing mapping for roles
        const resultRoles = parents2children(parents, 'roles')
        expect(resultRoles.size).toBe(1)
        expect(resultRoles.get('childRole1')).toEqual(new Set(['identity1']))
        expect(resultRoles.has('childAccessProfile1')).toBe(false)

        // Testing mapping for access profiles
        const resultAccessProfiles = parents2children(parents, 'accessprofiles')
        expect(resultAccessProfiles.size).toBe(1)
        expect(resultAccessProfiles.get('childAccessProfile1')).toEqual(new Set(['identity1']))
        expect(resultAccessProfiles.has('childRole1')).toBe(false)
    })

    it('should correctly combine multiple parents for a single child', () => {
        const parents = [
            { id: 'identity1', _type: 'identity', access: [{ id: 'child1', type: 'ROLE' }] },
            { id: 'identity2', _type: 'identity', access: [{ id: 'child1', type: 'ROLE' }] }
        ] as any as SearchDocument[]

        const result = parents2children(parents, 'roles')
        expect(result.size).toBe(1)
        expect(result.get('child1')).toEqual(new Set(['identity1', 'identity2']))
    })
})
