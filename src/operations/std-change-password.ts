import { ConnectorError, StdChangePasswordHandler } from '@sailpoint/connector-sdk'
import { ConnectorContext } from '../connector-context'
import { AccountService } from '../services/account-service'
import { SchemaService } from '../services/schema-service'
import { opEnd, opStart, toLogString } from '../logging'

export function createStdChangePassword(
    ctx: ConnectorContext,
    accountService: AccountService,
    schemaService: SchemaService
): StdChangePasswordHandler {
    return async (context, input, res) => {
        opStart('stdChangePassword', input)
        try {
            let schema = (input as any).schema
            if (!schema) {
                schema = await schemaService.getSchema()
            }
            await accountService.changePassword(input.identity, input.password, schema)
            res.send({})
            opEnd('stdChangePassword', {})
        } catch (error) {
            if (error instanceof ConnectorError) {
                throw error
            }
            throw new ConnectorError(`Unable to change password: ${toLogString(error)}`)
        }
    }
}
