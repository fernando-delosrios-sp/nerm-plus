import { ISCClient } from '../src/isc-client'
import { Config } from '../src/model/config'
import { Configuration, PublicIdentitiesConfigApi, SourcesApi, SearchApi, Paginator } from 'sailpoint-api-client'
import axiosThrottle from 'axios-request-throttle'
import axios from 'axios'
import { retriesConfig, throttleConfig } from '../src/axios'
import { TOKEN_URL_PATH } from '../src/data/constants'

// Create instances to mock methods on
const mockPublicIdentityConfigApiInstance = {
    getPublicIdentityConfig: jest.fn().mockResolvedValue({ data: 'mock-public-identity-config' }),
}

const mockSourcesApiInstance = {
    listSources: jest.fn().mockResolvedValue({ data: 'mock-sources' }),
    getSourceSchemas: jest.fn().mockResolvedValue({ data: ['mock-schema-1', 'mock-schema-2'] }),
    createSourceSchema: jest.fn().mockResolvedValue({ data: 'mock-created-schema' }),
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
    })

    describe('Constructor', () => {
        it('should initialize Configuration with correct parameters and set up axios throttle', () => {
            const client = new ISCClient(config)

            expect(Configuration).toHaveBeenCalledWith({
                baseurl: config.isc_baseurl,
                clientId: config.isc_clientId,
                clientSecret: config.isc_clientSecret,
                tokenUrl: 'https://test.api.identitynow.com' + TOKEN_URL_PATH,
            })

            // Verify properties on the constructed config mock instance
            const mockConfigInstance = (Configuration as jest.Mock).mock.instances[0]
            expect(mockConfigInstance.retriesConfig).toBe(retriesConfig)

            expect(axiosThrottle.use).toHaveBeenCalledWith(axios, throttleConfig)
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
                expect(mockPublicIdentityConfigApiInstance.getPublicIdentityConfig).toHaveBeenCalledTimes(1)
                expect(result).toBe('mock-public-identity-config')
            })
        })

        describe('listSources', () => {
            it('should fetch paginated sources', async () => {
                const result = await client.listSources()

                expect(SourcesApi).toHaveBeenCalledTimes(1)
                expect(Paginator.paginate).toHaveBeenCalledWith(
                    mockSourcesApiInstance,
                    mockSourcesApiInstance.listSources
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
                expect(mockSourcesApiInstance.getSourceSchemas).toHaveBeenCalledWith({ sourceId })
                expect(result).toEqual(['mock-schema-1', 'mock-schema-2'])
            })
        })

        describe('createSchema', () => {
            it('should create a source schema', async () => {
                const schema: any = { name: 'test-schema' }
                const sourceId = 'test-source-id'
                const result = await client.createSchema(schema, sourceId)

                expect(SourcesApi).toHaveBeenCalledTimes(1)
                expect(mockSourcesApiInstance.createSourceSchema).toHaveBeenCalledWith({
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
