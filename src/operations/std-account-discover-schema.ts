import { ConnectorError, logger, StdAccountDiscoverSchemaHandler } from '@sailpoint/connector-sdk'
import { ConnectorContext } from '../connector-context'
import { SchemaService } from '../services/schema-service'
import { fnLog, opEnd, opStart, toLogString } from '../logging'

export function createStdAccountDiscoverSchema(
    ctx: ConnectorContext,
    schemaService: SchemaService
): StdAccountDiscoverSchemaHandler {
    return async (context, input, res) => {
        opStart('stdAccountDiscoverSchema', input)
        logger.debug(fnLog('stdAccountDiscoverSchema', 'Discovering account schema'))
        try {
            const schema = await schemaService.discoverSchema()
            res.send(schema)
            opEnd('stdAccountDiscoverSchema', schema)
        } catch (error) {
            logger.error(`stdAccountDiscoverSchema error=${toLogString(error)}`)
            throw new ConnectorError(error as string)
        }
    }
}
