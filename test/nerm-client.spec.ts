import { jest, expect, describe, it, beforeEach, afterEach } from '@jest/globals'
import { NERMClient } from '../src/nerm-client'
import axios from 'axios'
import nock from 'nock'
import { logger } from '@sailpoint/connector-sdk'

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
    ConnectorError: class ConnectorError extends Error {
        constructor(message?: string) {
            super(message)
            this.name = 'ConnectorError'
        }
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

    describe('findProfileByAttribute', () => {
        const searchBody = {
            advanced_search: {
                condition_rules_attributes: [
                    { type: 'ProfileTypeRule', comparison_operator: '==', value: 'type-1' },
                    {
                        type: 'ProfileAttributeRule',
                        condition_object_type: 'TextFieldAttribute',
                        condition_object_id: 'attr-1',
                        comparison_operator: '==',
                        value: 'aaron.nichols',
                    },
                ],
            },
        }

        beforeEach(() => {
            jest.spyOn(client, 'getAttribute').mockResolvedValue({
                id: 'attr-1',
                type: 'TextFieldAttribute',
                uid: 'sysconfig_username',
            })
        })

        it('returns the profile that matches the login attribute', async () => {
            nock('https://api.example.com')
                .post('/advanced_search/run', searchBody)
                .query({ limit: 2 })
                .reply(200, { profiles: [{ id: 'profile-1' }] })
            nock('https://api.example.com')
                .get('/profiles/profile-1')
                .reply(200, { profile: { id: 'profile-1', name: 'Aaron Nichols' } })

            const result = await client.findProfileByAttribute('type-1', 'sysconfig_username', 'aaron.nichols')

            expect(result).toEqual({ id: 'profile-1', name: 'Aaron Nichols' })
        })

        it('returns undefined when no profile matches', async () => {
            nock('https://api.example.com')
                .post('/advanced_search/run', searchBody)
                .query({ limit: 2 })
                .reply(200, { profiles: [] })

            const result = await client.findProfileByAttribute('type-1', 'sysconfig_username', 'aaron.nichols')

            expect(result).toBeUndefined()
        })

        it('rejects a login value that matches more than one profile', async () => {
            nock('https://api.example.com')
                .post('/advanced_search/run', searchBody)
                .query({ limit: 2 })
                .reply(200, { profiles: [{ id: 'profile-1' }, { id: 'profile-2' }] })

            await expect(
                client.findProfileByAttribute('type-1', 'sysconfig_username', 'aaron.nichols')
            ).rejects.toThrow('Multiple profiles found for sysconfig_username="aaron.nichols"')
        })
    })

    describe('addRole', () => {
        const assignment = { user_role: { user_id: 'user-1', role_id: 'role-1' } }

        it('assigns the role when the association does not exist yet', async () => {
            nock('https://api.example.com')
                .post('/user_role/', assignment)
                .reply(200, { user_role: { id: 'assignment-1', user_id: 'user-1', role_id: 'role-1' } })

            await expect(client.addRole('user-1', 'role-1')).resolves.toEqual({
                id: 'assignment-1',
                user_id: 'user-1',
                role_id: 'role-1',
            })
            expect(logger.warn).not.toHaveBeenCalled()
        })

        it('warns and succeeds when the association already exists', async () => {
            nock('https://api.example.com')
                .post('/user_role/', assignment)
                .reply(422, { error: 'Association already exists' })

            await expect(client.addRole('user-1', 'role-1')).resolves.toBeUndefined()
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Role "role-1" is already assigned to user "user-1"')
            )
            expect(logger.error).not.toHaveBeenCalled()
        })

        it('warns and succeeds when the existing-association message is nested', async () => {
            nock('https://api.example.com')
                .post('/user_role/', assignment)
                .reply(400, { errors: { base: ['Association already exists'] } })

            await expect(client.addRole('user-1', 'role-1')).resolves.toBeUndefined()
            expect(logger.error).not.toHaveBeenCalled()
        })

        it('still fails when role assignment is rejected for another reason', async () => {
            nock('https://api.example.com').post('/user_role/', assignment).reply(422, { error: 'Role not found' })

            await expect(client.addRole('user-1', 'role-1')).rejects.toThrow('Role not found')
            expect(logger.error).toHaveBeenCalled()
            expect(logger.warn).not.toHaveBeenCalled()
        })
    })
})
