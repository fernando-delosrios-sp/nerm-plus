import axios, { AxiosRequestConfig } from 'axios'
import axiosThrottle from 'axios-request-throttle'
import axiosRetry from 'axios-retry'
import { AxiosCacheInstance, setupCache } from 'axios-cache-interceptor'
import { retriesConfig, throttleConfig } from './axios'
import {
    ACCOUNT_CONCURRENCY,
    BATCH_SIZE,
    ENTITLEMENT_ATTRIBUTES,
    PROFILE_ROOTATTRIBUTES,
    PROFILETYPE_ATTRIBUTES,
    QUERYLIMIT,
    QUERYORDER,
    RETRIES,
    USERTYPE_ATTRIBUTES,
    WORKFLOW_PENDINGSTATUSES,
} from './data/constants'
import { AccountSchema, ConnectorError, logger } from '@sailpoint/connector-sdk'
import { getEmailFromUserAttribute } from './utils'
import { toLogString } from './logging'

type UserType = 'NeprofileUser' | 'NeaccessUser'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function looksLikeUuid(value: string): boolean {
    const trimmed = value.trim()
    if (trimmed.length !== 36) return false
    return UUID_PATTERN.test(trimmed)
}

/** NERM often returns only `error: "The Profile failed to create/update"`; merge status + full body for debugging. */
function formatHttpError(err: any): string {
    const res = err.response
    if (!res) {
        return err.message ?? String(err)
    }
    const status = res.status
    const data = res.data
    const prefix = status != null ? `HTTP ${status}` : 'Request failed'
    if (data == null || data === '') {
        return `${prefix}: ${err.message ?? ''}`.trim()
    }
    if (typeof data === 'string') {
        return `${prefix}: ${data}`
    }
    const pieces: string[] = []
    if (typeof data.error === 'string') {
        pieces.push(data.error)
    } else if (data.error != null) {
        pieces.push(`error: ${toLogString(data.error)}`)
    }
    if (data.message != null && String(data.message) !== String(data.error)) {
        pieces.push(String(data.message))
    }
    if (data.errors != null) {
        pieces.push(`errors: ${toLogString(data.errors)}`)
    }
    if (data.base != null) {
        pieces.push(`base: ${toLogString(data.base)}`)
    }
    if (pieces.length > 0) {
        return `${prefix}: ${pieces.join(' | ')}`
    }
    let full: string = toLogString(data)
    const max = 4000
    if (full.length > max) {
        full = full.slice(0, max) + '…'
    }
    return `${prefix}: ${full}`
}

export class NERMClient {
    private client: AxiosCacheInstance
    private attributesPromise?: Promise<Map<string, any>>
    private profileTypePromises = new Map<string, Promise<any>>()
    private profileByIdPromises = new Map<string, Promise<any>>()
    private profilePromises = new Map<string, Promise<any>>()
    private profileByNamePromises = new Map<string, Promise<any>>()
    private userPromises = new Map<string, Promise<any>>()
    private userByEmailPromises = new Map<string, Promise<any>>()
    private userRoleAssignmentsPromises = new Map<string, Promise<any>>()
    private instanceId?: string

    constructor(config: any) {
        const baseConfig: AxiosRequestConfig = {
            baseURL: config.nerm_baseurl,
            headers: {
                Authorization: `Bearer ${config.nerm_token}`,
                Accept: 'application/json',
            },
        }
        const client = axios.create(baseConfig)
        axiosRetry(client, retriesConfig)
        axiosThrottle.use(client, throttleConfig)
        this.client = setupCache(client)
        this.instanceId = config.spConnectorInstanceId
    }

    private logDebug(fnName: string, message: any) {
        logger.debug(`  NERMClient.${fnName}: ${toLogString(message)}`)
    }

    private logInfo(fnName: string, message: any) {
        logger.info(`  NERMClient.${fnName}: ${toLogString(message)}`)
    }

    private logWarn(fnName: string, message: any) {
        logger.warn(`  NERMClient.${fnName}: ${toLogString(message)}`)
    }

