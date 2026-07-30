import {
    AccountSchema,
    Attributes,
    ConnectorError,
    logger,
    StdAccountCreateInput,
    StdAccountListOutput,
} from '@sailpoint/connector-sdk'
import { AccountType } from '../model/config'
import { ConnectorContext } from '../connector-context'
import { NeaccessUserAccount, NeprofileUserAccount, ProfileAccount } from '../model/account'
import {
    ENTITLEMENT_ATTRIBUTES,
    PROFILE_ROOTATTRIBUTES,
    PROFILETYPE_ATTRIBUTES,
    USERONLY_ATTRIBUTES,
    USERTYPE_ATTRIBUTES,
} from '../data/constants'
import { getStatus, resolveUserAttributes, updateTypes } from '../utils'
import { toLogString } from '../logging'

export class AccountService {
    constructor(private ctx: ConnectorContext) {}

    async buildNERMAccountBody(attributes: Attributes, type: AccountType, schema?: AccountSchema): Promise<any> {
        logger.debug(`Building NERM account body for type: ${type}`)
        let body: any = {
            status: attributes?.status ?? 'Active',
            name: attributes.name,
        }
        switch (type) {
            case 'Profile': {
                const profileType = await this.ctx.nerm.getProfileTypeByName(this.ctx.config.profile_name)
                body.profile_type_id = profileType.id
                body.attributes = {}

                const relevantAttrs = schema!.attributes.filter((attr) => {
                    if (ENTITLEMENT_ATTRIBUTES.has(attr.name)) return false
                    // ⚡ Bolt: Optimize leaf extraction hot path by replacing array-allocating split().pop() with slice()
                    const leafIdx = attr.name.lastIndexOf('.')
                    const leaf = leafIdx !== -1 ? attr.name.slice(leafIdx + 1) : attr.name
                    return attributes[attr.name] != null || attributes[leaf] != null
                })

                const attrResults = (
                    await Promise.all(
                        relevantAttrs.map(async (attribute) => {
                            // ⚡ Bolt: Optimize leaf extraction hot path by replacing array-allocating split().pop() with slice()
                            const leafIdx = attribute.name.lastIndexOf('.')
                            const leaf = leafIdx !== -1 ? attribute.name.slice(leafIdx + 1) : attribute.name
                            const rawValue = attributes[attribute.name] ?? attributes[leaf]
                            if (rawValue == null) {
                                return null
                            }

                            const key = leaf
                            const attributeType = await this.ctx.nerm.getAttribute(key)
                            const values = [rawValue].flat()
                            const isMulti = attribute.multi ?? Array.isArray(rawValue)

                            let finalValue
                            if (PROFILETYPE_ATTRIBUTES.has(attributeType?.type)) {
                                const uniqueValues = Array.from(new Set(values))
                                const uniqueProfiles = await Promise.all(
                                    uniqueValues.map((v) =>
                                        this.ctx.nerm.resolveProfileByValueOrName(
                                            v as string,
                                            attributeType.profile_type_id
                                        )
                                    )
                                )
                                const profileMap = new Map(uniqueValues.map((v, i) => [v, uniqueProfiles[i]]))
                                const profiles = values.map((v) => profileMap.get(v))

                                const unresolvedProfileValues = values.filter((_, i) => !profiles[i])
                                if (unresolvedProfileValues.length > 0) {
                                    logger.warn(
                                        `buildNERMAccountBody: profile reference not resolved for attribute "${
                                            attribute.name
                                        }" (key=${key}, profile_type_id=${
                                            attributeType.profile_type_id
                                        }): ${unresolvedProfileValues.map((v) => toLogString(v)).join('; ')}`
                                    )
                                }
                                finalValue = profiles.filter((p) => p).map((p) => p.id)
                            } else if (USERTYPE_ATTRIBUTES.has(attributeType?.type)) {
                                const uniqueUserValues = Array.from(new Set(values))
                                const uniqueIds = await Promise.all(
                                    uniqueUserValues.map((v) =>
                                        this.ctx.nerm.resolveUserReferenceValueForApi(String(v))
                                    )
                                )
                                const userMap = new Map(uniqueUserValues.map((v, i) => [v, uniqueIds[i]]))
                                const ids = values.map((v) => userMap.get(v))

                                const unresolvedUserValues = values.filter((_, i) => !ids[i])
                                if (unresolvedUserValues.length > 0) {
                                    logger.warn(
                                        `buildNERMAccountBody: user reference not resolved to a user id for attribute "${
                                            attribute.name
                                        }" (key=${key}): ${unresolvedUserValues.map((v) => toLogString(v)).join('; ')}`
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
                ).filter((r): r is { key: string; finalValue: any } => r != null)
                for (const { key, finalValue } of attrResults) {
                    if (PROFILE_ROOTATTRIBUTES.has(key)) {
                        body[key] = finalValue
                    } else {
                        body.attributes[key] = finalValue
                    }
                }
                break
            }
            case 'NeprofileUser':
            case 'NeaccessUser':
                if (!this.ctx.config.login_attribute || !attributes[this.ctx.config.login_attribute]) {
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
                if (type === 'NeaccessUser') {
                    body.profile_id = body.identity
                }
                break

            default:
        }
        delete body.id
        body.status = getStatus(body.status, type)

        return body
    }

    async getAccount(id: string, schema?: AccountSchema): Promise<StdAccountListOutput> {
        logger.debug(`Getting account with ID: ${id}`)
        let response: any

        switch (this.ctx.config.account_type) {
            case 'NeprofileUser':
            case 'NeaccessUser':
                response = await this.ctx.nerm.getUser(id)
                break
            case 'Profile':
                response = await this.ctx.nerm.getProfile(id)
                break
            default:
                throw new ConnectorError(`${this.ctx.config.account_type} account type not supported`)
        }

        if (!response) {
            const message = `${this.ctx.config.account_type} with ID "${id} not found"`
            throw new ConnectorError(message)
        }
        return await this.buildAccount(response, schema)
    }

    async buildAccount(nermObject: any, schema?: AccountSchema): Promise<StdAccountListOutput> {
        if (nermObject == null) {
            throw new ConnectorError('Cannot build account: missing NERM response data')
        }
        logger.debug(`Building account from NERM object: ${toLogString(nermObject)}`)
        let account: StdAccountListOutput
        let id: string | undefined
        let attributes: Attributes = {}
        switch (this.ctx.config.account_type) {
            case 'Profile':
                account = new ProfileAccount(nermObject)
                if (schema) {
                    attributes = await this.ctx.nerm.resolveProfileAttributes(nermObject, schema)
                }
                id = attributes.user_id as string
                break
            case 'NeprofileUser':
            case 'NeaccessUser':
                account =
                    this.ctx.config.account_type === 'NeprofileUser'
                        ? new NeprofileUserAccount(nermObject)
                        : new NeaccessUserAccount(nermObject)
                attributes = resolveUserAttributes(nermObject, schema)
                account.attributes[this.ctx.config.login_attribute] = nermObject.login
                if (this.ctx.config.account_type === 'NeprofileUser' && account.attributes.workflows) {
                    account.attributes.workflows = (account.attributes.workflows as string).split(',')
                }
                id = account.identity
                break
        }

        account.attributes = { ...attributes, ...account.attributes }

        if (id) {
            let roleAssignments: any[] | undefined
            if (this.ctx.config.account_type === 'Profile') {
                let user: any
                ;[user, roleAssignments] = await Promise.all([
                    this.ctx.nerm.getUser(id),
                    this.ctx.nerm.getUserRoleAssignments(id),
                ])
                if (user) {
                    const type = user.type as AccountType
                    if (this.ctx.config.login_attribute) {
                        updateTypes(account.attributes, type, { [this.ctx.config.login_attribute]: user.login })
                    } else {
                        updateTypes(account.attributes, type)
                    }
                }
            } else {
                roleAssignments = await this.ctx.nerm.getUserRoleAssignments(id)
            }

            if (roleAssignments) {
                account.attributes.roles = roleAssignments.map((x: { role_id: any }) => x.role_id)
            }
        }

        return account!
    }

    async createAccount(input: StdAccountCreateInput): Promise<StdAccountListOutput> {
        logger.debug(`Creating account with input: ${toLogString(input)}`)
        const body = await this.buildNERMAccountBody(input.attributes, this.ctx.config.account_type, input.schema)
        let rawAccount
        switch (this.ctx.config.account_type) {
            case 'Profile':
                rawAccount = await this.ctx.nerm.createProfile(body)
                break
            case 'NeprofileUser':
            case 'NeaccessUser':
                rawAccount = await this.ctx.nerm.createUser(body)
                break
        }

        const account = await this.buildAccount(rawAccount, input.schema)

        return account
    }

    async listAccounts(): Promise<AsyncGenerator<any>> {
        switch (this.ctx.config.account_type) {
            case 'NeprofileUser':
            case 'NeaccessUser':
                return this.ctx.nerm.listUsers(this.ctx.config.account_type)
            case 'Profile': {
                const profileType = await this.ctx.nerm.getProfileTypeByName(this.ctx.config.profile_name)
                return this.ctx.nerm.listProfiles({ profile_type_id: profileType.id })
            }
            default:
                throw new ConnectorError(`${this.ctx.config.account_type} account type not supported`)
        }
    }

    async deleteAccount(identity: string, user_id?: string): Promise<void> {
        switch (this.ctx.config.account_type) {
            case 'Profile':
                await this.ctx.nerm.deleteProfile(identity)
                if (user_id) {
                    await this.ctx.nerm.deleteUser(user_id)
                }
                break
            default:
                await this.ctx.nerm.deleteUser(identity)
        }
    }

    async changePassword(identity: string, password: string, schema?: AccountSchema): Promise<void> {
        if (this.ctx.config.account_type === 'NeaccessUser' || this.ctx.config.account_type === 'NeprofileUser') {
            logger.debug(`Getting user ${identity}`)
            await this.ctx.nerm.getUser(identity)
            logger.debug(`Changing password for user ${identity}`)
            await this.ctx.nerm.setUserAttribute(identity, 'password', password)
            return
        }

        if (this.ctx.config.account_type === 'Profile') {
            const account = await this.getAccount(identity, schema)
            const user_id = account.attributes.user_id as string
            if (user_id) {
                logger.debug(`Changing password for portal user ${user_id} associated with profile ${identity}`)
                await this.ctx.nerm.setUserAttribute(user_id, 'password', password)
                return
            }
        }

        throw new ConnectorError('Password changes are only supported for portal users.')
    }
}
