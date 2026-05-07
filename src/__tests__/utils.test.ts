import { parents2children } from '../utils'

describe('parents2children', () => {
    it('should handle empty parents array', () => {
        const result = parents2children([], 'role')
        expect(result.size).toBe(0)
    })

    it('should handle parent with unknown type gracefully', () => {
        const result = parents2children([{ _type: 'unknown' } as any], 'role')
        expect(result.size).toBe(0)
    })

    it('should map standard parent-child relation (role -> accessprofiles)', () => {
        const parents = [
            {
                _type: 'role',
                id: 'parent1',
                accessProfiles: [{ id: 'child1' }, { id: 'child2' }],
            },
        ]
        const result = parents2children(parents as any[], 'accessprofiles')
        expect(result.size).toBe(2)
        expect(result.get('child1')).toEqual(new Set(['parent1']))
        expect(result.get('child2')).toEqual(new Set(['parent1']))
    })

    it('should correctly filter children based on access attribute type (identity -> roles)', () => {
        const parents = [
            {
                _type: 'identity',
                id: 'parent1',
                access: [
                    { id: 'role1', type: 'ROLE' },
                    { id: 'ap1', type: 'ACCESS_PROFILE' },
                ],
            },
        ]
        // We look for 'roles' type, it should filter out 'ACCESS_PROFILE'
        const result = parents2children(parents as any[], 'roles')
        expect(result.size).toBe(1)
        expect(result.get('role1')).toEqual(new Set(['parent1']))
        expect(result.has('ap1')).toBeFalsy()
    })

    it('should merge parent IDs when multiple parents share the same child', () => {
        const parents = [
            {
                _type: 'role',
                id: 'parent1',
                accessProfiles: [{ id: 'child1' }],
            },
            {
                _type: 'role',
                id: 'parent2',
                accessProfiles: [{ id: 'child1' }],
            },
        ]
        const result = parents2children(parents as any[], 'accessprofiles')
        expect(result.size).toBe(1)
        expect(result.get('child1')).toEqual(new Set(['parent1', 'parent2']))
    })
})
