import { createConnector, readConfig } from '@sailpoint/connector-sdk'
import { Config } from './model/config'
import { ConnectorContext } from './connector-context'
import { AccountService } from './services/account-service'
import { AttributeService } from './services/attribute-service'
import { EntitlementService } from './services/entitlement-service'
import { OperationService } from './services/operation-service'
import { SchemaService } from './services/schema-service'
import { PushService } from './services/push-service'
import { createStdTestConnection } from './operations/std-test-connection'
import { createStdAccountDiscoverSchema } from './operations/std-account-discover-schema'
import { createStdAccountList } from './operations/std-account-list'
import { createStdAccountRead } from './operations/std-account-read'
import { createStdAccountCreate } from './operations/std-account-create'
import { createStdAccountUpdate } from './operations/std-account-update'
import { createStdAccountEnable } from './operations/std-account-enable'
import { createStdAccountDisable } from './operations/std-account-disable'
import { createStdAccountDelete } from './operations/std-account-delete'
import { createStdEntitlementList } from './operations/std-entitlement-list'
import { createStdChangePassword } from './operations/std-change-password'
import { createPushContents } from './operations/push-contents'

export const connector = async () => {
    const config: Config = await readConfig()
    const ctx = new ConnectorContext(config)

    const schemaService = new SchemaService(ctx)
    const accountService = new AccountService(ctx)
    const attributeService = new AttributeService(ctx)
    const entitlementService = new EntitlementService(ctx, accountService, attributeService)
    const operationService = new OperationService(ctx, accountService, entitlementService)
    const pushService = new PushService(ctx)

    return createConnector()
        .stdTestConnection(createStdTestConnection(ctx, schemaService))
        .stdAccountDiscoverSchema(createStdAccountDiscoverSchema(ctx, schemaService))
        .stdAccountList(createStdAccountList(ctx, accountService, schemaService, pushService))
        .stdAccountRead(createStdAccountRead(accountService, schemaService))
        .stdEntitlementList(createStdEntitlementList(ctx, entitlementService))
        .stdAccountCreate(
            createStdAccountCreate(
                ctx,
                accountService,
                attributeService,
                entitlementService,
                operationService,
                schemaService
            )
        )
        .stdAccountUpdate(
            createStdAccountUpdate(
                ctx,
                accountService,
                attributeService,
                entitlementService,
                operationService,
                schemaService
            )
        )
        .stdAccountEnable(createStdAccountEnable(accountService, attributeService, operationService))
        .stdAccountDisable(createStdAccountDisable(accountService, attributeService, operationService))
        .stdAccountDelete(createStdAccountDelete(accountService, operationService))
        .stdChangePassword(createStdChangePassword(ctx, accountService, schemaService))
        .command('custom:push:contents', createPushContents(pushService))
}
