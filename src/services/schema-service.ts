import { AccountSchema, ConnectorError, logger, SchemaAttribute } from '@sailpoint/connector-sdk'
import { ConnectorContext } from '../connector-context'
import { apiSchema2Schema, profile2EntitlementSchema } from '../utils'
import { defaultAccountSchema } from '../data/schema'
import { PROFILEONLY_ATTRIBUTES, USERONLY_ATTRIBUTES } from '../data/constants'
import { fnLog, toLogString } from '../logging'

export class SchemaService {
    constructor(private ctx: ConnectorContext) {}

    async getSchema(): Promise<AccountSchema> {
        logger.debug('Getting schema from ISC')
        const sources = await this.ctx.isc.listSources()
        const source = sources.find(
            (x) => (x.connectorAttributes as any).spConnectorInstanceId === this.ctx.spConnectorInstanceId
        )
        if (!source) {
            const error = `Unable to find source with spConnectorInstanceId "${this.ctx.spConnectorInstanceId}"`
            throw new ConnectorError(error)
        }

        const schemas = await this.ctx.isc.listSourceSchemas(source.id!)
        const accountSchema = schemas.find((x) => x.nativeObjectType === 'User')!

        return apiSchema2Schema(accountSchema)
    }

    async testConnection(): Promise<void> {
        logger.debug(fnLog('testConnection', 'Testing connection'))
        await this.ctx.isc.getPublicIdentityConfig()
        const iterator = this.ctx.nerm.listProfileTypes()
        await iterator.next()
    }

    async discoverSchema(): Promise<AccountSchema> {
        logger.debug(fnLog('discoverSchema', 'Discovering account schema'))
        let schema: AccountSchema
        const profileEntitlements: SchemaAttribute[] = []
        const sources = await this.ctx.isc.listSources()
        const source = sources.find(
            (x) => (x.connectorAttributes as any).spConnectorInstanceId === this.ctx.spConnectorInstanceId
        )!

        if (!source) {
            const error = `Unable to find source with spConnectorInstanceId "${this.ctx.spConnectorInstanceId}"`
            throw new ConnectorError(error)
        }

        const schemas = await this.ctx.isc.listSourceSchemas(source.id!)
        if (this.ctx.config.profiles && this.ctx.config.account_type === 'Profile') {
            const schemaNames = schemas.map((x) => x.name)

            const profilePromises = this.ctx.config.profiles.map(async (profile: any) => {
                const [profileType, profileAttribute] = await Promise.all([
                    this.ctx.nerm.getProfileTypeByName(profile.name),
                    this.ctx.nerm.getAttribute(profile.attribute),
                ])
                return { profile, profileType, profileAttribute }
            })

            const resolvedProfiles = await Promise.all(profilePromises)

            for (const { profile, profileType, profileAttribute } of resolvedProfiles) {
                if (profileType) {
                    if (!schemaNames.includes(profile.name)) {
                        const profileData = { ...profileType, attributes: profile.attributes }
                        const profileSchema = profile2EntitlementSchema(profileData)
                        this.ctx.isc.createSchema(profileSchema, source.id!)
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

        switch (this.ctx.config.account_type) {
            case 'Profile':
                schema.attributes = schema.attributes.filter((x) => !USERONLY_ATTRIBUTES.includes(x.name))
                if (this.ctx.config.login_attribute) {
                    const login: SchemaAttribute = {
                        name: this.ctx.config.login_attribute,
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

        return schema!
    }
}
