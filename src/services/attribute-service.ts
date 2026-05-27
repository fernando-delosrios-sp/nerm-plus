import { logger, StdAccountListOutput } from '@sailpoint/connector-sdk'
import { ConnectorContext } from '../connector-context'

export class AttributeService {
    constructor(private ctx: ConnectorContext) {}

    async setAttributes(account: StdAccountListOutput, attributes: Record<string, any>) {
        logger.debug(`Setting attributes ${Object.keys(attributes).join(', ')} for account ${account.uuid}`)
        switch (this.ctx.config.account_type) {
            case 'Profile':
                for (const [attribute, value] of Object.entries(attributes)) {
                    if (attribute === 'workflows') {
                        const serialized = (value as string[]).join(',')
                        await this.ctx.nerm.setProfileAttribute(account.identity!, attribute, serialized)
                    } else {
                        await this.ctx.nerm.setProfileAttribute(account.identity!, attribute, value)
                    }
                }
                const id = account.attributes.user_id as string
                if (id) {
                    const userUpdates: Record<string, any> = {}
                    if (this.ctx.config.login_attribute && attributes[this.ctx.config.login_attribute] !== undefined) {
                        userUpdates.login = attributes[this.ctx.config.login_attribute]
                    }
                    if (attributes['name'] !== undefined) {
                        userUpdates.name = attributes['name']
                    }
                    if (attributes['email'] !== undefined) {
                        userUpdates.email = attributes['email']
                    }
                    if (Object.keys(userUpdates).length > 0) {
                        await this.ctx.nerm.updateUser(id, userUpdates)
                    }
                }
                break
            case 'NeprofileUser':
            case 'NeaccessUser':
                await this.ctx.nerm.updateUser(account.identity!, attributes)
                break
        }

        for (const [attribute, value] of Object.entries(attributes)) {
            if (attribute === 'status') {
                account.disabled = value === 'Active' ? false : true
                if (account.attributes.user_id) {
                    const user_id = account.attributes.user_id as string
                    try {
                        await this.ctx.nerm.setUserAttribute(user_id, attribute, value)
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
    }

    async setAttribute(account: StdAccountListOutput, attribute: string, value: any) {
        return this.setAttributes(account, { [attribute]: value })
    }

    async profileAttributeOp(account: any, attribute: string, value: string, op: 'add' | 'remove') {
        logger.debug(
            `Performing ${op} operation on attribute ${attribute} with value ${value} for account ${account.identity}`
        )
        const profile = await this.ctx.nerm.getProfile(account.identity)
        const currentValue = await this.ctx.nerm.getAttributeRecursively(profile, attribute)
        let newValue
        if (op === 'add') {
            newValue = [...currentValue.map((x: { id: string }) => x.id), value]
        } else {
            newValue = currentValue.filter((x: { id: string }) => x.id !== value).map((x: { id: string }) => x.id)
        }

        await this.setAttribute(account, attribute, newValue)
    }
}
