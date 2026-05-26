import { logger, StdAccountCreateHandler, StdAccountListOutput } from '@sailpoint/connector-sdk'
import { ConnectorContext } from '../connector-context'
import { AccountService } from '../services/account-service'
import { AttributeService } from '../services/attribute-service'
import { EntitlementService } from '../services/entitlement-service'
import { OperationService } from '../services/operation-service'
import { SchemaService } from '../services/schema-service'
import { ENTITLEMENT_ATTRIBUTES } from '../data/constants'
import { opEnd, opStart, toLogString } from '../logging'

export function createStdAccountCreate(
    ctx: ConnectorContext,
    accountService: AccountService,
    attributeService: AttributeService,
    entitlementService: EntitlementService,
    operationService: OperationService,
    schemaService: SchemaService
): StdAccountCreateHandler {
    return async (context, input, res) => {
        opStart('stdAccountCreate', input)
        logger.debug(`Creating account with input: ${toLogString(input)}`)
        const operations = ['create']
        logger.info(toLogString(input))
        if (!input.schema) {
            const schema = await schemaService.getSchema()
            input.schema = schema
        }
        let account = await accountService.createAccount(input)

        if (input.attributes.types) {
            const types = [input.attributes.types].flat()
            for (const type of types) {
                await entitlementService.addType(account, type)
            }
        }

        if (input.attributes.roles) {
            const roles = [input.attributes.roles].flat()
            for (const role of roles) {
                await entitlementService.addRole(account, role)
            }
        }

        if (input.attributes.workflows && ctx.config.account_type === 'Profile') {
            const workflows = [input.attributes.workflows].flat()
            let wait = false
            const workflowPromises = workflows.map(async (workflow) => {
                const workflowWait = ctx.config.workflows?.find((x) => x.workflow === workflow)?.wait || false
                if (workflowWait) {
                    wait = true
                }
                return entitlementService.addWorkflow(account, workflow, workflowWait)
            })
            await Promise.all(workflowPromises)

            if (wait) {
                account = await accountService.getAccount(account.identity as string, input.schema)
            }
        }

        const entitlementSchemas = input.schema?.attributes.filter(
            (x) => x.schemaObjectType && !ENTITLEMENT_ATTRIBUTES.includes(x.name)
        )
        for (const [key, value] of Object.entries(input.attributes)) {
            const entitlementSchema = entitlementSchemas.find((x) => x.name === key)
            if (entitlementSchema) {
                operations.push(entitlementSchema.schemaObjectType!)
                await attributeService.profileAttributeOp(account, key, value as any, 'add')
            }
        }

        if (account && ctx.config.account_type === 'Profile') {
            const accounts = await Promise.all(
                operations.map((operation) =>
                    operationService.processOperation(account as StdAccountListOutput, operation, input.schema)
                )
            )
            account = accounts.find((a) => a !== account) || account
            res.send(account)
            opEnd('stdAccountCreate', account)
        }
    }
}