    private logError(fnName: string, message: any) {
        logger.error(`  NERMClient.${fnName}: ${toLogString(message)}`)
    }

    private getProfileAttribute(profile: any, attribute: string): any {
        if (PROFILE_ROOTATTRIBUTES.has(attribute)) {
            return profile[attribute]
        } else {
            return profile.attributes[attribute]
        }
    }

    private async *paginate(request: AxiosRequestConfig): any {
        const req = { ...request, params: { ...request.params } }
        req.params['query[limit]'] = QUERYLIMIT
        req.params['query[order]'] = QUERYORDER
        req.params.metadata = true

        const firstResponse = await this.client.request(req)
        yield firstResponse

        const { total, limit, offset } = firstResponse!.data._metadata
        let currentOffset = offset + limit

        const offsets: number[] = []
        while (currentOffset < total) {
            offsets.push(currentOffset)
            currentOffset += limit
        }

        for (let i = 0; i < offsets.length; i += ACCOUNT_CONCURRENCY) {
            const batch = offsets.slice(i, i + ACCOUNT_CONCURRENCY)
            const promises = batch.map((off) => {
                const batchReq = { ...req, params: { ...req.params, 'query[offset]': off } }
                return this.client.request(batchReq)
            })
            const responses = await Promise.all(promises)
            for (const response of responses) {
                yield response
            }
        }
    }

    private async *listRequest(url: string, type: string, parameters?: any) {
        const params = parameters ?? {}
        const request: AxiosRequestConfig = {
            method: 'get',
            url,
            params,
        }

        try {
            for await (const res of this.paginate(request)) {
                for (const item of res.data[type]) {
                    yield item
                }
            }
        } catch (error) {
            const e = error as any
            this.logError('listRequest', e.response?.data?.error ?? e.message ?? `${e}`)
        }
    }

    private async getRequest(url: string, type?: string, params?: any): Promise<any> {
        const request: AxiosRequestConfig = {
            method: 'get',
            url,
            params,
        }

        let item: any
        try {
            const response = await this.client.request(request)
            item = type ? response.data[type] : response.data
        } catch (error) {
            this.logError('getRequest', (error as any).response?.data?.error ?? `${error}`)
        } finally {
            return item
        }
    }

    private async createRequest(url: string, type: string, data: any): Promise<any> {
        const request: AxiosRequestConfig = {
            method: 'post',
            url,
            data: { [type]: data },
        }

        try {
            const response = await this.client.request(request)
            return response.data[type]
        } catch (error) {
            const err = error as any
            const message = formatHttpError(err)
            this.logError('createRequest', message)
            throw new ConnectorError(message)
        }
    }

    private async updateRequest(url: string, type: string, data: any): Promise<any> {
        const request: AxiosRequestConfig = {
            method: 'patch',
            url,
            data: { [type]: data },
        }

        try {
            const response = await this.client.request(request)
            return response.data[type]
        } catch (error) {
            const err = error as any
            const message = formatHttpError(err)
            this.logError('updateRequest', message)
            throw new ConnectorError(message)
        }
    }

    private async deleteRequest(url: string): Promise<any> {
        const request: AxiosRequestConfig = {
            method: 'delete',
            url,
        }

        let item: any
        try {
            const response = await this.client.request(request)
            item = response.data
        } catch (error) {
            this.logError('deleteRequest', (error as any).response?.data?.error ?? `${error}`)
        } finally {
            return item
        }
    }

    getJobStatus = async (id: string): Promise<any> => {
        const url = `/job_status`
        const type = undefined

        return this.getRequest(url, type)
    }

    async *listProfileTypes(params?: any) {
        const url = `/profile_types`
        const type = 'profile_types'

        yield* this.listRequest(url, type, params)
    }

    async getProfileType(id: string): Promise<any> {
        const url = `/profile_types/${encodeURIComponent(String(id))}`
        const type = 'profile_type'

        return this.getRequest(url, type)
    }

