import {
    AccountSchema,
    Attributes,
    ConnectorError,
    createConnector,
    logger,
    readConfig,
    Response,
    SchemaAttribute,
    StdAccountCreateHandler,
    StdAccountCreateInput,
    StdAccountDeleteHandler,
    StdAccountDisableHandler,
    StdAccountDiscoverSchemaHandler,
    StdAccountEnableHandler,
    StdAccountListHandler,
    StdAccountListOutput,
    StdAccountReadHandler,
    StdAccountUpdateHandler,
    StdEntitlementListHandler,
    StdTestConnectionHandler,
} from '@sailpoint/connector-sdk'
import { AccountType, Config, RequesterType } from './model/config'
import { ISCClient } from './isc-client'
import { NERMClient } from './nerm-client'
import { typeEntitlements } from './data/types'
import { apiSchema2Schema, mergeProfileWithConfig, profile2Schema } from './utils'
import { defaultAccountSchema } from './data/schema'
import { Profile, Role, Type, Workflow } from './model/entitlement'
import {
    PROFILE_ROOTATTRIBUTES,
    PROFILEONLY_ATTRIBUTES,
    PROFILETYPE_ATTRIBUTES,
    USERONLY_ATTRIBUTES,
} from './constants'
import { NeprofileUserAccount, ProfileAccount } from './model/account'

