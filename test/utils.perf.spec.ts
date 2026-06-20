import { getAttribute } from '../src/utils'

describe('getAttribute', () => {
    it('returns flat property correctly', () => {
        expect(getAttribute({ a: 1 }, 'a')).toBe(1)
        expect(getAttribute({ a: 1 }, 'b')).toBeUndefined()
    })

    it('returns deep property correctly', () => {
        expect(getAttribute({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(1)
        expect(getAttribute({ a: { b: { c: 1 } } }, 'a.b.d')).toBeUndefined()
    })

    it('returns falsy values correctly', () => {
        expect(getAttribute({ a: { b: { c: 0 } } }, 'a.b.c')).toBe(0)
        expect(getAttribute({ a: { b: { c: false } } }, 'a.b.c')).toBe(false)
        expect(getAttribute({ a: { b: { c: '' } } }, 'a.b.c')).toBe('')
    })

    it('returns undefined if traversal encounters null/undefined', () => {
        expect(getAttribute({ a: { b: null } }, 'a.b.c')).toBeUndefined()
        expect(getAttribute({ a: { b: undefined } }, 'a.b.c')).toBeUndefined()
    })

    it('returns correctly for empty string key', () => {
        expect(getAttribute({ '': 5 }, '')).toBe(5)
    })

    it('returns undefined for nullish object', () => {
        expect(getAttribute(null as any, 'a.b.c')).toBeUndefined()
        expect(getAttribute(undefined as any, 'a.b.c')).toBeUndefined()
    })
})
