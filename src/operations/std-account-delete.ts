import { StdAccountDeleteHandler, logger } from '@sailpoint/connector-sdk'
import { AccountService } from '../services/account-service'
import { OperationService } from '../services/operation-service'
import { opEnd, opStart, toLogString } from '../logging'

const send = <T>(res: { send(output: T): void }, output: T) => res.send(output)

export function createStdAccountDelete(
    accountService: AccountService,
    operationService: OperationService,
): StdAccountDeleteHandler {
    return async (context, input, res) => {
        opStart('stdAccountDelete', input)
        logger.debug(`Deleting account ${input.identity}`)
        const operation = 'delete'
        logger.info(toLogString(input))
        const account = await accountService.getAccount(input.identity, input.schema)
        await accountService.deleteAccount(input.identity, account.attributes.user_id as string)

        if (account) {
            await operationService.processOperation(account, operation, input.schema)
            delete account.identity
            send(res, undefined)
            opEnd('stdAccountDelete', undefined)
        }
    }
}
