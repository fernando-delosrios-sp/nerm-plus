import { AccountSchema, logger, StdAccountListOutput } from '@sailpoint/connector-sdk'
import { ConnectorContext } from '../connector-context'
import { AccountService } from './account-service'
import { EntitlementService } from './entitlement-service'
import { toLogString } from '../logging'

export class OperationService {
    constructor(
        private ctx: ConnectorContext,
        private accountService: AccountService,
        private entitlementService: EntitlementService
    ) {}

    async processOperation(account: StdAccountListOutput, op: string, schema?: AccountSchema) {
        logger.debug(`Processing operation ${op} for account ${account.uuid}`)
        const operation: any =
            this.ctx.config.operations?.find((x) => x.operation === op) ??
            this.ctx.config.profiles?.find((x) => x.name === op)

        if (!operation) {
            return account
        }

        const response = await this.entitlementService.runWorkflow(
            account,
            operation.workflow,
            operation.requester_id,
            operation.wait
        )

        if (response && operation.wait) {
            return await this.accountService.getAccount(account.identity as string, schema)
        }

        return account
    }
}
