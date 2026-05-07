import { getAttribute } from '../src/utils'

describe('getAttribute', () => {
    it('should return top level attribute', () => {
        expect(getAttribute({ a: 1 }, 'a')).toBe(1)
    })

    it('should return nested attribute', () => {
        expect(getAttribute({ a: { b: 2 } }, 'a.b')).toBe(2)
    })

    it('should return deep nested attribute', () => {
        expect(getAttribute({ a: { b: { c: { d: 3 } } } }, 'a.b.c.d')).toBe(3)
    })

    it('should handle missing attributes', () => {
        expect(getAttribute({ a: 1 }, 'b')).toBeUndefined()
    })

    it('should handle missing nested attributes', () => {
        expect(getAttribute({ a: { b: 1 } }, 'a.c.d')).toBeUndefined()
    })
})
