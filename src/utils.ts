import { AccountSchema, Attributes, SchemaAttribute, StdEntitlementListOutput } from '@sailpoint/connector-sdk'
import { GenericEntitlement } from './model/entitlement'
import { Schema as ApiSchema, AttributeDefinition, SearchDocument } from 'sailpoint-api-client'
import { defaultEntitlementSchema } from './data/schema'
import { ACCESSTYPE_MAPPING, PARENTCHILD_ATTRIBUTES, TYPES } from './data/constants'
import { AccountType, Mapping } from './model/config'

const typesMap: Map<string, string> = new Map([['STRING', 'string']])

const statusMap: Map<AccountType, Map<string, string>> = new Map([
    ['Profile', new Map([['Disabled', 'Inactive']])],
    [
        'NeprofileUser',
        new Map([
            ['Inactive', 'Disabled'],
            ['On Leave', 'Disabled'],
            ['Terminated', 'Disabled'],
        ]),
    ],
    [
        'NeaccessUser',
        new Map([
            ['Inactive', 'Disabled'],
            ['On Leave', 'Disabled'],
            ['Terminated', 'Disabled'],
        ]),
    ],
])

export const getStatus = (status: string, type: AccountType): string => {
    return statusMap.get(type)?.get(status) ?? status
}

export const genericEntitlement2StdEntitlementListOutput = (
    type: string,
    genericEntitlement: GenericEntitlement
): StdEntitlementListOutput => {
    const entitlement: StdEntitlementListOutput = {
        type,
        identity: genericEntitlement.id,
        uuid: genericEntitlement.name,
        attributes: genericEntitlement,
    }

    return entitlement
}

export const name2Attribute = (name: string): SchemaAttribute => {
    const attribute: SchemaAttribute = {
        type: 'STRING',
        name,
        description: name,
    }

    return attribute
}

export const profile2Entitlement = (profile: any, type: string, attrs: string[]): StdEntitlementListOutput => {
    const { id, name } = profile
    let attributes: Attributes = { id, name }
    attrs.forEach((x) => (attributes[x] = profile.attributes[x]))

    const entitlement: StdEntitlementListOutput = {
        type,
        uuid: name,
        identity: id,
        attributes,
    }

    return entitlement
}

export const attributeDefinition2SchemaAttribute = (attribute: AttributeDefinition): SchemaAttribute => {
    const schemaAttribute: SchemaAttribute = {
        name: attribute.name!,
        description: attribute.description ?? '',
        multi: attribute.isMulti,
        entitlement: attribute.isEntitlement,
        managed: attribute.isGroup,
        schemaObjectType: attribute.schema?.name,
        type: typesMap.get(attribute.type!) ?? 'string',
    }

    return schemaAttribute
}

export const apiSchema2Schema = (apiSchema: ApiSchema): AccountSchema => {
    const schema: AccountSchema = {
        identityAttribute: apiSchema.identityAttribute!,
        displayAttribute: apiSchema.displayAttribute!,
        groupAttribute: 'types',
        attributes: apiSchema.attributes!.map(attributeDefinition2SchemaAttribute),
    }

    return schema
}

export const profile2EntitlementSchema = (profile: any): ApiSchema => {
    const schema: ApiSchema = { ...defaultEntitlementSchema }
    schema.name = profile.name
    schema.nativeObjectType = profile.name
    schema.attributes = [...schema.attributes!, ...profile.attributes.map(name2Attribute)]

    return schema
}

export const mergeProfileWithConfig = (profile: any, conf: any): any => {
    const result = { ...profile, attributes: conf.attributes ?? [] }

    return result
}

export const parents2children = (parents: SearchDocument[], type: string): Map<string, Set<string>> => {
    const childrenMap: Map<string, Set<string>> = new Map()
    const parent_type = parents[0] ? (parents[0] as any)._type : undefined
    if (parent_type) {
        const attribute = PARENTCHILD_ATTRIBUTES[parent_type]?.[type]
        if (attribute) {
            for (const parent of parents as any[]) {
                const children = parent[attribute]
                for (const child of children) {
                    let include = true
                    if (attribute === 'access') {
                        const accessType = TYPES[type] || ACCESSTYPE_MAPPING[type]
                        if (child.type !== accessType) {
                            include = false
                        }
                    }

                    if (include) {
                        if (childrenMap.has(child.id)) {
                            childrenMap.get(child.id)?.add(parent.id)
                        } else {
                            childrenMap.set(child.id, new Set([parent.id]))
                        }
                    }
                }
            }
        }
    }

    return childrenMap
}

export const getAttribute = (object: { [key: string]: any }, attribute: string): any => {
    if (!object) {
        return undefined
    }
    let o = object
    const attributes = attribute.split('.').reverse()
    const a = attributes.pop()!
    o = o[a]
    if (attributes.length > 0) {
        o = getAttribute(o, attributes.reverse().join('.'))
    }

    return o
}

export const entity2profile = (entity: SearchDocument, profile_type_id: string, conf: Mapping): any => {
    const map = { ...conf.mapping }
    const e = entity as any
    const status = e?.enabled || !e?.inactive ? 'Active' : 'Inactive'
    const profile: any = {
        profile_type_id,
        status,
        name: getAttribute(entity, 'name'),
    }
    const attributes: {
        [key: string]: string
    } = {}
    Object.entries(map).forEach(([k, v]) => (attributes[k] = getAttribute(entity, v)))
    attributes[conf.id] = entity.id as string
    profile.attributes = attributes

    return profile
}

export const getRoleType = (role: any): 'NeprofileUser' | 'NeaccessUser' => {
    const uid = role.uid as string
    if (uid.endsWith('neprofile_role')) {
        return 'NeprofileUser'
    } else {
        return 'NeaccessUser'
    }
}

export const updateTypes = (attributes: Attributes, type: AccountType, login?: Attributes) => {
    let types: Set<string> = new Set((attributes.types as string[]) ?? [])
    types.add(type)
    attributes.types = Array.from(types)
    if (login) {
        Object.assign(attributes, login)
    }
}

export const resolveUserAttributes = (attributes: Attributes, schema?: AccountSchema): Attributes => {
    let userAttributes: Attributes = {}
    if (schema) {
        for (const att of schema.attributes) {
            userAttributes[att.name] = attributes[att.name] ?? null
        }
    }

    return userAttributes
}

export const getEmailFromUserAttribute = (userAttribute: string): string | undefined => {
    if (typeof userAttribute === 'string') {
        // Try to extract email in the format: Name (email)
        const emailMatch = userAttribute.match(/\(([^\s@)]+@[^\s@)]+)\)/)
        if (emailMatch) {
            return emailMatch[1]
        }
    }
    return undefined
}
