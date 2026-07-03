import { StdAccountListHandler, logger } from '@sailpoint/connector-sdk'
import { ConnectorContext } from '../connector-context'
import { AccountService } from '../services/account-service'
import { SchemaService } from '../services/schema-service'
import { PushService } from '../services/push-service'
import { ACCOUNT_CONCURRENCY, PROCESSINGWAIT } from '../data/constants'
import { fnLog, opEnd, opStart, toLogString } from '../logging'

export function createStdAccountList(
    ctx: ConnectorContext,
    accountService: AccountService,
    schemaService: SchemaService,
    pushService: PushService
): StdAccountListHandler {
    return async (context, input, res) => {
        opStart('stdAccountList', input)
        logger.debug(fnLog('stdAccountList', 'Listing accounts'))
        const interval = setInterval(() => {
            res.keepAlive()
        }, PROCESSINGWAIT)

        try {
            if (!input.schema) {
                const schema = await schemaService.getSchema()
                input.schema = schema
            }

            const processAccountBatch = async (items: any[]) => {
                const results = await Promise.allSettled(
                    items.map((item) => accountService.buildAccount(item, input.schema))
                )
                for (const result of results) {
                    if (result.status === 'fulfilled') {
                        res.send(result.value)
                    } else {
                        logger.error(result.reason)
                    }
                }
            }

            const listAndProcess = async (source: AsyncGenerator<any>) => {
                let batch: any[] = []
                const inFlight = new Set<Promise<any>>()
                const MAX_CONCURRENT_BATCHES = 5
                const errors: any[] = []

                for await (const item of source) {
                    batch.push(item)
                    if (batch.length >= ACCOUNT_CONCURRENCY) {
                        const currentBatch = batch
                        batch = []

                        // ⚡ Bolt: Decouple stream consumption from batch processing by running batches concurrently.
                        // Enforce backpressure using a Set of in-flight promises and Promise.race().
                        const p = processAccountBatch(currentBatch)
                            .catch((err: any) => errors.push(err))
                            .finally(() => inFlight.delete(p))
                        inFlight.add(p)

                        if (inFlight.size >= MAX_CONCURRENT_BATCHES) {
                            await Promise.race(inFlight)
                            if (errors.length > 0) throw errors[0]
                        }
                    }
                }
                if (batch.length > 0) {
                    const p = processAccountBatch(batch)
                        .catch((err: any) => errors.push(err))
                        .finally(() => inFlight.delete(p))
                    inFlight.add(p)
                }

                if (inFlight.size > 0) {
                    await Promise.all(inFlight)
                }
                if (errors.length > 0) throw errors[0]
            }

            await listAndProcess(await accountService.listAccounts())

            if (ctx.config.push_mode) {
                await pushService.pushContents(context, input, res)
            }
        } catch (error) {
            logger.error(`stdAccountList error=${toLogString(error)}`)
        } finally {
            clearInterval(interval)
            opEnd('stdAccountList', 'stream')
        }
    }
}
