import { logger, StdAccountListOutput } from '@sailpoint/connector-sdk'
import { ConnectorContext } from '../connector-context'

export class AttributeService {
    constructor(private ctx: ConnectorContext) {}

    async setAttribute(account: StdAccountListOutput, attribute: string, value: any) {
        logger.debug(`Setting attribute ${attribute} to value ${value} for account ${account.uuid}`)
        switch (this.ctx.config.account_type) {
            case 'Profile':
                if (attribute === 'workflows') {
                    const serialized = (value as string[]).join(',')
                    await this.ctx.nerm.setProfileAttribute(account.identity!, attribute, serialized)
                } else {
                    await this.ctx.nerm.setProfileAttribute(account.identity!, attribute, value)
                }
                const id = account.attributes.user_id as string
                if (id) {
                    const userUpdates: Record<string, any> = {}

                    if (attribute === this.ctx.config.login_attribute) {
                        userUpdates.login = value
                    }

                    if (attribute === 'name') {
                        userUpdates.name = value
                    }

                    if (attribute === 'email') {
                        userUpdates.email = value
                    }

                    if (Object.keys(userUpdates).length > 0) {
                        await this.ctx.nerm.updateUser(id, userUpdates)
                    }
                }
                break
            case 'NeprofileUser':
            case 'NeaccessUser':
                await this.ctx.nerm.setUserAttribute(account.identity!, attribute, value)
                break
        }

        if (attribute === 'status') {
            account.disabled = value !== 'Active'
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
