import { ConnectorError, logger, StdTestConnectionHandler } from '@sailpoint/connector-sdk'
import { ConnectorContext } from '../connector-context'
import { SchemaService } from '../services/schema-service'
import { fnLog, opEnd, opStart, toLogString } from '../logging'

export function createStdTestConnection(
    ctx: ConnectorContext,
    schemaService: SchemaService
): StdTestConnectionHandler {
    return async (context, input, res) => {
        opStart('stdTestConnection', input)
        logger.debug(fnLog('stdTestConnection', 'Testing connection'))
        try {
            await schemaService.testConnection()
            res.send({})
            opEnd('stdTestConnection', {})
        } catch (error) {
            logger.error(`stdTestConnection error=${toLogString(error)}`)
            throw new ConnectorError(error as string)
        }
    }
}
