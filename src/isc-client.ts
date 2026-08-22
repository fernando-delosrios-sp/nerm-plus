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
    private sourcesPromise?: Promise<any[]>
    private sourceSchemasPromises: Map<string, Promise<Schema[]>> = new Map()

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

    // ⚡ Bolt: Cache listSources results to prevent N+1 queries during schema discovery.
    // Impact: Saves repeated API calls when discovering or fetching schema, reducing execution time.
    async listSources() {
        if (!this.sourcesPromise) {
            const fetchSources = async () => {
                const api = new SourcesApi(this.config)
                const response = await Paginator.paginate(api, api.listSources)
                return response.data
            }
            this.sourcesPromise = fetchSources()
        }
        return this.sourcesPromise
    }

    // ⚡ Bolt: Cache listSourceSchemas results to prevent N+1 queries during schema discovery.
    // Impact: Saves repeated API calls per source, reducing latency and avoiding rate limits.
    async listSourceSchemas(sourceId: string): Promise<Schema[]> {
        if (!this.sourceSchemasPromises.has(sourceId)) {
            const fetchSourceSchemas = async () => {
                const api = new SourcesApi(this.config)
                const response = await api.getSourceSchemas({ sourceId })
                return response.data
            }
            this.sourceSchemasPromises.set(sourceId, fetchSourceSchemas())
        }
        return this.sourceSchemasPromises.get(sourceId)!
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
