import {
    Configuration,
    ConfigurationParameters,
    Paginator,
    PublicIdentitiesConfigApi,
    PublicIdentityConfig,
    Schema,
    SourcesApi,
    SourcesApiCreateSourceSchemaRequest,
} from 'sailpoint-api-client'
import { TOKEN_URL_PATH } from './constants'
import axios from 'axios'
import axiosThrottle from 'axios-request-throttle'
import { retriesConfig, throttleConfig } from './axios'
import { Config } from './model/config'

export class ISCClient {
    private config: Configuration

    constructor(config: Config) {
        const conf: ConfigurationParameters = {
            baseurl: config.isc_baseurl,
            clientId: config.isc_clientId,
            clientSecret: config.isc_clientSecret,
            tokenUrl: new URL(config.isc_baseurl).origin + TOKEN_URL_PATH,
        }
        this.config = new Configuration(conf)
        this.config.retriesConfig = retriesConfig
        axiosThrottle.use(axios, throttleConfig)
    }

    async getPublicIdentityConfig(): Promise<PublicIdentityConfig> {
        const api = new PublicIdentitiesConfigApi(this.config)

        const response = await api.getPublicIdentityConfig()

        return response.data
    }

    async listSources() {
        const api = new SourcesApi(this.config)

        const response = await Paginator.paginate(api, api.listSources)

        return response.data
    }

    async listSourceSchemas(sourceId: string): Promise<Schema[]> {
        const api = new SourcesApi(this.config)

        const response = await api.getSourceSchemas({ sourceId })

        return response.data
    }

    async createSchema(schema: Schema, sourceId: string): Promise<Schema> {
        const api = new SourcesApi(this.config)

        const requestParameters: SourcesApiCreateSourceSchemaRequest = {
            schema,
            sourceId,
        }

        const response = await api.createSourceSchema(requestParameters)

        return response.data
    }
}
