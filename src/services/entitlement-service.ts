import { ConnectorError, logger, StdAccountListOutput } from '@sailpoint/connector-sdk'
import { AccountType, RequesterType } from '../model/config'
import { ConnectorContext } from '../connector-context'
import { AccountService } from './account-service'
import { AttributeService } from './attribute-service'
import { getRoleType, updateTypes } from '../utils'
import { toLogString } from '../logging'

export class EntitlementService {
    constructor(
        private ctx: ConnectorContext,
        private accountService: AccountService,
        private attributeService: AttributeService
    ) {}

    async addType(account: StdAccountListOutput, type: AccountType) {
        if (type === this.ctx.config.account_type) return

        logger.info(`Adding ${type} type to ${account.uuid}`)
        const name = account.uuid as string

        if (type === 'Profile') {
            throw new ConnectorError(`"Add Profile type" operation not supported`)
        }

        if (this.ctx.config.account_type !== 'Profile') {
            throw new ConnectorError(`Only one user type is allowed per account`)
        }

        const user_id = account.attributes.user_id as string
        if (user_id) {
            const response = await this.ctx.nerm.getUser(user_id)
            if (response) {
                const roleAssignments = await this.ctx.nerm.getUserRoleAssignments(user_id)
                if (roleAssignments) {
                    account.attributes.roles = roleAssignments.map((x: { role_id: any }) => x.role_id)
                }
            }

            updateTypes(account.attributes, type)
            return
        }

        const login = this.ctx.config.login_attribute
            ? (account.attributes[this.ctx.config.login_attribute] as string)
            : undefined

        if (!login) {
            throw new ConnectorError('Missing login attribute for user creation')
        }

        const attributes = { ...account.attributes, login, name }
        let response = await this.ctx.nerm.getUserByLoginAndType(login, type)
        if (!response) {
            const body = await this.accountService.buildNERMAccountBody(attributes, type)
            response = await this.ctx.nerm.createUser(body)
        }

        if (response) {
            account.attributes.user_id = response.id
            await this.ctx.nerm.setProfileAttribute(account.identity!, 'user_id', response.id)
        } else {
            throw new ConnectorError(`Failed to add "${type}" type to ${account.uuid}`)
        }

        updateTypes(account.attributes, type)
    }
    async removeType(account: StdAccountListOutput, type: AccountType) {
        logger.info(`Removing ${type} type to ${account.uuid}`)
        if (this.ctx.config.account_type === type) {
            const message = `Cannot remove account base type`
            throw new ConnectorError(message)
        }

        const id = account.attributes.user_id as string
        if (!id) {
            const message = `User not found for "${account.uuid}" profile`
            logger.error(message)
            return
        }

        await this.ctx.nerm.deleteUser(id)
        await this.attributeService.setAttribute(account, 'user_id', undefined)
        const types = account.attributes.types as string[]
        types.splice(types.indexOf(type), 1)
    }

    private async resolveUserIdForRole(account: StdAccountListOutput, role_id: string): Promise<string> {
        const role = await this.ctx.nerm.getRole(role_id)
        const type = getRoleType(role)
        switch (this.ctx.config.account_type) {
            case 'Profile':
                if (!account.attributes.user_id) {
                    await this.addType(account, type)
                }
                return account.attributes.user_id as string
            default:
                return account.identity!
        }
    }

    async addRole(account: StdAccountListOutput, role_id: string) {
        logger.info(`Adding ${role_id} role to ${account.uuid}`)
        const id = await this.resolveUserIdForRole(account, role_id)

        account.attributes.roles = account.attributes.roles ?? []
        const roles = account.attributes.roles as string[]

        if (!roles.includes(role_id)) {
            await this.ctx.nerm.addRole(id, role_id)
            roles.push(role_id)
        }
    }

    async removeRole(account: StdAccountListOutput, role_id: string) {
        logger.info(`Removing ${role_id} role to ${account.uuid}`)
        const id = await this.resolveUserIdForRole(account, role_id)

        account.attributes.roles = account.attributes.roles ?? []
        const roles = account.attributes.roles as string[]

        if (roles.includes(role_id)) {
            await this.ctx.nerm.removeRole(id, role_id)
            roles.splice(roles.indexOf(role_id), 1)
        }
    }

    async runWorkflow(
        account: StdAccountListOutput,
        workflow_id: string,
        requester: RequesterType,
        wait: boolean = false
    ): Promise<any> {
        logger.debug(`Running workflow ${workflow_id} for account ${account.uuid} with requester ${requester}`)
        let requester_id
        const requester_type = 'NeprofileUser'
        if (requester === 'admin') {
            if (!this.ctx.cachedAdminUserId) {
                const admin = await this.ctx.nerm.getUserByNameAndType(this.ctx.config.nerm_admin, 'NeprofileUser')
                this.ctx.cachedAdminUserId = admin?.id
            }
            requester_id = this.ctx.cachedAdminUserId
        } else {
            requester_id = account.attributes[requester]
        }
        if (!requester_id) {
            const message = `Unable to resolve ${requester} for workflow ${workflow_id}`
            logger.error(message)
            return
        }

        const body: { [key: string]: any } = {
            workflow_id,
            requester_id,
            requester_type,
        }
        if (account.identity !== '') {
            body.profile_id = account.identity
        }
        const response = await this.ctx.nerm.createWorkflowSession(body, wait)
        if (response) {
            return response
        }
    }

    async removeWorkflow(account: StdAccountListOutput, workflow_id: string) {
        logger.debug(`Removing workflow ${workflow_id} from account ${account.uuid}`)
        const current = (account.attributes.workflows as string[]) ?? []
        current.splice(current.indexOf(workflow_id), 1)
        await this.attributeService.setAttribute(account, 'workflows', current)
    }

    async addWorkflow(account: StdAccountListOutput, workflow_id: string, waitFlag: boolean = false) {
        logger.debug(`Adding workflow ${workflow_id} to account ${account.uuid}`)
        const workflow = this.ctx.config.workflows?.find((x) => x.workflow === workflow_id)

        if (!workflow) {
            const message = `Unable to find configuration for workflow ${workflow_id}`
            throw new ConnectorError(message)
        }

        const { requester_id, persistent } = workflow
        await this.runWorkflow(account, workflow_id, requester_id, waitFlag)

        if (persistent) {
            const current = (account.attributes.workflows as string[]) ?? []
            current.push(workflow_id)
            await this.attributeService.setAttribute(account, 'workflows', current)
        }
    }

    async listRoles(): Promise<AsyncGenerator<any>> {
        return this.ctx.nerm.listRoles()
    }

    async listProfiles(profileTypeId: string): Promise<AsyncGenerator<any>> {
        return this.ctx.nerm.listProfiles({ profile_type_id: profileTypeId })
    }

    async getProfileTypeByName(name: string): Promise<any> {
        return this.ctx.nerm.getProfileTypeByName(name)
    }
}
