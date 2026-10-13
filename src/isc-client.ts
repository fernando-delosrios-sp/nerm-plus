import {
    Configuration,
    ConfigurationParameters,
    Paginator,
    PublicIdentitiesConfigApi,
    SearchApi,
    SourcesApi,
} from 'sailpoint-api-client'
import type { Index, Search } from 'sailpoint-api-client/search/api'
import type { PublicIdentityConfig } from 'sailpoint-api-client/public_identities_config/api'
import type { Schema, Source, SourcesApiCreateSourceSchemaV1Request } from 'sailpoint-api-client/sources/api'
import type { SearchDocument } from './utils'
import { TOKEN_URL_PATH } from './data/constants'
import axios, { AxiosInstance } from 'axios'
import axiosRetry from 'axios-retry'
import { applyThrottle, retriesConfig } from './axios'
import { Config } from './model/config'

const TOKEN_REFRESH_SKEW_SECONDS = 60

/**
 * The SDK fetches this token with a dynamic require("form-data"). ncc turns that
 * require into an empty context, so `new FormData()` crashes inside the connector.
 * Supplying accessToken skips that path.
 */
export function createAccessTokenProvider(
    http: Pick<AxiosInstance, 'post'>,
    tokenUrl: string,
    clientId: string,
    clientSecret: string
): () => Promise<string> {
    let cached: { token: string; expiresAt: number } | undefined
    let pending: Promise<string> | undefined

    return () => {
        if (cached && cached.expiresAt > Date.now()) {
            return Promise.resolve(cached.token)
        }
        if (!pending) {
            pending = http
                .post(
                    tokenUrl,
                    new URLSearchParams({
                        grant_type: 'client_credentials',
                        client_id: clientId,
                        client_secret: clientSecret,
                    }).toString(),
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                )
                .then((response) => {
                    const expiresIn = Number(response.data?.expires_in) || 3600
                    const ttlSeconds = Math.max(expiresIn - TOKEN_REFRESH_SKEW_SECONDS, 1)
                    cached = {
                        token: response.data.access_token,
                        expiresAt: Date.now() + ttlSeconds * 1000,
                    }
                    return cached.token
                })
                .finally(() => {
                    pending = undefined
                })
        }
        return pending
    }
}

export class ISCClient {
    private config: Configuration

    constructor(config: Config) {
        const tokenUrl = new URL(config.isc_baseurl).origin + TOKEN_URL_PATH
        const http = axios.create()
        axiosRetry(http, retriesConfig)
        applyThrottle(http)

        const conf: ConfigurationParameters = {
            baseurl: config.isc_baseurl,
            clientId: config.isc_clientId,
            clientSecret: config.isc_clientSecret,
            tokenUrl,
            accessToken: createAccessTokenProvider(http, tokenUrl, config.isc_clientId, config.isc_clientSecret),
        }
        this.config = new Configuration(conf)
        this.config.axiosInstance = http as typeof this.config.axiosInstance
    }

    async getPublicIdentityConfig(): Promise<PublicIdentityConfig> {
        const api = new PublicIdentitiesConfigApi(this.config)

        const response = await api.getPublicIdentityConfigV1()

        return response.data
    }

    async listSources(): Promise<Source[]> {
        const api = new SourcesApi(this.config)

        const response = await Paginator.paginate(api, api.listSourcesV1)

        return response.data
    }

    async listSourceSchemas(sourceId: string): Promise<Schema[]> {
        const api = new SourcesApi(this.config)

        const response = await api.getSourceSchemasV1({ sourceId })

        return response.data
    }

    async createSchema(schema: Schema, sourceId: string): Promise<Schema> {
        const api = new SourcesApi(this.config)

        const requestParameters: SourcesApiCreateSourceSchemaV1Request = {
            schema,
            sourceId,
        }

        const response = await api.createSourceSchemaV1(requestParameters)

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
