import { jest, expect, describe, it, beforeEach, afterEach } from '@jest/globals'
import { NERMClient } from '../src/nerm-client'
import axios from 'axios'
import nock from 'nock'

jest.mock('axios-cache-interceptor', () => ({
    setupCache: jest.fn().mockImplementation((client: any) => client),
}))
jest.mock('axios-request-throttle')
jest.mock('axios-retry')
jest.mock('@sailpoint/connector-sdk', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}))

describe('NERMClient', () => {
    let client: NERMClient
    const mockConfig = {
        nerm_baseurl: 'https://api.example.com',
        nerm_token: 'test-token',
        spConnectorInstanceId: 'test-instance',
    }

    beforeEach(() => {
        client = new NERMClient(mockConfig)
    })

    afterEach(() => {
        nock.cleanAll()
        jest.clearAllMocks()
    })

    it('should assign baseURL and headers correctly in baseConfig', () => {
        const axiosSpy = jest.spyOn(axios, 'create')
        new NERMClient(mockConfig)

        expect(axiosSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                baseURL: mockConfig.nerm_baseurl,
                headers: {
                    Authorization: `Bearer ${mockConfig.nerm_token}`,
                    Accept: 'application/json',
                },
            })
        )
    })

    it('should initialize correctly', () => {
        expect(client).toBeDefined()
    })

    describe('getProfile', () => {
        it('should fetch a profile by ID', async () => {
            const profileMock = { id: '123', name: 'Test Profile' }

            nock('https://api.example.com').get('/profiles/123').reply(200, { profile: profileMock })

            const result = await client.getProfile('123')
            expect(result).toEqual(profileMock)
        })
    })

    describe('listProfiles', () => {
        it('should yield profiles from the API generator', async () => {
            const profilesMock = [
                { id: '1', name: 'Profile 1' },
                { id: '2', name: 'Profile 2' },
            ]

            nock('https://api.example.com')
                .get('/profiles')
                .query({ 'query[limit]': 100, 'query[order]': 'created_at', metadata: true })
                .reply(200, {
                    profiles: profilesMock,
                    _metadata: { total: 2, limit: 100, offset: 0 },
                })

            const profiles = []
            for await (const profile of client.listProfiles()) {
                profiles.push(profile)
            }

            expect(profiles).toHaveLength(2)
            expect(profiles).toEqual(expect.arrayContaining(profilesMock))
        })
    })
})
