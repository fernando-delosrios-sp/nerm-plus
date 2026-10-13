import { ISCClient } from '../src/isc-client'
import { Config } from '../src/model/config'
import { Configuration, PublicIdentitiesConfigApi, SourcesApi, SearchApi, Paginator } from 'sailpoint-api-client'
import axiosThrottle from 'axios-request-throttle'
import axios from 'axios'
import { throttleConfig } from '../src/axios'
import { TOKEN_URL_PATH } from '../src/data/constants'

// Create instances to mock methods on
const mockPublicIdentityConfigApiInstance = {
    getPublicIdentityConfigV1: jest.fn().mockResolvedValue({ data: 'mock-public-identity-config' }),
}

const mockSourcesApiInstance = {
    listSourcesV1: jest.fn().mockResolvedValue({ data: 'mock-sources' }),
    getSourceSchemasV1: jest.fn().mockResolvedValue({ data: ['mock-schema-1', 'mock-schema-2'] }),
    createSourceSchemaV1: jest.fn().mockResolvedValue({ data: 'mock-created-schema' }),
}

const mockSearchApiInstance = {}

// Mock the external dependencies
jest.mock('sailpoint-api-client', () => {
    return {
        Configuration: jest.fn(),
        PublicIdentitiesConfigApi: jest.fn().mockImplementation(() => mockPublicIdentityConfigApiInstance),
        SourcesApi: jest.fn().mockImplementation(() => mockSourcesApiInstance),
        SearchApi: jest.fn().mockImplementation(() => mockSearchApiInstance),
        Paginator: {
            paginate: jest.fn().mockResolvedValue({ data: ['mock-paginated-source'] }),
            paginateSearchApi: jest.fn().mockResolvedValue({ data: ['mock-search-result'] }),
        },
    }
})

jest.mock('axios-request-throttle', () => ({
    use: jest.fn(),
}))

jest.mock('axios')

describe('ISCClient', () => {
    let config: Config

    beforeEach(() => {
        config = {
            isc_baseurl: 'https://test.api.identitynow.com',
            isc_clientId: 'test-client-id',
            isc_clientSecret: 'test-client-secret',
        } as Config

        jest.clearAllMocks()
        const mockHttp = {
            interceptors: {
                request: { use: jest.fn() },
                response: { use: jest.fn() },
            },
            post: jest.fn(),
        }
        ;(axios.create as jest.Mock).mockReturnValue(mockHttp)
    })

    describe('Constructor', () => {
        it('should initialize Configuration with correct parameters and set up axios throttle', () => {
            new ISCClient(config)
            const tokenUrl = 'https://test.api.identitynow.com' + TOKEN_URL_PATH
            const http = (axios.create as jest.Mock).mock.results[0].value

            expect(Configuration).toHaveBeenCalledWith({
                baseurl: config.isc_baseurl,
                clientId: config.isc_clientId,
                clientSecret: config.isc_clientSecret,
                tokenUrl,
                accessToken: expect.any(Function),
            })

            const mockConfigInstance = (Configuration as unknown as jest.Mock).mock.instances[0]
            expect(mockConfigInstance.axiosInstance).toBe(http)
            expect(axiosThrottle.use).toHaveBeenCalledWith(http, throttleConfig)
        })

        it('should fetch and cache the access token without using the SDK form-data path', async () => {
            new ISCClient(config)
            const http = (axios.create as jest.Mock).mock.results[0].value
            const accessToken = (Configuration as unknown as jest.Mock).mock.calls[0][0].accessToken as () => Promise<string>
            http.post.mockResolvedValue({ data: { access_token: 'token-1', expires_in: 3600 } })

            await expect(accessToken()).resolves.toBe('token-1')
            await expect(accessToken()).resolves.toBe('token-1')

            expect(http.post).toHaveBeenCalledTimes(1)
            expect(http.post).toHaveBeenCalledWith(
                'https://test.api.identitynow.com' + TOKEN_URL_PATH,
                'grant_type=client_credentials&client_id=test-client-id&client_secret=test-client-secret',
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            )
        })
    })

    describe('Methods', () => {
        let client: ISCClient

        beforeEach(() => {
            client = new ISCClient(config)
        })

        describe('getPublicIdentityConfig', () => {
            it('should fetch public identity config', async () => {
                const result = await client.getPublicIdentityConfig()

                expect(PublicIdentitiesConfigApi).toHaveBeenCalledTimes(1)
                expect(mockPublicIdentityConfigApiInstance.getPublicIdentityConfigV1).toHaveBeenCalledTimes(1)
                expect(result).toBe('mock-public-identity-config')
            })
        })

        describe('listSources', () => {
            it('should fetch paginated sources', async () => {
                const result = await client.listSources()

                expect(SourcesApi).toHaveBeenCalledTimes(1)
                expect(Paginator.paginate).toHaveBeenCalledWith(
                    mockSourcesApiInstance,
                    mockSourcesApiInstance.listSourcesV1
                )
                expect(result).toBeInstanceOf(Array)
                expect(result[0]).toBe('mock-paginated-source')
            })
        })

        describe('listSourceSchemas', () => {
            it('should fetch source schemas', async () => {
                const sourceId = 'test-source-id'
                const result = await client.listSourceSchemas(sourceId)

                expect(SourcesApi).toHaveBeenCalledTimes(1)
                expect(mockSourcesApiInstance.getSourceSchemasV1).toHaveBeenCalledWith({ sourceId })
                expect(result).toEqual(['mock-schema-1', 'mock-schema-2'])
            })
        })

        describe('createSchema', () => {
            it('should create a source schema', async () => {
                const schema: any = { name: 'test-schema' }
                const sourceId = 'test-source-id'
                const result = await client.createSchema(schema, sourceId)

                expect(SourcesApi).toHaveBeenCalledTimes(1)
                expect(mockSourcesApiInstance.createSourceSchemaV1).toHaveBeenCalledWith({
                    schema,
                    sourceId,
                })
                expect(result).toBe('mock-created-schema')
            })
        })

        describe('search', () => {
            it('should perform a paginated search', async () => {
                const query = 'test-query'
                const index: any = 'identities'
                const result = await client.search(query, index)

                expect(SearchApi).toHaveBeenCalledTimes(1)
                expect(Paginator.paginateSearchApi).toHaveBeenCalledWith(mockSearchApiInstance, {
                    indices: [index],
                    query: {
                        query,
                    },
                    sort: ['id'],
                    includeNested: true,
                })
                expect(result).toEqual(['mock-search-result'])
            })
        })
    })
})
