import { vi } from 'vitest'
import { AccountSchema, ConnectorError, StdAccountCreateInput } from '@sailpoint/connector-sdk'
import { AccountService } from '../src/services/account-service'
import { ConnectorContext } from '../src/connector-context'

const service = new AccountService({
    config: { login_attribute: 'sysconfig_username' },
} as ConnectorContext)

describe('buildNERMAccountBody portal user', () => {
    const attributes = {
        id: 'profile-1',
        name: 'Aaron Nichols',
        login: 'aaron.nichols',
        sysconfig_username: 'aaron.nichols',
        email: 'aaron.nichols@emea-tes-team.cloud',
        status: 'Active',
    }

    it('links a portal user to the profile that was just created', async () => {
        const body = await service.buildNERMAccountBody(attributes, 'NeaccessUser')

        expect(body.profile_id).toBe('profile-1')
        expect(body.type).toBe('NeaccessUser')
        expect(body.login).toBe('aaron.nichols')
        expect(body.email).toBe('aaron.nichols@emea-tes-team.cloud')
        expect(body.id).toBeUndefined()
    })

    it('does not require a profile for a NeprofileUser', async () => {
        const body = await service.buildNERMAccountBody(attributes, 'NeprofileUser')

        expect(body.profile_id).toBeUndefined()
        expect(body.type).toBe('NeprofileUser')
    })

    it('rejects a portal user when the profile id is missing', async () => {
        const { id: _profileId, ...withoutProfile } = attributes

        await expect(service.buildNERMAccountBody(withoutProfile, 'NeaccessUser')).rejects.toThrow(ConnectorError)
        await expect(service.buildNERMAccountBody(withoutProfile, 'NeaccessUser')).rejects.toThrow(
            'Cannot create portal user without a profile'
        )
    })
})

describe('createAccount profile relink', () => {
    const schema: AccountSchema = {
        identityAttribute: 'id',
        displayAttribute: 'name',
        groupAttribute: 'types',
        attributes: [
            { name: 'name', type: 'string', description: 'Name' },
            { name: 'sysconfig_username', type: 'string', description: 'Login' },
            { name: 'status', type: 'string', description: 'Status' },
        ],
    }
    const input: StdAccountCreateInput = {
        attributes: {
            name: 'Aaron Nichols',
            sysconfig_username: 'aaron.nichols',
            status: 'Active',
        },
        schema,
    }

    function serviceWith(nerm: Record<string, unknown>, loginAttribute = 'sysconfig_username') {
        return new AccountService({
            config: {
                account_type: 'Profile',
                profile_name: 'People - Custom',
                login_attribute: loginAttribute,
            },
            nerm,
        } as unknown as ConnectorContext)
    }

    it('relinks an existing profile with the same login instead of creating one', async () => {
        const existing = { id: 'profile-1', name: 'Aaron Nichols', status: 'Active', attributes: {} }
        const nerm = {
            getProfileTypeByName: vi.fn(async () => ({ id: 'type-1' })),
            findProfileByAttribute: vi.fn(async (_profileTypeId: string, _attribute: string, _value: string) => existing),
            createProfile: vi.fn(),
            resolveProfileAttributes: vi.fn(async () => ({ name: 'Aaron Nichols' })),
        }
        const accountService = serviceWith(nerm)

        const account = await accountService.createAccount(input)

        expect(nerm.findProfileByAttribute).toHaveBeenCalledWith('type-1', 'sysconfig_username', 'aaron.nichols')
        expect(nerm.createProfile).not.toHaveBeenCalled()
        expect(account.identity).toBe('profile-1')
    })

    it('creates a profile when the login value is not already in use', async () => {
        const created = { id: 'profile-2', name: 'Aaron Nichols', status: 'Active', attributes: {} }
        const nerm = {
            getProfileTypeByName: vi.fn(async () => ({ id: 'type-1' })),
            findProfileByAttribute: vi.fn(async () => undefined),
            getAttribute: vi.fn(async () => undefined),
            createProfile: vi.fn(async () => created),
            resolveProfileAttributes: vi.fn(async () => ({ name: 'Aaron Nichols' })),
        }
        const accountService = serviceWith(nerm)

        const account = await accountService.createAccount(input)

        expect(nerm.createProfile).toHaveBeenCalled()
        expect(account.identity).toBe('profile-2')
    })

    it('creates a profile when no login attribute is configured', async () => {
        const created = { id: 'profile-3', name: 'Aaron Nichols', status: 'Active', attributes: {} }
        const nerm = {
            getProfileTypeByName: vi.fn(async () => ({ id: 'type-1' })),
            findProfileByAttribute: vi.fn(),
            getAttribute: vi.fn(async () => undefined),
            createProfile: vi.fn(async () => created),
            resolveProfileAttributes: vi.fn(async () => ({ name: 'Aaron Nichols' })),
        }
        const accountService = serviceWith(nerm, '')

        const account = await accountService.createAccount(input)

        expect(nerm.findProfileByAttribute).not.toHaveBeenCalled()
        expect(nerm.createProfile).toHaveBeenCalled()
        expect(account.identity).toBe('profile-3')
    })
})