// Connector must be exported as module property named connector
export const connector = async () => {
    const config: Config = await readConfig()
    const isc = new ISCClient(config)
    const nerm = new NERMClient(config)
    const spConnectorInstanceId = config.spConnectorInstanceId

    const buildNERMAccountBody = async (
        attributes: Attributes,
        type: AccountType,
        schema?: AccountSchema
    ): Promise<any> => {
        let body: any = {
            status: attributes['status'] ?? 'Active',
            name: attributes.name,
        }
        switch (type) {
            case 'Profile':
                const profileType = await nerm.getProfileTypeByName(config.profile_name)
                body.profile_type_id = profileType.id
                body.attributes = {}
                for (const attribute of schema!.attributes) {
                    let finalValue
                    const key = attribute.name.split('.').reverse().pop()!
                    const attributeType = await nerm.getAttribute(key!)
                    const value = attributes[attribute.name]
                    let ids = []
                    if (value) {
                        let values = [value].flat()
                        if (PROFILETYPE_ATTRIBUTES.includes(attributeType?.type)) {
                            for (const value of values) {
                                const referencedProfile = await nerm.getProfileByNameAndType(
                                    value as string,
                                    attributeType.profile_type_id
                                )
                                if (referencedProfile) {
                                    ids.push(referencedProfile.id)
                                }
                            }
                            finalValue = ids
                        } else {
                            if (attribute.multi) {
                                finalValue = values
                            } else {
                                finalValue = values[0]
                            }
                        }
                        if (PROFILE_ROOTATTRIBUTES.includes(key)) {
                            body[key] = finalValue
                        } else {
                            body.attributes[key] = finalValue
                        }
                    }
                }
                break
            case 'NeprofileUser':
                if (!attributes.login) {
                    const message = 'Cannot create user without login'
                    throw new ConnectorError(message)
                }
                body.type = type
                for (const attribute of USERONLY_ATTRIBUTES) {
                    const value = attributes[attribute]
                    if (value) {
                        body[attribute] = value
                    }
                }
                if (config.account_type === 'Profile') {
                }
                break
            case 'NeaccessUser':
                if (!attributes.login) {
                    const message = 'Cannot create user without login'
                    throw new ConnectorError(message)
                }
                body.type = type
                for (const attribute of USERONLY_ATTRIBUTES) {
                    const value = attributes[attribute]
                    if (value) {
                        body[attribute] = value
                    }
                }
                body.profile_id = body.identity
                break

            default:
        }
        delete body.id
        return body
    }

    const getAccount = async (id: string, schema?: AccountSchema): Promise<StdAccountListOutput> => {
        let response: any
        switch (config.account_type) {
            case 'NeprofileUser':
                response = await nerm.getUser(id)
                break
            case 'NeaccessUser':
                response = await nerm.getUser(id)
                break
            case 'Profile':
                response = await nerm.getProfile(id)
                break
            default:
                throw new ConnectorError(`${config.account_type} account type not supported`)
        }

        return await buildAccount(response, schema)
    }

    const buildAccount = async (nermObject: any, schema?: AccountSchema): Promise<StdAccountListOutput> => {
        let account: StdAccountListOutput
        switch (config.account_type) {
            case 'Profile':
                account = new ProfileAccount(nermObject)
                if (schema) {
                    const attributes = await nerm.resolveProfileAttributes(nermObject, schema)
                    account.attributes = attributes
                }
                break
            case 'NeprofileUser':
                account = new NeprofileUserAccount(nermObject)
            case 'NeprofileUser':
                account = new NeprofileUserAccount(nermObject)
                break
        }

        return account!
    }

    const createAccount = async (input: StdAccountCreateInput): Promise<any> => {
        const body = await buildNERMAccountBody(input.attributes, config.account_type, input.schema)
        let rawAccount
        switch (config.account_type) {
            case 'Profile':
                rawAccount = await nerm.createProfile(body)
                break
            case 'NeprofileUser':
                rawAccount = await nerm.createUser(body)
                break
            case 'NeaccessUser':
                rawAccount = await nerm.createUser(body)
        }

        const account = await buildAccount(rawAccount, input.schema)

        return account
    }

    const addType = async (account: StdAccountListOutput, type: AccountType) => {
        const name = account.uuid as string
        switch (type) {
            case 'Profile':
                const message = `"Add Profile type" operation not supported`
                throw new ConnectorError(message)
            default:
                if (type === 'NeaccessUser' && config.account_type !== 'NeprofileUser') {
                    const message = `"Add NeaccessUser type" operation not supported for Users`
                    throw new ConnectorError(message)
                }
                const login = config.login_attribute
                    ? (account.attributes[config.login_attribute] as string)
                    : undefined
                if (!login) {
                    const message = 'Missing login attribute for user creation'
                    throw new ConnectorError(message)
                } else {
                    const attributes = { ...account.attributes, login, name }
                    const body = await buildNERMAccountBody(attributes, type)
                    let response = await nerm.getUserByLoginAndType(login, type)
                    if (!response) {
                        response = await nerm.createUser(body)
                    }
                    if (response) {
                        await setAttribute(account, 'user_id', response.id)
                    } else {
                        throw new ConnectorError(`Failed to add "${type}" type to ${account.uuid}`)
                    }
                }
        }
        const types = new Set(account.attributes.types as string[])
        types.add(type)
        account.attributes.types = [...types]
    }

    const removeType = async (account: StdAccountListOutput, type: AccountType) => {
        if (config.account_type === type) {
            const message = `Cannot remove account base type`
            throw new ConnectorError(message)
        } else {
            const id = account.attributes.user_id as string
            if (id) {
                await nerm.deleteUser(id)
                await setAttribute(account, 'user_id', undefined)
                const types = account.attributes.types as string[]
                types.splice(types.indexOf(type), 1)
            } else {
                const message = `User not found for "${account.uuid}" profile`
                logger.error(message)
            }
        }
    }

    const addRole = async (account: StdAccountListOutput, role_id: string) => {
        let id: string
        switch (config.account_type) {
            case 'Profile':
                if (!account.attributes.user_id) {
                    addType(account, 'NeprofileUser')
                }
                id = account.attributes.user_id as string
                break
            default:
                id = account.identity!
                break
        }

        await nerm.addRole(id, role_id)
        const roles = account.attributes.roles as string[]
        roles.push(role_id)
    }

    const removeRole = async (account: StdAccountListOutput, role_id: string) => {
        let id
        switch (config.account_type) {
            case 'Profile':
                if (!account.attributes.user_id) {
                    addType(account, 'NeprofileUser')
                }
                id = account.attributes.user_id!
            default:
                id = account.identity!
                break
        }

        await nerm.removeRole(id, role_id)
        const roles = account.attributes.roles as string[]
        try {
            roles.splice(roles.indexOf(role_id), 1)
        } catch (error) {
            logger.error(error)
        }
    }

    const setAttribute = async (account: StdAccountListOutput, attribute: string, value: any) => {
        switch (config.account_type) {
            case 'Profile':
                await nerm.setProfileAttribute(account.identity!, attribute, value)
                break
            case 'NeprofileUser':
                await nerm.setUserAttribute(account.identity!, attribute, value)
                break
            case 'NeprofileUser':
                await nerm.setUserAttribute(account.identity!, attribute, value)
        }

        if (attribute === 'status') {
            account.disabled = value === 'Active' ? false : true
            if (account.attributes.user_id) {
                const user_id = account.attributes.user_id as string
                try {
                    await nerm.setUserAttribute(user_id, attribute, value)
                } catch (error) {
                    logger.error(error)
                }
            }
        } else if (attribute === 'name') {
            account.uuid = value
            account.attributes.name = value
        }
    }

    const getSchema = async () => {
        const sources = await isc.listSources()
        const source = sources.find(
            (x) => (x.connectorAttributes as any).spConnectorInstanceId === spConnectorInstanceId
        )!
        const schemas = await isc.listSourceSchemas(source.id!)
        const accountSchema = schemas.find((x) => x.nativeObjectType === 'User')!

        return apiSchema2Schema(accountSchema)
    }

    const runWorkflow = async (
        account: StdAccountListOutput,
        workflow_id: string,
        requester: RequesterType,
        wait: boolean = false
    ): Promise<any> => {
        let requester_id
        const requester_type = 'NeprofileUser'
        if (requester === 'admin') {
            const admin = await nerm.getUserByNameAndType(config.nerm_admin, 'NeprofileUser')
            requester_id = admin?.id
        } else {
            requester_id = account.attributes[requester]
        }
        if (requester_id) {
            const body: { [key: string]: any } = {
                workflow_id,
                requester_id,
                requester_type,
            }
            if (account.identity !== '') {
                body.profile_id = account.identity
            }
            const response = await nerm.createWorkflowSession(body, wait)
            if (response) {
                return response
            }
        } else {
            const message = `Unable to resolve ${requester} for workflow ${workflow_id}`
            logger.error(message)
        }
    }

    const addWorkflow = async (account: StdAccountListOutput, workflow_id: string) => {
        const workflow = config.workflows?.find((x) => x.workflow === workflow_id)
        if (workflow) {
            const { requester_id } = workflow
            await runWorkflow(account, workflow_id, requester_id)
        } else {
            const message = `Unable to configuration for workflow ${workflow_id}`
            throw new ConnectorError(message)
        }
    }

    const processOperation = async (account: StdAccountListOutput, op: string, schema?: AccountSchema) => {
        const operation = config.operations?.find((x) => x.operation === op)
        if (operation) {
            const response = await runWorkflow(account, operation.workflow, operation.requester_id, operation.wait)
            if (response && operation.wait) {
                account = await buildAccount(account, schema)
            }
        }
    }

    const send = async <T>(res: Response<T>, output: T) => {
        logger.info(output)
        res.send(output)
    }

    const stdTestConnection: StdTestConnectionHandler = async (context, input, res) => {
        try {
            await isc.getPublicIdentityConfig()
            await nerm.listProfileTypes()

            send(res, {})
        } catch (error) {
            logger.error(error)
            throw new ConnectorError(error as string)
        }
    }

    const StdAccountDiscoverSchema: StdAccountDiscoverSchemaHandler = async (context, input, res) => {
        try {
            let schema: AccountSchema
            const sources = await isc.listSources()
            const source = sources.find(
                (x) => (x.connectorAttributes as any).spConnectorInstanceId === spConnectorInstanceId
            )!

            if (!source) {
                const error = `Unable to find source with spConnectorInstanceId "${spConnectorInstanceId}"`
                throw new ConnectorError(error)
            }

            const schemas = await isc.listSourceSchemas(source.id!)
            if (config.profiles) {
                const schemaNames = schemas.map((x) => x.name)
                for (const profile of config.profiles) {
                    if (!schemaNames.includes(profile.name)) {
                        const profileType = await nerm.getProfileTypeByName(profile.name)
                        if (profileType) {
                            const profileData = mergeProfileWithConfig(profileType, config.profiles)
                            const profileSchema = profile2Schema(profileData)
                            isc.createSchema(profileSchema, source.id!)
                        } else {
                            const message = `No "${profile.name}" profile type found on NERM`
                            throw new ConnectorError(message)
                        }
                    }
                }
            }

            const accountSchema = schemas.find((x) => x.nativeObjectType === 'User')

            if (accountSchema) {
                schema = apiSchema2Schema(accountSchema)
            } else {
                schema = defaultAccountSchema
            }
            switch (config.account_type) {
                case 'Profile':
                    schema.attributes = schema.attributes.filter((x) => !USERONLY_ATTRIBUTES.includes(x.name))
                    if (config.login_attribute) {
                        const login: SchemaAttribute = {
                            name: config.login_attribute,
                            type: 'string',
                            description: 'Login attribute',
                        }
                        schema.attributes.push(login)
                    }
                    break

                default:
                    schema.attributes = schema.attributes
                        .filter((x) => !PROFILEONLY_ATTRIBUTES.includes(x.name))
                        .filter((x) => x.name.includes('.'))
                    const login: SchemaAttribute = {
                        name: 'login',
                        type: 'string',
                        description: 'Login attribute',
                    }
                    schema.attributes.push(login)
            }

            send(res, schema!)
        } catch (error) {
            logger.error(error)
            throw new ConnectorError(error as string)
        }
    }

    const stdAccountList: StdAccountListHandler = async (context, input, res) => {
        switch (config.account_type) {
            case 'NeprofileUser':
                for await (const user of nerm.listUsers(config.account_type)) {
                    const account = await getAccount(user.id)
                    send(res, account)
                }
                break
            case 'NeaccessUser':
                for await (const user of nerm.listUsers(config.account_type)) {
                    const account = await getAccount(user.id)
                    send(res, account)
                }
                break
            case 'Profile':
                const profileType = await nerm.getProfileTypeByName(config.profile_name)
                for await (const profile of nerm.listProfiles({ profile_type_id: profileType.id })) {
                    const account = await getAccount(profile.id, input.schema)
                    send(res, account)
                }
                break
            default:
                throw new ConnectorError(`${config.account_type} account type not supported`)
        }
    }

    const stdAccountRead: StdAccountReadHandler = async (context, input, res) => {
        logger.info(input)
        const account = await getAccount(input.identity)
        send(res, account)
    }

    const stdEntitlementList: StdEntitlementListHandler = async (context, input, res) => {
        switch (input.type) {
            case 'type':
                for await (const type of typeEntitlements) {
                    const entitlement = new Type(type)
                    send(res, entitlement)
                }
                break
            case 'role':
                const roles = nerm.listRoles()
                for await (const role of roles) {
                    const entitlement = new Role(role)
                    send(res, entitlement)
                }
                break
            case 'workflow':
                if (config.workflows) {
                    const workflows = [config.workflows].flat()
                    for (const workflow of workflows) {
                        const entitlement = new Workflow(workflow)
                        send(res, entitlement)
                    }
                }
                break
            default:
                if (config.profiles) {
                    const profileConf = config.profiles.find((x) => x.name === input.type)
                    if (profileConf) {
                        const profileObject = await nerm.getProfileTypeByName(profileConf.name)
                        const profiles = nerm.listProfiles({ profile_type_id: profileObject.id })
                        for await (const profile of profiles) {
                            const entitlement = new Profile(profile, input.type, profileConf.config)
                            send(res, entitlement)
                        }
                    }
                }
        }
    }

    const stdAccountCreate: StdAccountCreateHandler = async (context, input, res) => {
        const operation = 'create'
        logger.info(input)
        if (!input.schema) {
            const schema = await getSchema()
            input.schema = schema
        }
        let account = await createAccount(input)

        if (input.attributes.types) {
            const types = [input.attributes.types].flat()
            for (const type of types) {
                addType(account, type)
            }
        }

        if (input.attributes.roles) {
            const roles = [input.attributes.roles].flat()
            for (const role of roles) {
                addRole(account, role)
            }
        }

        if (input.attributes.workflows) {
            const workflows = [input.attributes.workflows].flat()
            for (const workflow of workflows) {
                addWorkflow(account, workflow)
            }
        }

        if (account) {
            await processOperation(account, operation, input.schema)
            send(res, account)
        }
    }

    const stdAccountUpdate: StdAccountUpdateHandler = async (context, input, res) => {
        const operation = 'update'
        logger.info(input)
        if (!input.schema) {
            const schema = await getSchema()
            input.schema = schema
        }

        if (input.changes) {
            let account = await getAccount(input.identity, input.schema)
            for (const change of input.changes) {
                const values = [change.value].flat()
                for (const value of values) {
                    switch (change.op) {
                        case 'Add':
                            switch (change.attribute) {
                                case 'types':
                                    addType(account, value)
                                    break
                                case 'roles':
                                    addRole(account, value)
                                    break
                                case 'workflows':
                                    addWorkflow(account, value)
                                    break
                                default:
                                    if (input.schema?.attributes.find((x) => x.schemaObjectType === change.attribute)) {
                                    } else {
                                        const message = `"${change.attribute}" entitlement attribute not supported`
                                        throw new ConnectorError(message)
                                    }
                                    throw new ConnectorError('Not implemented yet')
                            }
                            break
                        case 'Remove':
                            switch (change.attribute) {
                                case 'types':
                                    removeType(account, value)
                                    break
                                case 'roles':
                                    removeRole(account, value)
                                    break
                                case 'workflows':
                                    throw new ConnectorError('Operation not supported')
                                default:
                                    if (input.schema?.attributes.find((x) => x.schemaObjectType === change.attribute)) {
                                        throw new ConnectorError('Not implemented yet')
                                    } else {
                                        const message = `"${change.attribute}" entitlement attribute not supported`
                                        throw new ConnectorError(message)
                                    }
                            }
                            break
                        case 'Set':
                            setAttribute(account, change.attribute, value)
                    }
                }
            }
            if (account) {
                await processOperation(account, operation, input.schema)
                send(res, account)
            }
        }
    }

    const stdAccountEnable: StdAccountEnableHandler = async (context, input, res) => {
        const attribute = 'status'
        const value = 'Active'
        const operation = 'enable'
        logger.info(input)
        const account = await getAccount(input.identity, input.schema)
        await setAttribute(account, attribute, value)
        if (account.attributes.user_id) {
        }

        if (account) {
            await processOperation(account, operation, input.schema)
            send(res, account)
        }
    }

    const stdAccountDisable: StdAccountDisableHandler = async (context, input, res) => {
        const attribute = 'status'
        const value = 'Inactive'
        const operation = 'disable'
        logger.info(input)
        const account = await getAccount(input.identity, input.schema)
        await setAttribute(account, attribute, value)

        if (account) {
            await processOperation(account, operation, input.schema)
            send(res, account)
        }
    }

    const stdAccountDelete: StdAccountDeleteHandler = async (context, input, res) => {
        const operation = 'delete'
        logger.info(input)
        const account = await getAccount(input.identity, input.schema)
        switch (config.account_type) {
            case 'Profile':
                nerm.deleteProfile(input.identity)
                if (account.attributes.user_id) {
                    nerm.deleteUser(account.attributes.user_id as string)
                }
                break

            default:
                nerm.deleteUser(input.identity)
        }

        if (account) {
            account.identity = ''
            await processOperation(account, operation, input.schema)
            send(res, undefined)
        }
    }

    return createConnector()
        .stdTestConnection(stdTestConnection)
        .stdAccountDiscoverSchema(StdAccountDiscoverSchema)
        .stdAccountList(stdAccountList)
        .stdAccountRead(stdAccountRead)
        .stdEntitlementList(stdEntitlementList)
        .stdAccountCreate(stdAccountCreate)
        .stdAccountUpdate(stdAccountUpdate)
        .stdAccountEnable(stdAccountEnable)
        .stdAccountDisable(stdAccountDisable)
        .stdAccountDelete(stdAccountDelete)
}
