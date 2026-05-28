import { profile2Entitlement, entity2profile } from '../utils'

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

describe('entity2profile', () => {
    const mockConf = {
        id: 'user_id',
        mapping: {
            firstName: 'attributes.givenName',
            lastName: 'attributes.familyName',
            department: 'department',
        },
        index: 'identities' as const,
        search: '*',
        profile: 'User Profile',
        sync: true,
    }

    it('should correctly map an active search document (enabled = true)', () => {
        const mockEntity = {
            id: 'u123',
            name: 'john.doe',
            enabled: true,
            attributes: {
                givenName: 'John',
                familyName: 'Doe',
            },
            department: 'Engineering',
        } as any

        const result = entity2profile(mockEntity, 'ProfileType', mockConf)

        expect(result).toEqual({
            profile_type_id: 'ProfileType',
            status: 'Active',
            name: 'john.doe',
            attributes: {
                firstName: 'John',
                lastName: 'Doe',
                department: 'Engineering',
                user_id: 'u123',
            },
        })
    })

    it('should correctly map an inactive search document (inactive = true)', () => {
        const mockEntity = {
            id: 'u456',
            name: 'jane.doe',
            inactive: true,
            attributes: {
                givenName: 'Jane',
                familyName: 'Doe',
            },
            department: 'Sales',
        } as any

        const result = entity2profile(mockEntity, 'ProfileType', mockConf)

        expect(result).toEqual({
            profile_type_id: 'ProfileType',
            status: 'Inactive',
            name: 'jane.doe',
            attributes: {
                firstName: 'Jane',
                lastName: 'Doe',
                department: 'Sales',
                user_id: 'u456',
            },
        })
    })

    it('should correctly map an active search document (inactive = false)', () => {
        const mockEntity = {
            id: 'u789',
            name: 'bob.smith',
            inactive: false,
            attributes: {
                givenName: 'Bob',
                familyName: 'Smith',
            },
            department: 'Marketing',
        } as any

        const result = entity2profile(mockEntity, 'ProfileType', mockConf)

        expect(result).toEqual({
            profile_type_id: 'ProfileType',
            status: 'Active',
            name: 'bob.smith',
            attributes: {
                firstName: 'Bob',
                lastName: 'Smith',
                department: 'Marketing',
                user_id: 'u789',
            },
        })
    })

    it('should default to Active when both enabled and inactive flags are missing', () => {
        const mockEntity = {
            id: 'u101',
            name: 'alice.jones',
            attributes: {
                givenName: 'Alice',
                familyName: 'Jones',
            },
            department: 'HR',
        } as any

        const result = entity2profile(mockEntity, 'ProfileType', mockConf)

        expect(result).toEqual({
            profile_type_id: 'ProfileType',
            status: 'Active',
            name: 'alice.jones',
            attributes: {
                firstName: 'Alice',
                lastName: 'Jones',
                department: 'HR',
                user_id: 'u101',
            },
        })
    })

    it('should set undefined for mapped attributes not present in the search document', () => {
        const mockEntity = {
            id: 'u202',
            name: 'incomplete.user',
            enabled: true,
            attributes: {
                givenName: 'Incomplete',
            },
        } as any

        const result = entity2profile(mockEntity, 'ProfileType', mockConf)

        expect(result).toEqual({
            profile_type_id: 'ProfileType',
            status: 'Active',
            name: 'incomplete.user',
            attributes: {
                firstName: 'Incomplete',
                lastName: undefined,
                department: undefined,
                user_id: 'u202',
            },
        })
    })
})
