// Logging helpers

import { logger } from '@sailpoint/connector-sdk'

const isSensitiveKey = (key: string): boolean => {
    const lower = key.toLowerCase()
    return (
        lower.includes('password') ||
        lower.includes('token') ||
        lower.includes('secret') ||
        lower.includes('authorization') ||
        lower.includes('api_key') ||
        lower.includes('apikey')
    )
}

const redact = (obj: any, seen: WeakSet<any> = new WeakSet()): any => {
    if (obj == null) return obj

    if (typeof obj === 'string') {
        const str = obj.trim()
        if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
            try {
                const parsed = JSON.parse(str)
                return JSON.stringify(redact(parsed, seen))
            } catch (e) {
                return obj
            }
        }
        return obj
    }

    if (typeof obj !== 'object') return obj
    if (seen.has(obj)) return '[CIRCULAR]'
    seen.add(obj)

    if (Array.isArray(obj)) return obj.map((item) => redact(item, seen))

    const redacted: any = { ...obj }
    for (const key in redacted) {
        if (Object.prototype.hasOwnProperty.call(redacted, key)) {
            if (isSensitiveKey(key)) {
                redacted[key] = '[REDACTED]'
            } else if (typeof redacted[key] === 'object' || typeof redacted[key] === 'string') {
                redacted[key] = redact(redacted[key], seen)
            }
            // Handling changes array specific format: { attribute: 'password', value: 'secret' }
            if (key === 'changes' && Array.isArray(redacted[key])) {
                redacted[key] = redacted[key].map((change: any) => {
                    if (change && change.attribute && isSensitiveKey(change.attribute)) {
                        return { ...change, value: '[REDACTED]' }
                    }
                    return change
                })
            }
        }
    }
    return redacted
}

export const toLogString = (value: any): string => {
    if (typeof value === 'string') {
        const redacted = redact(value)
        return typeof redacted === 'string' ? redacted : JSON.stringify(redacted)
    }
    try {
        return JSON.stringify(redact(value))
    } catch {
        return String(value)
    }
}
export const fnLog = (fnName: string, message: string) => `  ${fnName}: ${message}`
export const opStart = (opName: string, input: unknown) => logger.info(`START ${opName} input=${toLogString(input)}`)
export const opEnd = (opName: string, output: unknown) => logger.info(`END ${opName} output=${toLogString(output)}`)
