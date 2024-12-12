import axios, { AxiosRequestConfig } from 'axios'
import axiosThrottle from 'axios-request-throttle'
import axiosRetry from 'axios-retry'
import { AxiosCacheInstance, setupCache } from 'axios-cache-interceptor'
import { retriesConfig, throttleConfig } from './axios'
import {
    BATCH_SIZE,
    ENTITLEMENT_ATTRIBUTES,
    PROFILE_ROOTATTRIBUTES,
    PROFILETYPE_ATTRIBUTES,
    QUERYLIMIT,
    QUERYORDER,
    RETRIES,
    WORKFLOW_PENDINGSTATUSES,
} from './data/constants'
import { AccountSchema, logger } from '@sailpoint/connector-sdk'

type UserType = 'NeprofileUser' | 'NeaccessUser'

export class NERMClient {
    private client: AxiosCacheInstance
    private attributes?: Map<string, any>

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
    }

    private getProfileAttribute(profile: any, attribute: string): any {
        if (PROFILE_ROOTATTRIBUTES.includes(attribute)) {
            return profile[attribute]
        } else {
            return profile.attributes[attribute]
        }
    }

    private async *paginate(request: AxiosRequestConfig): any {
        let req = JSON.parse(JSON.stringify(request))
        let remaining = 1
        req.params['query[limit]'] = QUERYLIMIT
        req.params['query[order]'] = QUERYORDER
        req.params.metadata = true

        while (remaining > 0) {
            const response = await this.client.request(req)
            const { total, limit, offset } = response!.data._metadata
            remaining = total - offset - limit
            req.params['query[offset]'] = offset + limit
            yield response
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
            logger.error(e.response.data.error ?? e.message ?? e)
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
            logger.error((error as any).response.data.error ?? error)
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

        let item: any
        let response: any
        try {
            response = await this.client.request(request)
            item = response.data[type]
        } catch (error) {
            logger.error((error as any).response.data.error ?? error)
            item = response
        } finally {
            return item
        }
    }

    private async updateRequest(url: string, type: string, data: any): Promise<any> {
        const request: AxiosRequestConfig = {
            method: 'patch',
            url,
            data: { [type]: data },
        }

        let item: any
        let response: any
        try {
            response = await this.client.request(request)
            item = response.data[type]
        } catch (error) {
            logger.error((error as any).response.data.error ?? error)
            item = response
        } finally {
            return item
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
            logger.error((error as any).response.data.error ?? error)
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
        const url = `/profile_types/${id}`
        const type = 'profile_type'

        return this.getRequest(url, type)
    }

    async getProfileTypeByName(name: string): Promise<any> {
        const response = this.listProfileTypes({ name })
        return (await response.next()).value
    }

    async *listProfiles(params?: any) {
        const url = `/profiles`
        const type = 'profiles'

        yield* this.listRequest(url, type, params)
    }

    async getProfile(id: string): Promise<any> {
        const url = `/profiles/${id}`
        const type = 'profile'

        return this.getRequest(url, type)
    }

    async getProfileByName(name: string): Promise<any> {
        const url = `/profiles`
        const type = 'profiles'
        let response
        for await (const profile of this.listRequest(url, type, { name })) {
            if (!response) {
                response = profile
            } else {
                const message = `Multiple profiles found for "${name}" name`
                logger.warn(message)
                break
            }
        }

        return response
    }

    async getProfileByNameAndType(name: string, profile_type_id: string): Promise<any> {
        const url = `/profiles`
        const type = 'profiles'
        let response
        for await (const profile of this.listRequest(url, type, { name })) {
            if (!response && profile.profile_type_id === profile_type_id) {
                response = profile
            } else {
                const message = `Multiple profiles found for "${name}" name`
                logger.warn(message)
                break
            }
        }

        return response
    }

    async *listUsers(userType?: UserType) {
        const url = `/users`
        const type = 'users'

        for await (const user of this.listRequest(url, type)) {
            if (!userType || user.type === userType) {
                yield user
            }
        }
    }

    async getUser(id: string): Promise<any> {
        const url = `/users/${id}`
        const type = 'user'

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

        return await this.createRequest(url, type, body)
    }

    async createProfiles(profiles: any[]) {
        const url = `/profiles`
        const type = 'profiles'
        let pendingItems = profiles.length
        const jobList = []
        while (pendingItems > 0) {
            const batchSize = pendingItems < BATCH_SIZE ? pendingItems : BATCH_SIZE
            pendingItems -= batchSize
            const batchItems = profiles.splice(0, batchSize)
            const response = await this.createRequest(url, type, batchItems)
            if (response.job_status && response.job_status.job_id) {
                jobList.push(response.job_status.job_id)
            }
        }

        while (jobList.length > 0) {
            const jobId = jobList.pop()!
            let status = 'pending'
            do {
                const response = await this.getJobStatus(jobId)
                status = response.status
                await new Promise((r) => setTimeout(r, 2000))
            } while (status === 'pending' || status === 'queued' || status === 'working')
        }
    }

    async updateProfile(id: string, body: any) {
        const url = `/profiles/${id}`
        const type = 'profile'

        return await this.updateRequest(url, type, body)
    }

    async deleteProfile(profile_id: string): Promise<any> {
        const url = `/profiles/${profile_id}`

        const response = await this.deleteRequest(url)
        if (response) {
            return response
        } else {
            const message = `Failed to delete "${profile_id}" user`
            logger.error(message)
        }
    }

    async deleteUser(user_id: string): Promise<any> {
        const url = `/users/${user_id}`

        const response = await this.deleteRequest(url)
        if (response) {
            return response
        } else {
            const message = `Failed to delete "${user_id}" user`
            logger.error(message)
        }
    }

    async createUser(body: any) {
        const url = '/user'
        const type = 'user'

        return await this.createRequest(url, type, body)
    }

    async updateUser(id: string, body: any) {
        const url = `/users/${id}`
        const type = 'user'

        return await this.updateRequest(url, type, body)
    }

    async getUserByLoginAndType(login: string, userType: 'NeprofileUser' | 'NeaccessUser'): Promise<any> {
        const url = `/users`
        const type = 'users'

        for await (const user of this.listRequest(url, type)) {
            if (user.login === login && user.type === userType) {
                return user
            }
        }
    }

    async getUserByNameAndType(name: string, userType: 'NeprofileUser' | 'NeaccessUser'): Promise<any> {
        const url = `/users`
        const type = 'users'

        for await (const user of this.listRequest(url, type)) {
            if (user.name === name && user.type === userType) {
                return user
            }
        }
    }

    async getUserRoleAssignments(user_id: any) {
        const url = `/user_roles`
        const type = 'user_roles'
        const params = {
            user_id,
        }

        return await this.getRequest(url, type, params)
    }

    async getWorkflowSession(id: any) {
        const url = `/workflow_sessions/${id}`
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
                if (WORKFLOW_PENDINGSTATUSES.includes(status)) {
                    setTimeout(async () => {
                        response = await this.getWorkflowSession(id)
                    }, 1000)
                } else {
                    return response
                }
            }
            return undefined
        }

        return response
    }

    async getAttribute(name: string): Promise<any> {
        if (!PROFILE_ROOTATTRIBUTES.includes(name)) {
            if (!this.attributes) {
                this.attributes = new Map()
                for await (const attribute of this.listAttributes()) {
                    this.attributes.set(attribute.uid, attribute)
                }
            }

            return this.attributes!.get(name)
        }
    }

    async resolveAttributePath(profile: any, path: string): Promise<{ profile: any; path: string }> {
        const hierarchy = path.split('.').reverse()
        const parent = hierarchy.pop()!
        const children = hierarchy.join('.')
        const attributeType = await this.getAttribute(parent)

        //Need to check other multi-valued attribute types like tags
        if (attributeType?.allow_multiple_selections) {
            // const message = `Unsupported operation: Cannot update multivalued attribute ${path}`
            // logger.error(message)
            return { profile, path }
        }

        if (hierarchy.length > 0) {
            const referencedProfile = await this.getProfileByNameAndType(parent, attributeType.profile_type_id)
            const childAttributePath = this.resolveAttributePath(referencedProfile, children)
            return childAttributePath
        } else {
            return { profile, path }
        }
    }

    async getAttributeRecursively(profile: any, name: string): Promise<any> {
        let hierarchy = name.split('.').reverse()
        const parent = hierarchy.pop()!
        const children = hierarchy.reverse().join('.')
        const attributeType = await this.getAttribute(parent)
        let isMulti = attributeType ? attributeType.allow_multiple_selections : false
        let values: any | any[] = []

        const profileAttribute = this.getProfileAttribute(profile, parent)

        if (profileAttribute) {
            const profileNames: string[] = profileAttribute.split(', ')
            if (hierarchy.length > 0) {
                if (PROFILETYPE_ATTRIBUTES.includes(attributeType?.type)) {
                    for (const profileName of profileNames) {
                        const referencedProfile = await this.getProfileByNameAndType(
                            profileName,
                            attributeType.profile_type_id
                        )
                        const childrenProfiles = await this.getAttributeRecursively(referencedProfile, children)
                        if (Array.isArray(childrenProfiles)) {
                            isMulti = true
                            values = values.concat(childrenProfiles.filter((x) => x !== undefined))
                        } else {
                            values.push(childrenProfiles)
                        }
                    }
                } else {
                    values = [profileAttribute].flat()
                }
            } else {
                if (PROFILETYPE_ATTRIBUTES.includes(attributeType?.type)) {
                    const referencedProfiles = await Promise.all(
                        profileNames
                            .map((x) => this.getProfileByNameAndType(x, attributeType.profile_type_id))
                            .filter((x) => x !== undefined)
                    )
                    values = referencedProfiles
                } else {
                    values = [profileAttribute].flat()
                }
            }
        }

        if (isMulti) {
            return values
        } else {
            return values[0]
        }
    }

    async resolveProfileAttributes(profile: any, schema: AccountSchema): Promise<any> {
        const attributes: { [key: string]: any } = {}
        for (const attr of schema.attributes!) {
            let finalValue
            if (ENTITLEMENT_ATTRIBUTES.includes(attr.name)) {
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
                    const { profile_type_id } = isArray ? value[0] : value
                    const referencedProfileType = profile_type_id
                        ? await this.getProfileType(profile_type_id)
                        : undefined
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
                    logger.debug(message)
                }
            }
        }

        return attributes
    }

    async setProfileAttribute(id: string, path: string, value: any): Promise<any> {
        let profile = await this.getProfile(id)
        let body: any = {}
        value = value ?? ''
        const response = await this.resolveAttributePath(profile, path)
        if (response.profile === profile) {
            if (PROFILE_ROOTATTRIBUTES.includes(response.path)) {
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
            if (PROFILETYPE_ATTRIBUTES.includes(attributeType?.type)) {
                const referencedProfile = await this.getProfileByNameAndType(
                    response.path,
                    attributeType.profile_type_id
                )
                body = { attributes: { [response.path]: referencedProfile.id } }
            } else {
                if (PROFILE_ROOTATTRIBUTES.includes(response.path)) {
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
            for await (const roleAssignment of response) {
                url = `/user_role/${roleAssignment.id}`
                await this.deleteRequest(url)
            }
        } catch (error) {
            const message = `Failed to remove "${role_id}" role_id from "${user_id}" user_id`
            logger.error(message)
        }
    }
}
