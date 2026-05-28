import { profile2Entitlement, mergeProfileWithConfig } from '../utils'

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

describe('mergeProfileWithConfig', () => {
    it('should overwrite profile attributes with conf attributes', () => {
        const profile = { id: '1', name: 'Test', attributes: ['old'] }
        const conf = { attributes: ['new1', 'new2'] }
        expect(mergeProfileWithConfig(profile, conf)).toEqual({
            id: '1',
            name: 'Test',
            attributes: ['new1', 'new2'],
        })
    })

    it('should default to empty attributes array if conf attributes is undefined', () => {
        const profile = { id: '2', name: 'Test2' }
        const conf = {}
        expect(mergeProfileWithConfig(profile, conf)).toEqual({
            id: '2',
            name: 'Test2',
            attributes: [],
        })
    })
})
