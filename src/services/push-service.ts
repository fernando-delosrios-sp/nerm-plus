import { CommandHandler, logger } from '@sailpoint/connector-sdk'
import { ConnectorContext } from '../connector-context'
import { BATCH_SIZE } from '../data/constants'
import { entity2profile, parents2children } from '../utils'
import { fnLog } from '../logging'

export class PushService {
    constructor(private ctx: ConnectorContext) {}

    pushContents: CommandHandler = async (context, input, res) => {
        logger.debug(fnLog('pushContents', 'Pushing contents'))
        const mappings = this.ctx.config.mappings!.sort((a, b) => (a.nested ? (b.nested ? 0 : 1) : -1)) ?? []
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

                let parentObjectsMap: Map<string, string[]> | undefined

                if (nested) {
                    const parents = masterEntityMap.get(parent_index!)!
                    children = parents2children(parents, index)

                    // ⚡ Bolt: Build a map of parent objects for O(1) lookups instead of filtering array per entity
                    // Impact: Reduces time complexity from O(N*M) to O(N+M) during nested profile resolution
                    const parentObjects = masterProfileMap.get(parent_index!)
                    if (parentObjects) {
                        parentObjectsMap = new Map()
                        for (const p of parentObjects) {
                            const pId = p.attributes[id]
                            // ⚡ Bolt: Optimize Map population overhead by replacing .has(), .set(), .get() with a single .get()
                            let list = parentObjectsMap.get(pId)
                            if (!list) {
                                list = []
                                parentObjectsMap.set(pId, list)
                            }
                            list.push(p.id)
                        }
                    }
                }

                for (const entity of entities) {
                    let profile
                    if (!sync || children?.has(entity.id as string)) {
                        profile = entity2profile(entity, profileType.id, conf)
                    }

                    if (nested && profile) {
                        const childParents = children?.get(entity.id as string) ?? new Set()
                        if (parentObjectsMap) {
                            const childParentProfiles: string[] = []
                            for (const parentId of childParents) {
                                const mappedIds = parentObjectsMap.get(parentId)
                                if (mappedIds) {
                                    childParentProfiles.push(...mappedIds)
                                }
                            }
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
                    // ⚡ Bolt: Convert ids array to a Set for O(1) lookups instead of O(N) array.includes() inside the loop
                    // Impact: Reduces time complexity from O(N²) to O(N) when syncing profiles
                    const ids = new Set(entities.map((x) => x.id))
                    for await (const profile of existingProfiles) {
                        if (ids.has(profile.attributes[id])) {
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
