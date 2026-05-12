// Logging helpers

import { logger } from '@sailpoint/connector-sdk'

const isSensitiveKey = (key: string): boolean => {
    if (!key) return false
    const keyLower = key.toLowerCase()
    return (
        keyLower.includes('password') ||
        keyLower.includes('token') ||
        keyLower.includes('secret') ||
        keyLower.includes('authorization') ||
        keyLower.includes('api_key') ||
        keyLower.includes('apikey')
    )
}

const redact = (obj: any): any => {
    if (obj == null) return obj
    if (typeof obj !== 'object') return obj
    if (Array.isArray(obj)) return obj.map(redact)

    const redacted: any = { ...obj }
    for (const key in redacted) {
        if (Object.prototype.hasOwnProperty.call(redacted, key)) {
            if (isSensitiveKey(key)) {
                redacted[key] = '[REDACTED]'
            } else if (typeof redacted[key] === 'object') {
                redacted[key] = redact(redacted[key])
            }
            // Handling changes array specific format: { attribute: 'password', value: 'secret' }
            if (key === 'changes' && Array.isArray(redacted[key])) {
                redacted[key] = redacted[key].map((change: any) => {
                    if (change && isSensitiveKey(change.attribute)) {
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
    if (typeof value === 'string') return value
    try {
        return JSON.stringify(redact(value))
    } catch {
        return String(value)
    }
}
export const fnLog = (fnName: string, message: string) => `  ${fnName}: ${message}`
export const opStart = (opName: string, input: unknown) => logger.info(`START ${opName} input=${toLogString(input)}`)
export const opEnd = (opName: string, output: unknown) => logger.info(`END ${opName} output=${toLogString(output)}`)
