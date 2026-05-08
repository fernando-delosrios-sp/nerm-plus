import { CommandHandler, logger } from '@sailpoint/connector-sdk'
import { ConnectorContext } from '../connector-context'
import { BATCH_SIZE } from '../data/constants'
import { entity2profile, parents2children } from '../utils'
import { fnLog } from '../logging'

export class PushService {
    constructor(private ctx: ConnectorContext) {}

    pushContents: CommandHandler = async (context, input, res) => {
        logger.debug(fnLog('pushContents', 'Pushing contents'))
        const mappings =
            this.ctx.config.mappings!.sort((a, b) => (a.nested ? (b.nested ? 0 : 1) : -1)) ?? []
        const masterProfileMap: Map<string, any[]> = new Map()
        const masterEntityMap: Map<string, any[]> = new Map()

        for (const conf of mappings) {
            const { nested, sync, index, profile, search, parent_index, attribute, id } = conf
            const profileType = await this.ctx.nerm.getProfileTypeByName(profile)
            if (profileType) {
                const params = {
                    profile_type_id: profileType.id,
                }
                const profileMap: Map<string, any> = new Map()
                let profiles: any[] = []
                let existingProfiles = this.ctx.nerm.listProfiles(params)
                let entities = await this.ctx.isc.search(search, index)
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
                        const responses: Promise<any>[] = batchItems.map((profile) =>
                            this.ctx.nerm.createProfile(profile)
                        )
                        await Promise.all(responses)
                    }
                } else {
                    await this.ctx.nerm.createProfiles(pendingProfiles)
                }

                if (!nested) {
                    existingProfiles = this.ctx.nerm.listProfiles(params)
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
    }
}
