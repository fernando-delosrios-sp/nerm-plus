import {
    AccountSchema,
    Attributes,
    CommandHandler,
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
    StdChangePasswordHandler,
    StdEntitlementListHandler,
    StdTestConnectionHandler,
} from '@sailpoint/connector-sdk'
import { AccountType, Config, RequesterType } from './model/config'
import { ISCClient } from './isc-client'
import { NERMClient } from './nerm-client'
import { typeEntitlements } from './data/types'
import {
    apiSchema2Schema,
    entity2profile,
    getRoleType,
    getStatus,
    parents2children,
    profile2EntitlementSchema,
    resolveUserAttributes,
    updateTypes,
} from './utils'
import { defaultAccountSchema } from './data/schema'
import { Profile, Role, Type, Workflow } from './model/entitlement'
import {
    ACCOUNT_CONCURRENCY,
    BATCH_SIZE,
    ENTITLEMENT_ATTRIBUTES,
    PROCESSINGWAIT,
    PROFILE_ROOTATTRIBUTES,
    PROFILEONLY_ATTRIBUTES,
    PROFILETYPE_ATTRIBUTES,
    USERONLY_ATTRIBUTES,
    USERTYPE_ATTRIBUTES,
} from './data/constants'
import { NeaccessUserAccount, NeprofileUserAccount, ProfileAccount } from './model/account'
import { SearchDocument } from 'sailpoint-api-client'
import { fnLog, opEnd, opStart, toLogString } from './logging'