    // ⚡ Bolt: Cache getProfileTypeByName results using a Promise map.
    // Impact: Avoids N identical requests when synchronizing multiple profiles or schemas
    // that share the same ProfileType configuration, significantly reducing latency and overhead.
    async getProfileTypeByName(name: string): Promise<any> {
        if (!this.profileTypePromises.has(name)) {
            const fetchProfileType = async () => {
                const response = this.listProfileTypes({ name })
                return (await response.next()).value
            }
            this.profileTypePromises.set(name, fetchProfileType())
        }
        return this.profileTypePromises.get(name)
    }

    async *listProfiles(params?: any) {
        const url = `/profiles`
        const type = 'profiles'

        yield* this.listRequest(url, type, params)
    }

    // ⚡ Bolt: Cache getProfile results using a Promise map.
    // Impact: Avoids N identical requests when synchronizing multiple accounts that
    // reference the same profile ID, reducing redundant API calls and overhead.
    async getProfile(id: string): Promise<any> {
        if (!this.profileByIdPromises.has(id)) {
            const fetchProfile = async () => {
                const url = `/profiles/${encodeURIComponent(String(id))}`
                const type = 'profile'
                return await this.getRequest(url, type)
            }
            this.profileByIdPromises.set(id, fetchProfile())
        }
        return this.profileByIdPromises.get(id)
    }

    // ⚡ Bolt: Cache getProfileByName results using a Promise map.
    // Impact: Avoids N identical requests when synchronizing multiple profiles that
    // reference the same target profile by name, reducing redundant API calls and overhead.
    async getProfileByName(name: string): Promise<any> {
        if (!this.profileByNamePromises.has(name)) {
            const fetchProfile = async () => {
                const url = `/profiles`
                const type = 'profiles'
                let response
                for await (const profile of this.listRequest(url, type, { name })) {
                    if (!response) {
                        response = profile
                    } else {
                        const message = `Multiple profiles found for "${name}" name`
                        this.logWarn('getProfileByName', message)
                        break
                    }
                }

                if (!response) {
                    this.logWarn('getProfileByName', `No profile found for name="${name}"`)
                }
                return response
            }
            this.profileByNamePromises.set(name, fetchProfile())
        }
        return this.profileByNamePromises.get(name)
    }

    // ⚡ Bolt: Cache getProfileByNameAndType results using a Promise map.
    // Impact: Avoids N identical requests when multiple profiles reference the same dependent profile
    // (e.g., manager or department) by name and type during attribute resolution.
    async getProfileByNameAndType(name: string, profile_type_id: string): Promise<any> {
        const cacheKey = `${name}:${profile_type_id}`
        if (!this.profilePromises.has(cacheKey)) {
            const fetchProfile = async () => {
                const url = `/profiles`
                const type = 'profiles'
                let response
                for await (const profile of this.listRequest(url, type, { name })) {
                    if (profile.profile_type_id !== profile_type_id) {
                        continue
                    }
                    if (!response) {
                        response = profile
                    } else {
                        const message = `Multiple profiles found for "${name}" with profile_type_id=${profile_type_id}`
                        this.logWarn('getProfileByNameAndType', message)
                        break
                    }
                }

                if (!response) {
                    this.logWarn(
                        'getProfileByNameAndType',
                        `No profile found for name="${name}" with profile_type_id=${profile_type_id}`
                    )
                }
                return response
            }
            this.profilePromises.set(cacheKey, fetchProfile())
        }
        return this.profilePromises.get(cacheKey)
    }

    /**
     * Resolves a profile reference whether ISC sent a profile ID (UUID) or a display name.
     * Name-only lookup fails when the value is an entitlement/profile ID.
     */
    async resolveProfileByValueOrName(value: string, profile_type_id: string): Promise<any> {
        const v = typeof value === 'string' ? value.trim() : String(value)
        if (looksLikeUuid(v)) {
            const byId = await this.getProfile(v)
            if (byId?.profile_type_id === profile_type_id) {
                return byId
            }
            if (!byId) {
                this.logWarn(
                    'resolveProfileByValueOrName',
                    `No profile exists for id=${v} (expected profile_type_id=${profile_type_id})`
                )
            } else {
                this.logWarn(
                    'resolveProfileByValueOrName',
                    `Profile id=${v} has profile_type_id=${byId.profile_type_id}, expected ${profile_type_id}`
                )
            }
            return undefined
        }
        return this.getProfileByNameAndType(v, profile_type_id)
    }

