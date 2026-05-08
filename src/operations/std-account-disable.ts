import { StdAccountDisableHandler, logger } from '@sailpoint/connector-sdk'
import { AccountService } from '../services/account-service'
import { AttributeService } from '../services/attribute-service'
import { OperationService } from '../services/operation-service'
import { opEnd, opStart, toLogString } from '../logging'

export function createStdAccountDisable(
    accountService: AccountService,
    attributeService: AttributeService,
    operationService: OperationService,
): StdAccountDisableHandler {
    return async (context, input, res) => {
        opStart('stdAccountDisable', input)
        logger.debug(`Disabling account ${input.identity}`)
        const attribute = 'status'
        const value = 'Inactive'
        const operation = 'disable'
        logger.info(toLogString(input))
        let account = await accountService.getAccount(input.identity, input.schema)
        await attributeService.setAttribute(account, attribute, value)

        if (account) {
            account = await operationService.processOperation(account, operation, input.schema)
            res.send(account)
            opEnd('stdAccountDisable', account)
        }
    }
}
