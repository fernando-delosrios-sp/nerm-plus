import { ConnectorError, StdAccountListOutput, StdAccountUpdateHandler, logger } from '@sailpoint/connector-sdk'
import { ConnectorContext } from '../connector-context'
import { AccountService } from '../services/account-service'
import { AttributeService } from '../services/attribute-service'
import { EntitlementService } from '../services/entitlement-service'
import { OperationService } from '../services/operation-service'
import { SchemaService } from '../services/schema-service'
import { opEnd, opStart, toLogString } from '../logging'

export function createStdAccountUpdate(
    ctx: ConnectorContext,
    accountService: AccountService,
    attributeService: AttributeService,
    entitlementService: EntitlementService,
    operationService: OperationService,
    schemaService: SchemaService
): StdAccountUpdateHandler {
    return async (context, input, res) => {
        opStart('stdAccountUpdate', input)
        logger.debug(`Updating account ${input.identity} with changes: ${toLogString(input.changes)}`)
        const operations = ['update']
        logger.info(toLogString(input))
        if (!input.schema) {
            const schema = await schemaService.getSchema()
            input.schema = schema
        }

        if (input.changes) {
            let wait = false
            let account = await accountService.getAccount(input.identity, input.schema)
            const types = account.attributes.types as string[]
            account.attributes.roles = account.attributes.roles ?? []
            const roles = account.attributes.roles as string[]
            const isProfile = ctx.config.account_type === 'Profile'
            let isUser = types.includes('NeprofileUser') || types.includes('NeaccessUser') || roles.length > 0
            let accountReloadNeeded = false
            const typePromises: Promise<any>[] = []
            const otherPromises: Promise<any>[] = []

            for (const change of input.changes) {
                const values = [change.value].flat()
                for (const value of values) {
                    if (change.attribute === 'types') {
                        typePromises.push(
                            (async () => {
                                if (change.op === 'Add') {
                                    if (value !== 'Profile') {
                                        await entitlementService.addType(account, value)
                                        accountReloadNeeded = true
                                    } else {
                                        await entitlementService.addType(account, value)
                                    }
                                } else if (change.op === 'Remove') {
                                    await entitlementService.removeType(account, value)
                                }
                            })().catch((e: any) => e)
                        )
                    } else {
                        otherPromises.push(
                            (async () => {
                                switch (change.op) {
                                    case 'Add':
                                        switch (change.attribute) {
                                            case 'roles':
                                                if (isUser) {
                                                    await entitlementService.addRole(account, value)
                                                }
                                                break
                                            case 'workflows':
                                                if (isProfile) {
                                                    wait =
                                                        ctx.config.workflows?.find((x: any) => x.workflow === value)
                                                            ?.wait || wait
                                                    await entitlementService.addWorkflow(account, value, wait)
                                                }
                                                break
                                            default:
                                                const entitlementSchema = input.schema?.attributes.find(
                                                    (x: any) => x.name === change.attribute && x.schemaObjectType
                                                )
                                                if (entitlementSchema && isProfile) {
                                                    operations.push(entitlementSchema.schemaObjectType as string)
                                                    await attributeService.profileAttributeOp(
                                                        account,
                                                        change.attribute,
                                                        change.value,
                                                        'add'
                                                    )
                                                } else {
                                                    throw new ConnectorError(
                                                        `"${change.attribute}" entitlement attribute not supported`
                                                    )
                                                }
                                        }
                                        break
                                    case 'Remove':
                                        switch (change.attribute) {
                                            case 'roles':
                                                await entitlementService.removeRole(account, value)
                                                break
                                            case 'workflows':
                                                await entitlementService.removeWorkflow(account, value)
                                                break
                                            default:
                                                if (
                                                    input.schema?.attributes.find(
                                                        (x: any) => x.name === change.attribute && x.schemaObjectType
                                                    )
                                                ) {
                                                    await attributeService.profileAttributeOp(
                                                        account,
                                                        change.attribute,
                                                        change.value,
                                                        'remove'
                                                    )
                                                } else {
                                                    throw new ConnectorError(
                                                        `"${change.attribute}" entitlement attribute not supported`
                                                    )
                                                }
                                        }
                                        break
                                    case 'Set':
                                        await attributeService.setAttribute(account, change.attribute, value)
                                }
                            })().catch((e: any) => e)
                        )
                    }
                }
            }

            const typeResults = await Promise.all(typePromises)
            typeResults.forEach((res) => {
                if (res instanceof Error) throw res
            })

            if (accountReloadNeeded) {
                account = await accountService.getAccount(input.identity, input.schema)
                isUser = true
            }

            const otherResults = await Promise.all(otherPromises)
            otherResults.forEach((res) => {
                if (res instanceof Error) throw res
            })

            if (account) {
                const accounts = await Promise.all(
                    operations.map((operation) =>
                        operationService.processOperation(account as StdAccountListOutput, operation, input.schema)
                    )
                )
                account = accounts.find((a) => a !== account) || account
                if (wait) {
                    account = await accountService.getAccount(account.identity as string, input.schema)
                }
                res.send(account)
                opEnd('stdAccountUpdate', account)
            }
        }
    }
}