    /**
     * NERM user-reference attributes (Owner/Contributor Search/Select) expect the user id (UUID).
     * UUIDs are sent as-is; `Name (email)` or bare email is resolved to a user id when possible.
     */
    async resolveUserReferenceValueForApi(value: string): Promise<string | undefined> {
        const v = typeof value === 'string' ? value.trim() : String(value).trim()
        if (!v) {
            this.logWarn('resolveUserReferenceValueForApi', 'Empty value after trim (cannot resolve user reference)')
            return undefined
        }
        if (looksLikeUuid(v)) {
            return v
        }
        const email = getEmailFromUserAttribute(v) ?? (v.includes('@') ? v.trim() : undefined)
        if (email) {
            const user = await this.getUserByEmail(email)
            if (!user?.id) {
                this.logWarn(
                    'resolveUserReferenceValueForApi',
                    `No user found for email=${email} (from value=${toLogString(value)})`
                )
                return undefined
            }
            return user.id
        }
        this.logWarn(
            'resolveUserReferenceValueForApi',
            `Could not parse email or UUID from value=${toLogString(value)}; passing through unchanged`
        )
        return v
    }

    async *listUsers(userType?: UserType) {
        const url = `/users`
        const type = 'users'
        const params = userType ? { type: userType } : undefined

        for await (const user of this.listRequest(url, type, params)) {
            if (!userType || user.type === userType) {
                yield user
            }
        }
    }

    // ⚡ Bolt: Cache getUser results using a Promise map.
    // Impact: Avoids multiple requests for the same user (e.g. owners/contributors)
    // when resolving multiple profiles simultaneously, significantly reducing API calls.
    async getUser(id: string): Promise<any> {
        if (!this.userPromises.has(id)) {
            const fetchUser = async () => {
                const url = `/users/${encodeURIComponent(String(id))}`
                const type = 'user'
                return await this.getRequest(url, type)
            }
            this.userPromises.set(id, fetchUser())
        }
        return this.userPromises.get(id)
    }

    async getRole(id: string): Promise<any> {
        const url = `/roles/${encodeURIComponent(String(id))}`
        const type = 'role'

        return await this.getRequest(url, type)
    }

    async *listRoles() {
        const url = `/roles`
        const type = 'roles'

        yield* this.listRequest(url, type)
    }

    async *listAttributes(params?: any) {
        const url = `/ne_attributes`
        const type = 'ne_attributes'

        yield* this.listRequest(url, type, params)
    }

    async createProfile(body: any) {
        const url = `/profile`
        const type = 'profile'

        this.logDebug('createProfile', `POST ${url} body=${toLogString(body)}`)
        return await this.createRequest(url, type, body)
    }

    async createProfiles(profiles: any[]) {
        const url = `/profiles`
        const type = 'profiles'
        const jobList: string[] = []
        const requests = []
        for (let offset = 0; offset < profiles.length; offset += BATCH_SIZE) {
            const batchItems = profiles.slice(offset, offset + BATCH_SIZE)
            requests.push(this.createRequest(url, type, batchItems))
        }
        const responses = await Promise.all(requests)
        for (const response of responses) {
            if (response?.job_status?.job_id) {
                jobList.push(response.job_status.job_id)
            }
        }

        const pollJob = async (jobId: string) => {
            let delay = 1000
            while (true) {
                const response = await this.getJobStatus(jobId)
                const status = response?.status
                if (status !== 'pending' && status !== 'queued' && status !== 'working') break
                await new Promise((r) => setTimeout(r, delay))
                delay = Math.min(delay * 2, 10000)
            }
        }
        await Promise.all(jobList.map(pollJob))
    }

