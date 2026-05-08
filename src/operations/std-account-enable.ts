import { StdAccountEnableHandler, logger } from '@sailpoint/connector-sdk'
import { AccountService } from '../services/account-service'
import { AttributeService } from '../services/attribute-service'
import { OperationService } from '../services/operation-service'
import { opEnd, opStart, toLogString } from '../logging'

export function createStdAccountEnable(
    accountService: AccountService,
    attributeService: AttributeService,
    operationService: OperationService,
): StdAccountEnableHandler {
    return async (context, input, res) => {
        opStart('stdAccountEnable', input)
        logger.debug(`Enabling account ${input.identity}`)
        const attribute = 'status'
        const value = 'Active'
        const operation = 'enable'
        logger.info(toLogString(input))
        let account = await accountService.getAccount(input.identity, input.schema)
        await attributeService.setAttribute(account, attribute, value)

        if (account) {
            account = await operationService.processOperation(account, operation, input.schema)
            res.send(account)
            opEnd('stdAccountEnable', account)
        }
    }
}
