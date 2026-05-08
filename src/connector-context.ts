import { Config } from './model/config'
import { ISCClient } from './isc-client'
import { NERMClient } from './nerm-client'

export class ConnectorContext {
    config: Config
    isc: ISCClient
    nerm: NERMClient
    spConnectorInstanceId: string
    cachedAdminUserId?: string

    constructor(config: Config) {
        this.config = config
        this.isc = new ISCClient(config)
        this.nerm = new NERMClient(config)
        this.spConnectorInstanceId = config.spConnectorInstanceId
    }
}