    async updateProfile(id: string, body: any) {
        const url = `/profiles/${encodeURIComponent(String(id))}`
        const type = 'profile'

        return await this.updateRequest(url, type, body)
    }

    async deleteProfile(profile_id: string): Promise<any> {
        const url = `/profiles/${encodeURIComponent(String(profile_id))}`

        const response = await this.deleteRequest(url)
        if (response) {
            return response
        } else {
            const message = `Failed to delete "${profile_id}" user`
            this.logError('deleteProfile', message)
        }
    }

    async deleteUser(user_id: string): Promise<any> {
        const url = `/users/${encodeURIComponent(String(user_id))}`

        const response = await this.deleteRequest(url)
        if (response) {
            return response
        } else {
            const message = `Failed to delete "${user_id}" user`
            this.logError('deleteUser', message)
        }
    }

    async createUser(body: any) {
        const url = '/user'
        const type = 'user'

        return await this.createRequest(url, type, body)
    }

    async updateUser(id: string, body: any) {
        const url = `/users/${encodeURIComponent(String(id))}`
        const type = 'user'

        return await this.updateRequest(url, type, body)
    }

    async getUserByLoginAndType(login: string, userType: 'NeprofileUser' | 'NeaccessUser'): Promise<any> {
        const url = `/users`
        const type = 'users'

        for await (const user of this.listRequest(url, type, { login })) {
            if (user.type === userType) {
                return user
            }
        }
    }

    async getUserByNameAndType(name: string, userType: 'NeprofileUser' | 'NeaccessUser'): Promise<any> {
        const url = `/users`
        const type = 'users'

        for await (const user of this.listRequest(url, type, { name })) {
            if (user.type === userType) {
                return user
            }
        }
    }

    // ⚡ Bolt: Cache getUserByEmail results using a Promise map.
    // Impact: Prevents identical user lookups by email when evaluating attributes repeatedly,
    // saving network calls and speeding up the process.
    async getUserByEmail(email: string): Promise<any> {
        if (!this.userByEmailPromises.has(email)) {
            const fetchUserByEmail = async () => {
                const url = `/users`
                const type = 'users'
                for await (const user of this.listRequest(url, type, { email })) {
                    return user
                }
            }
            this.userByEmailPromises.set(email, fetchUserByEmail())
        }
        return this.userByEmailPromises.get(email)
    }

    // ⚡ Bolt: Cache getUserRoleAssignments results using a Promise map.
    // Impact: Prevents N+1 query problem when listing multiple profiles that reference the same user ID,
    // reducing repeated role lookups and overall API requests.
    async getUserRoleAssignments(user_id: any) {
        if (!this.userRoleAssignmentsPromises.has(user_id)) {
            const fetchRoleAssignments = async () => {
                const url = `/user_roles`
                const type = 'user_roles'
                const params = {
                    user_id,
                }
                return await this.getRequest(url, type, params)
            }
            this.userRoleAssignmentsPromises.set(user_id, fetchRoleAssignments())
        }
        return this.userRoleAssignmentsPromises.get(user_id)
    }

    async getWorkflowSession(id: any) {
        const url = `/workflow_sessions/${encodeURIComponent(String(id))}`
        const type = 'workflow_session'

        return await this.getRequest(url, type)
    }

    async createWorkflowSession(body: any, wait: boolean = false) {
        const url = '/workflow_sessions'
        const type = 'workflow_session'

        let response = await this.createRequest(url, type, body)
        let count = 0
        if (wait) {
            while (count++ < RETRIES && response) {
                const { id, status } = response
                if (WORKFLOW_PENDINGSTATUSES.has(status)) {
                    await new Promise((r) => setTimeout(r, 1000))
                    response = await this.getWorkflowSession(id)
                } else {
                    return response
                }
            }
            return undefined
        }

        return response
    }

    async getAttribute(name: string): Promise<any> {
        if (!PROFILE_ROOTATTRIBUTES.has(name)) {
            if (!this.attributesPromise) {
                this.attributesPromise = (async () => {
                    const map = new Map<string, any>()
                    for await (const attribute of this.listAttributes()) {
                        map.set(attribute.uid, attribute)
                    }
                    return map
                })()
            }
            const attributes = await this.attributesPromise
            return attributes.get(name)
        }
    }

