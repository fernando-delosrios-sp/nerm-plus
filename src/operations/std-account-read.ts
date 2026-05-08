import { logger, StdAccountReadHandler } from '@sailpoint/connector-sdk'
import { AccountService } from '../services/account-service'
import { SchemaService } from '../services/schema-service'
import { opEnd, opStart, toLogString } from '../logging'

export function createStdAccountRead(
    accountService: AccountService,
    schemaService: SchemaService
): StdAccountReadHandler {
    return async (context, input, res) => {
        opStart('stdAccountRead', input)
        logger.info(toLogString(input))
        if (!input.schema) {
            const schema = await schemaService.getSchema()
            input.schema = schema
        }
        const account = await accountService.getAccount(input.identity, input.schema)
        res.send(account)
        opEnd('stdAccountRead', account)
    }
}
