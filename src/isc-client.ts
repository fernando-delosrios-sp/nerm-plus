import {
    Configuration,
    ConfigurationParameters,
    Index,
    Paginator,
    PublicIdentitiesConfigApi,
    PublicIdentityConfig,
    Schema,
    Search,
    SearchApi,
    SearchDocument,
    SourcesApi,
    SourcesApiCreateSourceSchemaRequest,
} from 'sailpoint-api-client'
import { TOKEN_URL_PATH } from './data/constants'
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

    // ⚡ Bolt: Cache sources and schemas to prevent redundant API calls during operations
    // Impact: Avoids N+1 network requests by reusing the same promise for static data
    private sourcesPromise?: Promise<any[]>
    private schemasPromise: Map<string, Promise<Schema[]>> = new Map()

    async listSources() {
        if (!this.sourcesPromise) {
            const api = new SourcesApi(this.config)
            this.sourcesPromise = Paginator.paginate(api, api.listSources).then((response) => response.data)
        }
        return this.sourcesPromise
    }

    async listSourceSchemas(sourceId: string): Promise<Schema[]> {
        if (!this.schemasPromise.has(sourceId)) {
            const api = new SourcesApi(this.config)
            this.schemasPromise.set(
                sourceId,
                api.getSourceSchemas({ sourceId }).then((response) => response.data)
            )
        }
        return this.schemasPromise.get(sourceId)!
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

    async search(query: string, index: Index): Promise<SearchDocument[]> {
        const api = new SearchApi(this.config)
        const search: Search = {
            indices: [index],
            query: {
                query,
            },
            sort: ['id'],
            includeNested: true,
        }

        const response = await Paginator.paginateSearchApi(api, search)
        return response.data as SearchDocument[]
    }
}
