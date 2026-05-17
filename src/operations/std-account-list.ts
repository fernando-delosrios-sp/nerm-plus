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
                    // ⚡ Bolt: Pass the item directly to buildAccount instead of re-fetching by ID via getAccount.
                    // Impact: Saves one API call per account during aggregation, drastically speeding up the sync.
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
                for await (const item of source) {
                    batch.push(item)
                    if (batch.length >= ACCOUNT_CONCURRENCY) {
                        await processAccountBatch(batch)
                        batch = []
                    }
                }
                if (batch.length > 0) {
                    await processAccountBatch(batch)
                }
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
