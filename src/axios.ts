import { IAxiosRetryConfig } from 'axios-retry'
import { REQUESTSPERSECOND, RETRIES } from './data/constants'
import { logger } from '@sailpoint/connector-sdk'
import axiosRetry from 'axios-retry'
import { toLogString } from './logging'

export const retriesConfig: IAxiosRetryConfig = {
    retries: RETRIES,
    retryDelay: (retryCount, error) => {
        if (error.response?.headers) {
            const retryAfter = Number(error.response.headers['retry-after'])
            if (retryAfter > 0) return Math.min(retryAfter * 1000, 300000)
        }
        return Math.min(1000 * Math.pow(2, retryCount - 1), 30000)
    },
    retryCondition: (error) => {
        return axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error) || error.response?.status === 429
    },
    onRetry: (retryCount, error, requestConfig) => {
        const is429 = error.response?.status === 429
        const logFn = is429 ? logger.warn : logger.error
        logFn.call(
            logger,
            `axios onRetry: Retrying API [${requestConfig.url}] due to [${
                is429 ? '429 rate limit' : toLogString(error)
            }]. Retry number [${retryCount}]`
        )
    },
}

export const throttleConfig = { requestsPerSecond: REQUESTSPERSECOND }
