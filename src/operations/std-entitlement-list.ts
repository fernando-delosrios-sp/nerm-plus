import { StdEntitlementListHandler, logger } from '@sailpoint/connector-sdk'
import { ConnectorContext } from '../connector-context'
import { EntitlementService } from '../services/entitlement-service'
import { typeEntitlements } from '../data/types'
import { Profile, Role, Type, Workflow } from '../model/entitlement'
import { opEnd, opStart, toLogString } from '../logging'

export function createStdEntitlementList(
    ctx: ConnectorContext,
    entitlementService: EntitlementService
): StdEntitlementListHandler {
    return async (context, input, res) => {
        opStart('stdEntitlementList', input)
        logger.info(toLogString(input))
        switch (input.type) {
            case 'type':
                for await (const type of typeEntitlements) {
                    const entitlement = new Type(type)
                    res.send(entitlement)
                }
                break
            case 'role': {
                const roles = await entitlementService.listRoles()
                for await (const role of roles) {
                    const entitlement = new Role(role)
                    res.send(entitlement)
                }
                break
            }
            case 'workflow':
                if (ctx.config.workflows) {
                    // ⚡ Bolt: Replace [].flat() with allocation-free ternary checks
                    const workflows = Array.isArray(ctx.config.workflows)
                        ? ctx.config.workflows
                        : [ctx.config.workflows]
                    for (const workflow of workflows) {
                        const entitlement = new Workflow(workflow)
                        res.send(entitlement)
                    }
                }
                break
            default:
                if (ctx.config.profiles) {
                    const profileConf = ctx.config.profiles.find((x) => x.name === input.type)
                    if (profileConf) {
                        const profileObject = await entitlementService.getProfileTypeByName(profileConf.name)
                        const profiles = await entitlementService.listProfiles(profileObject.id)
                        for await (const profile of profiles) {
                            const entitlement = new Profile(profile, input.type, profileConf.attributes)
                            res.send(entitlement)
                        }
                    }
                }
        }
        opEnd('stdEntitlementList', 'stream')
    }
}
