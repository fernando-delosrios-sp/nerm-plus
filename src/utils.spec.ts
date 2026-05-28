import { entity2profile, parents2children } from './utils'
import { SearchDocument } from 'sailpoint-api-client'
import { Mapping } from './model/config'

describe('entity2profile', () => {
    it('maps basic attributes and conf.id correctly', () => {
        const entity: SearchDocument = {
            id: 'doc123',
            name: 'John Doe',
            enabled: true,
        }

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
            ...entity,
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
        const entity: SearchDocument = {
            id: 'doc456',
            name: 'Jane Smith',
            enabled: true,
        }

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
            ...entity,
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
            const entity = { id: '1', name: 'Test', enabled: true, inactive: true } // enabled takes precedence in the check or inactive doesn't matter if enabled is true
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
            expect(result.status).toBe('Active') // !undefined is true -> 'Active'
        })
    })
})

describe('parents2children', () => {
    it('returns empty map for empty parents array', () => {
        const result = parents2children([], 'roles')
        expect(result).toBeInstanceOf(Map)
        expect(result.size).toBe(0)
    })

    it('returns empty map if parent_type is undefined', () => {
        const result = parents2children([{ id: '1' } as any], 'roles')
        expect(result.size).toBe(0)
    })

    it('returns empty map for unsupported type combination (attribute undefined)', () => {
        const result = parents2children([{ _type: 'entitlement', id: '1' } as any], 'roles')
        expect(result.size).toBe(0)
    })

    it('filters children by type when attribute is access (identity -> roles)', () => {
        const parents = [
            {
                _type: 'identity',
                id: 'id1',
                access: [
                    { id: 'role1', type: 'ROLE' },
                    { id: 'ap1', type: 'ACCESS_PROFILE' },
                ],
            },
        ] as any[]

        const result = parents2children(parents, 'roles')
        expect(result.size).toBe(1)
        expect(result.has('role1')).toBe(true)
        expect(result.get('role1')).toEqual(new Set(['id1']))
        expect(result.has('ap1')).toBe(false)
    })

    it('maps correctly without filtering when attribute is not access (role -> accessprofiles)', () => {
        const parents = [
            {
                _type: 'role',
                id: 'role1',
                accessProfiles: [{ id: 'ap1' }, { id: 'ap2' }],
            },
        ] as any[]

        const result = parents2children(parents, 'accessprofiles')
        expect(result.size).toBe(2)
        expect(result.get('ap1')).toEqual(new Set(['role1']))
        expect(result.get('ap2')).toEqual(new Set(['role1']))
    })

    it('groups multiple parents sharing the same children', () => {
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
        ] as any[]

        const result = parents2children(parents, 'accessprofiles')
        expect(result.size).toBe(3)
        expect(result.get('ap1')).toEqual(new Set(['role1']))
        expect(result.get('ap2')).toEqual(new Set(['role1', 'role2']))
        expect(result.get('ap3')).toEqual(new Set(['role2']))
    })
})
