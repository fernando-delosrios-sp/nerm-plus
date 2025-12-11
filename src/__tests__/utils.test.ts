import { profile2Entitlement } from '../utils'

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

    it('should throw an error if profile.attributes is undefined but attrs are requested', () => {
        const mockProfile = {
            id: '222',
            name: 'Bad Profile',
        }
        const type = 'ProfileType'
        const attrs = ['department']

        // This will throw TypeError: Cannot read properties of undefined (reading 'department')
        expect(() => profile2Entitlement(mockProfile, type, attrs)).toThrow(TypeError)
    })
})
