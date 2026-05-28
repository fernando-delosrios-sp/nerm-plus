import { Profile } from '../../src/model/entitlement'

describe('Profile', () => {
    describe('constructor', () => {
        it('should gracefully handle errors when searching for description in attrs', () => {
            const input = {
                id: '123',
                name: 'Test Profile',
                attributes: {
                    someAttr: 'value',
                },
            }

            // Create an attrs object that has forEach but find throws an error
            const attrs: any = {
                forEach: (cb: any) => cb('someAttr'),
                // find is undefined, so attrs.find will throw a TypeError
            }

            const profile = new Profile(input, 'testType', attrs)

            expect(profile.attributes).toEqual({
                id: '123',
                name: 'Test Profile',
                someAttr: 'value',
            })
            expect(profile.identity).toBe('123')
            expect(profile.uuid).toBe('Test Profile')
            expect(profile.type).toBe('testType')
        })

        it('should correctly set description when attrs.find succeeds', () => {
            const input = {
                id: '123',
                name: 'Test Profile',
                attributes: {
                    mydescription: 'This is a description',
                },
            }

            const attrs = ['mydescription']
            const profile = new Profile(input, 'testType', attrs)

            expect(profile.attributes.description).toBe('This is a description')
        })
    })
})
