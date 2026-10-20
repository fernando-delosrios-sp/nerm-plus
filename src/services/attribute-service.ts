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
        let newValue: string[] = []
        if (op === 'add') {
            for (const x of currentValue) {
                newValue.push(x.id)
            }
            newValue.push(value)
        } else {
            for (const x of currentValue) {
                if (x.id !== value) {
                    newValue.push(x.id)
                }
            }
        }

        await this.setAttribute(account, attribute, newValue)
    }
}