    async resolveAttributePath(profile: any, path: string): Promise<{ profile: any; path: string }> {
        const dotIndex = path.indexOf('.')
        if (dotIndex === -1) {
            return { profile, path }
        }

        const parent = path.slice(0, dotIndex)
        const children = path.slice(dotIndex + 1)
        const attributeType = await this.getAttribute(parent)

        //Need to check other multi-valued attribute types like tags
        if (attributeType?.allow_multiple_selections) {
            return { profile, path }
        }

        const referencedProfile = await this.getProfileByNameAndType(parent, attributeType.profile_type_id)
        return this.resolveAttributePath(referencedProfile, children)
    }

    async getAttributeRecursively(profile: any, name: string): Promise<any> {
        const dotIndex = name.indexOf('.')
        const hasChildren = dotIndex !== -1
        const parent = hasChildren ? name.slice(0, dotIndex) : name
        const children = hasChildren ? name.slice(dotIndex + 1) : ''
        const attributeType = await this.getAttribute(parent)
        let isMulti = attributeType ? attributeType.allow_multiple_selections : false
        let values: any | any[] = []

        const profileAttribute = this.getProfileAttribute(profile, parent)
        if (profileAttribute) {
            if (USERTYPE_ATTRIBUTES.has(attributeType?.type)) {
                const email = getEmailFromUserAttribute(profileAttribute)
                if (email) {
                    const user = await this.getUserByEmail(email)
                    if (user) {
                        values = [user[children]]
                    }
                }
            } else {
                const profileNames: string[] = profileAttribute.split(', ')
                if (hasChildren) {
                    if (PROFILETYPE_ATTRIBUTES.has(attributeType?.type)) {
                        const profilePromises = profileNames.map(async (profileName) => {
                            const referencedProfile = await this.resolveProfileByValueOrName(
                                profileName,
                                attributeType.profile_type_id
                            )
                            return this.getAttributeRecursively(referencedProfile, children)
                        })
                        const childrenProfilesArray = await Promise.all(profilePromises)

                        for (const childrenProfiles of childrenProfilesArray) {
                            if (childrenProfiles) {
                                if (Array.isArray(childrenProfiles)) {
                                    isMulti = true
                                    values = values.concat(childrenProfiles.filter((x) => x != null))
                                } else {
                                    values.push(childrenProfiles)
                                }
                            }
                        }
                    } else {
                        values = [profileAttribute].flat()
                    }
                } else {
                    if (PROFILETYPE_ATTRIBUTES.has(attributeType?.type)) {
                        const referencedProfiles = await Promise.all(
                            profileNames.map((x) => this.resolveProfileByValueOrName(x, attributeType.profile_type_id))
                        )
                        values = referencedProfiles.filter((x) => x != null)
                    } else {
                        values = [profileAttribute].flat()
                    }
                }
            }
        }

        if (isMulti) {
            return values.length > 0 ? values : values[0]
        } else {
            return values[0]
        }
    }

