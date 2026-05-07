// Logging helpers

import { logger } from '@sailpoint/connector-sdk'

const redactReplacer = (key: string, value: any) => {
    if (key === 'password') {
        return '********'
    }
    if (value && typeof value === 'object' && value.attribute === 'password' && 'value' in value) {
        return { ...value, value: '********' }
    }
    return value
}

export const toLogString = (value: any): string => {
    if (typeof value === 'string') return value
    try {
        return JSON.stringify(value, redactReplacer)
    } catch {
        return String(value)
    }
}
export const fnLog = (fnName: string, message: string) => `  ${fnName}: ${message}`
export const opStart = (opName: string, input: unknown) => logger.info(`START ${opName} input=${toLogString(input)}`)
export const opEnd = (opName: string, output: unknown) => logger.info(`END ${opName} output=${toLogString(output)}`)