// Connector must be exported as module property named connector
export const connector = async () => {
    const config: Config = await readConfig()
    const isc = new ISCClient(config)
    const nerm = new NERMClient(config)
    const spConnectorInstanceId = config.spConnectorInstanceId
    let cachedAdminUserId: string | undefined

    const buildNERMAccountBody = async (
        attributes: Attributes,
        type: AccountType,
        schema?: AccountSchema
    ): Promise<any> => {
        logger.debug(`Building NERM account body for type: ${type}`)
        let body: any = {
            status: attributes?.status ?? 'Active',
            name: attributes.name,
        }
        switch (type) {
            case 'Profile':
                const profileType = await nerm.getProfileTypeByName(config.profile_name)
                body.profile_type_id = profileType.id
                body.attributes = {}

                const relevantAttrs = schema!.attributes.filter((attr) => {
                    if (ENTITLEMENT_ATTRIBUTES.includes(attr.name)) return false
                    const leaf = attr.name.split('.').pop()!
                    const hasExact = attributes[attr.name] !== undefined && attributes[attr.name] !== null
                    const hasLeaf = attributes[leaf] !== undefined && attributes[leaf] !== null
                    return hasExact || hasLeaf
                })

                const attrResults = (
                    await Promise.all(
                        relevantAttrs.map(async (attribute) => {
                            const leaf = attribute.name.split('.').pop()!
                            const rawValue =
                                attributes[attribute.name] !== undefined && attributes[attribute.name] !== null
                                    ? attributes[attribute.name]
                                    : attributes[leaf]
                            if (rawValue === undefined || rawValue === null) {
                                return null
                            }

                            const key = leaf
                            const attributeType = await nerm.getAttribute(key)
                            const values = [rawValue].flat()
                            const isMulti = attribute.multi ?? Array.isArray(rawValue)

                            let finalValue
                            if (PROFILETYPE_ATTRIBUTES.includes(attributeType?.type)) {
                                const profiles = await Promise.all(
                                    values.map((v) =>
                                        nerm.resolveProfileByValueOrName(v as string, attributeType.profile_type_id)
                                    )
                                )
                                const unresolvedProfileValues = values.filter((_, i) => !profiles[i])
                                if (unresolvedProfileValues.length > 0) {
                                    logger.warn(
                                        `buildNERMAccountBody: profile reference not resolved for attribute "${attribute.name}" (key=${key}, profile_type_id=${attributeType.profile_type_id}): ${unresolvedProfileValues
                                            .map((v) => toLogString(v))
                                            .join('; ')}`
                                    )
                                }
                                finalValue = profiles.filter((p) => p).map((p) => p.id)
                            } else if (USERTYPE_ATTRIBUTES.includes(attributeType?.type)) {
                                const ids = await Promise.all(
                                    values.map((v) => nerm.resolveUserReferenceValueForApi(String(v)))
                                )
                                const unresolvedUserValues = values.filter((_, i) => !ids[i])
                                if (unresolvedUserValues.length > 0) {
                                    logger.warn(
                                        `buildNERMAccountBody: user reference not resolved to a user id for attribute "${attribute.name}" (key=${key}): ${unresolvedUserValues
                                            .map((v) => toLogString(v))
                                            .join('; ')}`
                                    )
                                }
                                const resolved = ids.filter((id): id is string => Boolean(id))
                                finalValue = isMulti ? resolved : resolved[0]
                            } else {
                                finalValue = isMulti ? values : values[0]
                            }

                            return { key, finalValue }
                        })
                    )
                ).filter((r): r is { key: string; finalValue: any } => r !== null)
                for (const { key, finalValue } of attrResults) {
                    if (PROFILE_ROOTATTRIBUTES.includes(key)) {
                        body[key] = finalValue
                    } else {
                        body.attributes[key] = finalValue
                    }
                }
                break
            case 'NeprofileUser':
                if (!config.login_attribute || !attributes[config.login_attribute]) {
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
                break
            case 'NeaccessUser':
                if (!config.login_attribute || !attributes[config.login_attribute]) {
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
        body.status = getStatus(body.status, type)

        return body
    }

    const getAccount = async (id: string, schema?: AccountSchema): Promise<StdAccountListOutput> => {
        logger.debug(`Getting account with ID: ${id}`)
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

        if (!response) {
            const message = `${config.account_type} with ID "${id} not found"`
            throw new ConnectorError(message)
        }
        return await buildAccount(response, schema)
    }

    const buildAccount = async (nermObject: any, schema?: AccountSchema): Promise<StdAccountListOutput> => {
        if (nermObject == null) {
            throw new ConnectorError('Cannot build account: missing NERM response data')
        }
        logger.debug(`Building account from NERM object: ${JSON.stringify(nermObject)}`)
        let account: StdAccountListOutput
        let id: string | undefined
        let attributes: Attributes = {}
        switch (config.account_type) {
            case 'Profile':
                account = new ProfileAccount(nermObject)
                if (schema) {
                    attributes = await nerm.resolveProfileAttributes(nermObject, schema)
                }
                id = attributes.user_id as string
                break
            case 'NeprofileUser':
                account = new NeprofileUserAccount(nermObject)
                attributes = resolveUserAttributes(nermObject, schema)
                account.attributes[config.login_attribute] = nermObject.login
                if (account.attributes.workflows) {
                    account.attributes.workflows = (account.attributes.workflows as string).split(',')
                }
                id = account.identity
                break
            case 'NeaccessUser':
                account = new NeaccessUserAccount(nermObject)
                attributes = resolveUserAttributes(nermObject, schema)
                account.attributes[config.login_attribute] = nermObject.login
                id = account.identity
                break
        }

        account.attributes = { ...attributes, ...account.attributes }

        if (id) {
            if (config.account_type === 'Profile') {
                const [user, roleAssignments] = await Promise.all([nerm.getUser(id), nerm.getUserRoleAssignments(id)])
                if (user) {
                    const type = user.type as AccountType
                    if (config.login_attribute) {
                        updateTypes(account.attributes, type, { [config.login_attribute]: user.login })
                    } else {
                        updateTypes(account.attributes, type)
                    }
                }
                if (roleAssignments) {
                    account.attributes.roles = roleAssignments.map((x: { role_id: any }) => x.role_id)
                }
            } else {
                const roleAssignments = await nerm.getUserRoleAssignments(id)
                if (roleAssignments) {
                    account.attributes.roles = roleAssignments.map((x: { role_id: any }) => x.role_id)
                }
            }
        }

        return account!
    }

    const createAccount = async (input: StdAccountCreateInput): Promise<StdAccountListOutput> => {
        logger.debug(`Creating account with input: ${JSON.stringify(input)}`)
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
        if (type === config.account_type) return

        logger.info(`Adding ${type} type to ${account.uuid}`)
        const name = account.uuid as string
        let loginValue: string | undefined
        switch (type) {
            case 'Profile':
                const message = `"Add Profile type" operation not supported`
                throw new ConnectorError(message)
            default:
                if (config.account_type !== 'Profile') {
                    const message = `"Only one user type is allowed per account`
                    throw new ConnectorError(message)
                }

                const user_id = account.attributes.user_id as string
                if (user_id) {
                    const response = await nerm.getUser(user_id)
                    if (response) {
                        const roleAssignments = await nerm.getUserRoleAssignments(user_id)
                        if (roleAssignments) {
                            account.attributes.roles = roleAssignments.map((x: { role_id: any }) => x.role_id)
                        }
                    }
                } else {
                    const login = config.login_attribute
                        ? (account.attributes[config.login_attribute] as string)
                        : undefined
                    if (!login) {
                        const message = 'Missing login attribute for user creation'
                        throw new ConnectorError(message)
                    } else {
                        const attributes = { ...account.attributes, login, name }
                        let response = await nerm.getUserByLoginAndType(login, type)
                        if (!response) {
                            const body = await buildNERMAccountBody(attributes, type)
                            response = await nerm.createUser(body)
                        }
                        if (response) {
                            account.attributes.user_id = response.id
                            await nerm.setProfileAttribute(account.identity!, 'user_id', response.id)
                        } else {
                            throw new ConnectorError(`Failed to add "${type}" type to ${account.uuid}`)
                        }
                        loginValue = response.login
                    }
                }
        }
        updateTypes(account.attributes, type)
    }

    const removeType = async (account: StdAccountListOutput, type: AccountType) => {
        logger.info(`Removing ${type} type to ${account.uuid}`)
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
        logger.info(`Adding ${role_id} role to ${account.uuid}`)
        let id: string
        const role = await nerm.getRole(role_id)
        const type = getRoleType(role)
        switch (config.account_type) {
            case 'Profile':
                if (!account.attributes.user_id) {
                    if (type === 'NeprofileUser') {
                        await addType(account, 'NeprofileUser')
                    } else {
                        await addType(account, 'NeaccessUser')
                    }
                }
                id = account.attributes.user_id as string
                break
            default:
                id = account.identity!
                break
        }

        account.attributes.roles = account.attributes.roles ?? []
        const roles = account.attributes.roles as string[]

        if (!roles.includes(role_id)) {
            await nerm.addRole(id, role_id)
            roles.push(role_id)
        }
    }

    const removeRole = async (account: StdAccountListOutput, role_id: string) => {
        logger.info(`Removing ${role_id} role to ${account.uuid}`)
        let id: string
        const role = await nerm.getRole(role_id)
        const type = getRoleType(role)
        switch (config.account_type) {
            case 'Profile':
                if (!account.attributes.user_id) {
                    if (type === 'NeprofileUser') {
                        await addType(account, 'NeprofileUser')
                    } else {
                        await addType(account, 'NeaccessUser')
                    }
                }
                id = account.attributes.user_id as string
                break
            default:
                id = account.identity!
                break
        }

        account.attributes.roles = account.attributes.roles ?? []
        const roles = account.attributes.roles as string[]

        if (roles.includes(role_id)) {
            await nerm.removeRole(id, role_id)
            roles.splice(roles.indexOf(role_id), 1)
        }
    }

    const setAttribute = async (account: StdAccountListOutput, attribute: string, value: any) => {
        logger.debug(`Setting attribute ${attribute} to value ${value} for account ${account.uuid}`)
        switch (config.account_type) {
            case 'Profile':
                if (attribute === 'workflows') {
                    const serialized = (value as string[]).join(',')
                    await nerm.setProfileAttribute(account.identity!, attribute, serialized)
                } else {
                    await nerm.setProfileAttribute(account.identity!, attribute, value)
                }
                const id = account.attributes.user_id as string
                if (id) {
                    if (attribute === config.login_attribute) {
                        await nerm.setUserAttribute(id, 'login', value)
                    }

                    if (attribute === 'name') {
                        await nerm.setUserAttribute(id, 'name', value)
                    }

                    if (attribute === 'email') {
                        await nerm.setUserAttribute(id, 'email', value)
                    }
                }
                break
            case 'NeprofileUser':
                await nerm.setUserAttribute(account.identity!, attribute, value)
                break
            case 'NeaccessUser':
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
        } else {
            account.attributes[attribute] = value
        }
    }

    const profileAttributeOp = async (account: any, attribute: string, value: string, op: 'add' | 'remove') => {
        logger.debug(
            `Performing ${op} operation on attribute ${attribute} with value ${value} for account ${account.identity}`
        )
        const profile = await nerm.getProfile(account.identity)
        const currentValue = await nerm.getAttributeRecursively(profile, attribute)
        let newValue
        if (op === 'add') {
            newValue = [...currentValue.map((x: { id: string }) => x.id), value]
        } else {
            newValue = currentValue.filter((x: { id: string }) => x.id !== value).map((x: { id: string }) => x.id)
        }

        await setAttribute(account, attribute, newValue)
    }

    const getSchema = async () => {
        logger.debug('Getting schema from ISC')
        const sources = await isc.listSources()
        const source = sources.find(
            (x) => (x.connectorAttributes as any).spConnectorInstanceId === spConnectorInstanceId
        )
        if (!source) {
            const error = `Unable to find source with spConnectorInstanceId "${spConnectorInstanceId}"`
            throw new ConnectorError(error)
        }

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
        logger.debug(`Running workflow ${workflow_id} for account ${account.uuid} with requester ${requester}`)
        let requester_id
        const requester_type = 'NeprofileUser'
        if (requester === 'admin') {
            if (!cachedAdminUserId) {
                const admin = await nerm.getUserByNameAndType(config.nerm_admin, 'NeprofileUser')
                cachedAdminUserId = admin?.id
            }
            requester_id = cachedAdminUserId
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

    const removeWorkflow = async (account: StdAccountListOutput, workflow_id: string) => {
        logger.debug(`Removing workflow ${workflow_id} from account ${account.uuid}`)
        const current = (account.attributes.workflows as string[]) ?? []
        current.splice(current.indexOf(workflow_id), 1)
        await setAttribute(account, 'workflows', current)
    }

    const addWorkflow = async (account: StdAccountListOutput, workflow_id: string, waitFlag: boolean = false) => {
        logger.debug(`Adding workflow ${workflow_id} to account ${account.uuid}`)
        const workflow = config.workflows?.find((x) => x.workflow === workflow_id)
        if (workflow) {
            const { requester_id } = workflow
            await runWorkflow(account, workflow_id, requester_id, waitFlag)
            const persistent = config.workflows?.find((x) => x.workflow === workflow_id)?.persistent ?? false
            if (persistent) {
                const current = (account.attributes.workflows as string[]) ?? []
                current.push(workflow_id)
                await setAttribute(account, 'workflows', current)
            }
        } else {
            const message = `Unable to find configuration for workflow ${workflow_id}`
            throw new ConnectorError(message)
        }
    }

    const processOperation = async (account: StdAccountListOutput, op: string, schema?: AccountSchema) => {
        logger.debug(`Processing operation ${op} for account ${account.uuid}`)
        let operation: any = config.operations?.find((x) => x.operation === op)
        if (!operation) {
            operation = config.profiles?.find((x) => x.name === op)
        }
        if (operation) {
            const response = await runWorkflow(account, operation.workflow, operation.requester_id, operation.wait)
            if (response && operation.wait) {
                account = await getAccount(account.identity as string, schema)
            }
        }
        return account
    }

    const send = async <T>(res: Response<T>, output: T) => {
        logger.debug(`send output=${toLogString(output)}`)
        res.send(output)
    }

    const stdTestConnection: StdTestConnectionHandler = async (context, input, res) => {
        opStart('stdTestConnection', input)
        logger.debug(fnLog('stdTestConnection', 'Testing connection'))
        try {
            await isc.getPublicIdentityConfig()
            const iterator = nerm.listProfileTypes()
            await iterator.next()

            send(res, {})
            opEnd('stdTestConnection', {})
        } catch (error) {
            logger.error(`stdTestConnection error=${toLogString(error)}`)
            throw new ConnectorError(error as string)
        }
    }

    const stdAccountDiscoverSchema: StdAccountDiscoverSchemaHandler = async (context, input, res) => {
        opStart('stdAccountDiscoverSchema', input)
        logger.debug(fnLog('stdAccountDiscoverSchema', 'Discovering account schema'))
        try {
            let schema: AccountSchema
            const profileEntitlements: SchemaAttribute[] = []
            const sources = await isc.listSources()
            const source = sources.find(
                (x) => (x.connectorAttributes as any).spConnectorInstanceId === spConnectorInstanceId
            )!

            if (!source) {
                const error = `Unable to find source with spConnectorInstanceId "${spConnectorInstanceId}"`
                throw new ConnectorError(error)
            }

            const schemas = await isc.listSourceSchemas(source.id!)
            if (config.profiles && config.account_type === 'Profile') {
                const schemaNames = schemas.map((x) => x.name)

                const profilePromises = config.profiles.map(async (profile: any) => {
                    const [profileType, profileAttribute] = await Promise.all([
                        nerm.getProfileTypeByName(profile.name),
                        nerm.getAttribute(profile.attribute),
                    ])
                    return { profile, profileType, profileAttribute }
                })

                const resolvedProfiles = await Promise.all(profilePromises)

                for (const { profile, profileType, profileAttribute } of resolvedProfiles) {
                    if (profileType) {
                        if (!schemaNames.includes(profile.name)) {
                            const profileData = { ...profileType, attributes: profile.attributes }
                            const profileSchema = profile2EntitlementSchema(profileData)
                            isc.createSchema(profileSchema, source.id!)
                        }

                        const attribute: SchemaAttribute = {
                            name: profile.attribute,
                            type: 'string',
                            description: `${profile.name} profile`,
                            schemaObjectType: profile.name,
                            entitlement: true,
                            managed: true,
                            multi: profileAttribute?.allow_multiple_selections ? true : false,
                        }
                        profileEntitlements.push(attribute)
                    } else {
                        const message = `No "${profile.name}" profile type found on NERM`
                        throw new ConnectorError(message)
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
                        for (const profile of profileEntitlements) {
                            const previousIndex = schema.attributes.findIndex((x) => x.name === profile.name)
                            if (previousIndex > -1) {
                                schema.attributes[previousIndex] = profile
                            } else {
                                schema.attributes.push(profile)
                            }
                        }
                    }
                    break

                default:
                    schema.attributes = schema.attributes
                        .filter((x) => !PROFILEONLY_ATTRIBUTES.includes(x.name))
                        .filter((x) => !x.name.includes('.'))
            }

            send(res, schema!)
            opEnd('stdAccountDiscoverSchema', schema!)
        } catch (error) {
            logger.error(`stdAccountDiscoverSchema error=${toLogString(error)}`)
            throw new ConnectorError(error as string)
        }
    }

    const stdAccountList: StdAccountListHandler = async (context, input, res) => {
        opStart('stdAccountList', input)
        logger.debug(fnLog('stdAccountList', 'Listing accounts'))
        const interval = setInterval(() => {
            res.keepAlive()
        }, PROCESSINGWAIT)

        try {
            if (!input.schema) {
                const schema = await getSchema()
                input.schema = schema
            }

            const processAccountBatch = async (items: any[]) => {
                const results = await Promise.allSettled(items.map((item) => getAccount(item.id, input.schema)))
                for (const result of results) {
                    if (result.status === 'fulfilled') {
                        send(res, result.value)
                    } else {
                        logger.error(result.reason)
                    }
                }
            }

            const listAndProcess = async (source: AsyncGenerator<any>) => {
                let batch: any[] = []
                for await (const item of source) {
                    batch.push(item)
                    if (batch.length >= ACCOUNT_CONCURRENCY) {
                        await processAccountBatch(batch)
                        batch = []
                    }
                }
                if (batch.length > 0) {
                    await processAccountBatch(batch)
                }
            }

            switch (config.account_type) {
                case 'NeprofileUser':
                    await listAndProcess(nerm.listUsers(config.account_type))
                    break
                case 'NeaccessUser':
                    await listAndProcess(nerm.listUsers(config.account_type))
                    break
                case 'Profile':
                    const profileType = await nerm.getProfileTypeByName(config.profile_name)
                    await listAndProcess(nerm.listProfiles({ profile_type_id: profileType.id }))
                    break
                default:
                    throw new ConnectorError(`${config.account_type} account type not supported`)
            }

            if (config.push_mode) {
                await pushContents(context, input, res)
            }
        } catch (error) {
            logger.error(`stdAccountList error=${toLogString(error)}`)
        } finally {
            clearInterval(interval)
            opEnd('stdAccountList', 'stream')
        }
    }

    const stdAccountRead: StdAccountReadHandler = async (context, input, res) => {
        opStart('stdAccountRead', input)
        logger.info(input)
        if (!input.schema) {
            const schema = await getSchema()
            input.schema = schema
        }
        const account = await getAccount(input.identity, input.schema)
        send(res, account)
        opEnd('stdAccountRead', account)
    }

    const stdEntitlementList: StdEntitlementListHandler = async (context, input, res) => {
        opStart('stdEntitlementList', input)
        logger.info(input)
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
                            const entitlement = new Profile(profile, input.type, profileConf.attributes)
                            send(res, entitlement)
                        }
                    }
                }
        }
        opEnd('stdEntitlementList', 'stream')
    }

    const stdAccountCreate: StdAccountCreateHandler = async (context, input, res) => {
        opStart('stdAccountCreate', input)
        logger.debug(`Creating account with input: ${JSON.stringify(input)}`)
        const operations = ['create']
        logger.info(input)
        if (!input.schema) {
            const schema = await getSchema()
            input.schema = schema
        }
        let account = await createAccount(input)

        if (input.attributes.types) {
            const types = [input.attributes.types].flat()
            for (const type of types) {
                await addType(account, type)
            }
        }

        if (input.attributes.roles) {
            const roles = [input.attributes.roles].flat()
            for (const role of roles) {
                await addRole(account, role)
            }
        }

        if (input.attributes.workflows && config.account_type === 'Profile') {
            const workflows = [input.attributes.workflows].flat()
            let wait = false
            for (const workflow of workflows) {
                wait = config.workflows?.find((x) => x.workflow === workflow)?.wait || wait
                await addWorkflow(account, workflow, wait)
            }
            if (wait) {
                account = await getAccount(account.identity as string, input.schema)
            }
        }

        const entitlementSchemas = input.schema?.attributes.filter(
            (x) => x.schemaObjectType && !ENTITLEMENT_ATTRIBUTES.includes(x.name)
        )
        for (const [key, value] of Object.entries(input.attributes)) {
            const entitlementSchema = entitlementSchemas.find((x) => x.name === key)
            if (entitlementSchema) {
                operations.push(entitlementSchema.schemaObjectType!)
                await profileAttributeOp(account, key, value as any, 'add')
            }
        }

        if (account && config.account_type === 'Profile') {
            for (const operation of operations) {
                account = await processOperation(account, operation, input.schema)
            }
            send(res, account)
            opEnd('stdAccountCreate', account)
        }
    }

    const stdAccountUpdate: StdAccountUpdateHandler = async (context, input, res) => {
        opStart('stdAccountUpdate', input)
        logger.debug(`Updating account ${input.identity} with changes: ${JSON.stringify(input.changes)}`)
        const operations = ['update']
        logger.info(input)
        if (!input.schema) {
            const schema = await getSchema()
            input.schema = schema
        }

        if (input.changes) {
            let wait = false
            let account = await getAccount(input.identity, input.schema)
            const types = account.attributes.types as string[]
            account.attributes.roles = account.attributes.roles ?? []
            const roles = account.attributes.roles as string[]
            const isProfile = config.account_type === 'Profile'
            let isUser = types.includes('NeprofileUser') || types.includes('NeaccessUser') || roles.length > 0
            for (const change of input.changes) {
                const values = [change.value].flat()
                for (const value of values) {
                    switch (change.op) {
                        case 'Add':
                            switch (change.attribute) {
                                case 'types':
                                    if (value !== 'Profile') {
                                        await addType(account, value)
                                        account = await getAccount(input.identity, input.schema)
                                        isUser = true
                                    } else {
                                        await addType(account, value)
                                    }
                                    break
                                case 'roles':
                                    if (isUser) {
                                        await addRole(account, value)
                                    }
                                    break
                                case 'workflows':
                                    if (isProfile) {
                                        wait = config.workflows?.find((x) => x.workflow === value)?.wait || wait
                                        await addWorkflow(account, value, wait)
                                    }
                                    break
                                default:
                                    const entitlementSchema = input.schema?.attributes.find(
                                        (x) => x.name === change.attribute && x.schemaObjectType
                                    )
                                    if (entitlementSchema && isProfile) {
                                        operations.push(entitlementSchema.schemaObjectType as string)
                                        await profileAttributeOp(account, change.attribute, change.value, 'add')
                                    } else {
                                        const message = `"${change.attribute}" entitlement attribute not supported`
                                        throw new ConnectorError(message)
                                    }
                            }
                            break
                        case 'Remove':
                            switch (change.attribute) {
                                case 'types':
                                    await removeType(account, value)
                                    break
                                case 'roles':
                                    await removeRole(account, value)
                                    break
                                case 'workflows':
                                    await removeWorkflow(account, value)
                                    break
                                default:
                                    if (
                                        input.schema?.attributes.find(
                                            (x) => x.name === change.attribute && x.schemaObjectType
                                        )
                                    ) {
                                        await profileAttributeOp(account, change.attribute, change.value, 'remove')
                                    } else {
                                        const message = `"${change.attribute}" entitlement attribute not supported`
                                        throw new ConnectorError(message)
                                    }
                            }
                            break
                        case 'Set':
                            await setAttribute(account, change.attribute, value)
                    }
                }
            }

            if (account) {
                for (const operation of operations) {
                    account = await processOperation(account, operation, input.schema)
                }
                if (wait) {
                    account = await getAccount(account.identity as string, input.schema)
                }
                send(res, account)
                opEnd('stdAccountUpdate', account)
            }
        }
    }

    const stdAccountEnable: StdAccountEnableHandler = async (context, input, res) => {
        opStart('stdAccountEnable', input)
        logger.debug(`Enabling account ${input.identity}`)
        const attribute = 'status'
        const value = 'Active'
        const operation = 'enable'
        logger.info(input)
        let account = await getAccount(input.identity, input.schema)
        await setAttribute(account, attribute, value)

        if (account) {
            account = await processOperation(account, operation, input.schema)
            send(res, account)
            opEnd('stdAccountEnable', account)
        }
    }

    const stdAccountDisable: StdAccountDisableHandler = async (context, input, res) => {
        opStart('stdAccountDisable', input)
        logger.debug(`Disabling account ${input.identity}`)
        const attribute = 'status'
        const value = 'Inactive'
        const operation = 'disable'
        logger.info(input)
        let account = await getAccount(input.identity, input.schema)
        await setAttribute(account, attribute, value)

        if (account) {
            account = await processOperation(account, operation, input.schema)
            send(res, account)
            opEnd('stdAccountDisable', account)
        }
    }

    const stdAccountDelete: StdAccountDeleteHandler = async (context, input, res) => {
        opStart('stdAccountDelete', input)
        logger.debug(`Deleting account ${input.identity}`)
        const operation = 'delete'
        logger.info(input)
        const account = await getAccount(input.identity, input.schema)
        switch (config.account_type) {
            case 'Profile':
                await nerm.deleteProfile(input.identity)
                if (account.attributes.user_id) {
                    await nerm.deleteUser(account.attributes.user_id as string)
                }
                break

            default:
                await nerm.deleteUser(input.identity)
        }

        if (account) {
            await processOperation(account, operation, input.schema)
            delete account.identity
            send(res, undefined)
            opEnd('stdAccountDelete', undefined)
        }
    }

    const pushContents: CommandHandler = async (context, input, res) => {
        opStart('pushContents', input)
        logger.debug(fnLog('pushContents', 'Pushing contents'))
        const mappings = config.mappings!.sort((a, b) => (a.nested ? (b.nested ? 0 : 1) : -1)) ?? []
        const masterProfileMap: Map<string, any[]> = new Map()
        const masterEntityMap: Map<string, SearchDocument[]> = new Map()

        for (const conf of mappings) {
            const { nested, sync, index, profile, search, parent_index, attribute, id } = conf
            const profileType = await nerm.getProfileTypeByName(profile)
            if (profileType) {
                const params = {
                    profile_type_id: profileType.id,
                }
                const profileMap: Map<string, any> = new Map()
                let profiles: any[] = []
                let existingProfiles = nerm.listProfiles(params)
                let entities = await isc.search(search, index)
                let children: Map<string, Set<string>> = new Map()

                if (nested) {
                    const parents = masterEntityMap.get(parent_index!)!
                    children = parents2children(parents, index)
                }

                for (const entity of entities) {
                    let profile
                    if (!sync || children?.has(entity.id as string)) {
                        profile = entity2profile(entity, profileType.id, conf)
                    }

                    if (nested && profile) {
                        const childParents = children?.get(entity.id as string) ?? new Set()
                        const parentObjects = masterProfileMap.get(parent_index!)
                        if (parentObjects) {
                            const childParentProfiles = parentObjects
                                .filter((x) => childParents.has(x.attributes[id]))
                                .map((x) => x.id)
                            profile.attributes[attribute!] = childParentProfiles
                        }
                    }

                    if (profile) {
                        profileMap.set(entity.id as string, profile)
                    }
                }

                for await (const profile of existingProfiles) {
                    profileMap.delete(profile.attributes[id])
                }
                const pendingProfiles = [...profileMap.values()]
                if (nested) {
                    for (let offset = 0; offset < pendingProfiles.length; offset += BATCH_SIZE) {
                        const batchItems = pendingProfiles.slice(offset, offset + BATCH_SIZE)
                        const responses: Promise<any>[] = batchItems.map((profile) => nerm.createProfile(profile))
                        await Promise.all(responses)
                    }
                } else {
                    await nerm.createProfiles(pendingProfiles)
                }

                if (!nested) {
                    existingProfiles = nerm.listProfiles(params)
                    const ids = entities.map((x) => x.id)
                    for await (const profile of existingProfiles) {
                        if (ids.includes(profile.attributes[id])) {
                            profiles.push(profile)
                        }
                    }
                    masterProfileMap.set(index, profiles)
                    masterEntityMap.set(index, entities)
                }
            }
        }
        opEnd('pushContents', 'done')
    }

    const stdChangePassword: StdChangePasswordHandler = async (context, input, res) => {
        opStart('stdChangePassword', input)
        try {
            if (config.account_type === 'NeaccessUser' || config.account_type === 'NeprofileUser') {
                logger.debug(`Getting user ${input.identity}`)
                await nerm.getUser(input.identity)
                logger.debug(`Changing password for user ${input.identity}`)
                await nerm.setUserAttribute(input.identity, 'password', input.password)
            } else if (config.account_type === 'Profile') {
                let schema = (input as any).schema
                if (!schema) {
                    schema = await getSchema()
                }
                const account = await getAccount(input.identity, schema)
                const user_id = account.attributes.user_id as string
                if (user_id) {
                    logger.debug(
                        `Changing password for portal user ${user_id} associated with profile ${input.identity}`
                    )
                    await nerm.setUserAttribute(user_id, 'password', input.password)
                } else {
                    throw new ConnectorError('Password changes are only supported for portal users.')
                }
            } else {
                throw new ConnectorError('Password changes are only supported for portal users.')
            }
            send(res, {})
            opEnd('stdChangePassword', {})
        } catch (error) {
            if (error instanceof ConnectorError) {
                throw error
            }
            throw new ConnectorError(`Unable to change password: ${toLogString(error)}`)
        }
    }

    return createConnector()
        .stdTestConnection(stdTestConnection)
        .stdAccountDiscoverSchema(stdAccountDiscoverSchema)
        .stdAccountList(stdAccountList)
        .stdAccountRead(stdAccountRead)
        .stdEntitlementList(stdEntitlementList)
        .stdAccountCreate(stdAccountCreate)
        .stdAccountUpdate(stdAccountUpdate)
        .stdAccountEnable(stdAccountEnable)
        .stdAccountDisable(stdAccountDisable)
        .stdAccountDelete(stdAccountDelete)
        .stdChangePassword(stdChangePassword)
        .command('custom:push:contents', pushContents)
}