    async resolveProfileAttributes(profile: any, schema: AccountSchema): Promise<any> {
        const attributes: { [key: string]: any } = {}
        // Use Promise.all to fetch and resolve all profile attributes in parallel instead of sequentially
        // Since rate limiting is handled by axios-request-throttle, we can safely fire off these requests
        await Promise.all(
            schema.attributes!.map(async (attr) => {
                let finalValue
                if (ENTITLEMENT_ATTRIBUTES.has(attr.name)) {
                    if (attr.name === 'types') {
                        finalValue = ['Profile']
                        if (profile.attributes.user_id) {
                            const user = await this.getUser(profile.attributes.user_id)
                            if (user) {
                                finalValue.push(user.type)
                            }
                        }
                        attributes[attr.name] = finalValue
                    }
                } else {
                    const value = await this.getAttributeRecursively(profile, attr.name!)
                    const isArray = Array.isArray(value)
                    if (value) {
                        const isObject = isArray ? typeof value[0] === 'object' : typeof value === 'object'
                        let profile_type_id
                        let referencedProfileType
                        if (isObject) {
                            profile_type_id = isArray ? value[0].profile_type_id : value.profile_type_id
                            referencedProfileType = profile_type_id
                        }

                        if (attr.entitlement) {
                            if (attr.schemaObjectType === referencedProfileType?.name) {
                                //Is profile entitlement
                                const ids = [value].flat().map((x) => x.id)
                                if (attr.multi) {
                                    finalValue = ids
                                } else {
                                    finalValue = ids[0]
                                }
                            } else {
                                //Is not profile entitlement
                                const names = [value].flat().map((x) => x.name)
                                if (attr.multi) {
                                    finalValue = value
                                } else {
                                    finalValue = isArray ? names.map((x) => `[${x}]`).join(' ') : names
                                }
                            }
                        } else {
                            let names = [value].flat()
                            if (referencedProfileType) {
                                names = [value].flat().map((x) => x.name)
                            }
                            if (attr.multi) {
                                finalValue = isArray ? names : names[0]
                            } else {
                                finalValue = isArray ? names.map((x) => `[${x}]`).join(' ') : names[0]
                            }
                        }
                        attributes[attr.name!] = finalValue
                    } else {
                        const message = `"${attr.name}" attribute not found on profile "${profile.name}"`
                        this.logDebug('resolveProfileAttributes', message)
                    }
                }
            })
        )

        return attributes
    }

    async setProfileAttribute(id: string, path: string, value: any): Promise<any> {
        let profile = await this.getProfile(id)
        let body: any = {}
        value = value ?? ''
        const response = await this.resolveAttributePath(profile, path)
        if (response.profile === profile) {
            if (PROFILE_ROOTATTRIBUTES.has(response.path)) {
                body = {
                    [response.path]: value,
                }
            } else {
                body = {
                    attributes: {
                        [response.path]: value,
                    },
                }
            }
        } else if (response.profile) {
            const attributeType = await this.getAttribute(response.path)
            if (PROFILETYPE_ATTRIBUTES.has(attributeType?.type)) {
                const referencedProfile = await this.getProfileByNameAndType(
                    response.path,
                    attributeType.profile_type_id
                )
                body = { attributes: { [response.path]: referencedProfile.id } }
            } else {
                if (PROFILE_ROOTATTRIBUTES.has(response.path)) {
                    body = {
                        [response.path]: response.profile[response.path],
                    }
                } else {
                    body = {
                        attributes: {
                            [response.path]: response.profile.attributes[response.path],
                        },
                    }
                }
            }
        } else {
            return profile
        }

        return await this.updateProfile(id, body)
    }

    async setUserAttribute(id: string, attribute: string, value: any): Promise<any> {
        const body = {
            [attribute]: value,
        }

        return await this.updateUser(id, body)
    }

    async addRole(user_id: string, role_id: any): Promise<any> {
        const url = `/user_role/`
        const type = 'user_role'

        const body = {
            user_id,
            role_id,
        }

        return this.createRequest(url, type, body)
    }

    async removeRole(user_id: string, role_id: any): Promise<void> {
        let url = `/user_roles/`
        const type = 'user_roles'

        const params = {
            user_id,
            role_id,
        }

        try {
            let response = await this.listRequest(url, type, params)
            const deletePromises: Promise<any>[] = []
            for await (const roleAssignment of response) {
                const deleteUrl = `/user_role/${encodeURIComponent(String(roleAssignment.id))}`
                deletePromises.push(this.deleteRequest(deleteUrl).catch((e: any) => e))
            }
            const results = await Promise.all(deletePromises)
            const errors = results.filter((r) => r instanceof Error)
            if (errors.length > 0) throw errors[0]
        } catch (error) {
            const message = `Failed to remove "${role_id}" role_id from "${user_id}" user_id`
            this.logError('removeRole', message)
        }
    }
}
