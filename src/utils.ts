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
): StdEntitlementListOutput => ({
    type,
    identity: genericEntitlement.id,
    uuid: genericEntitlement.name,
    attributes: genericEntitlement,
})

export const name2Attribute = (name: string): SchemaAttribute => ({
    type: 'STRING',
    name,
    description: name,
})

export const profile2Entitlement = (profile: any, type: string, attrs: string[]): StdEntitlementListOutput => {
    const { id, name } = profile
    let attributes: Attributes = { id, name }
    attrs.forEach((x) => (attributes[x] = profile.attributes?.[x]))

    return {
        type,
        uuid: name,
        identity: id,
        attributes,
    }
}

export const attributeDefinition2SchemaAttribute = (attribute: AttributeDefinition): SchemaAttribute => ({
    name: attribute.name!,
    description: attribute.description ?? '',
    multi: attribute.isMulti,
    entitlement: attribute.isEntitlement,
    managed: attribute.isGroup,
    schemaObjectType: attribute.schema?.name,
    type: typesMap.get(attribute.type!) ?? 'string',
})

export const apiSchema2Schema = (apiSchema: ApiSchema): AccountSchema => ({
    identityAttribute: apiSchema.identityAttribute!,
    displayAttribute: apiSchema.displayAttribute!,
    groupAttribute: 'types',
    attributes: apiSchema.attributes!.map(attributeDefinition2SchemaAttribute),
})

export const profile2EntitlementSchema = (profile: any): ApiSchema => ({
    ...defaultEntitlementSchema,
    name: profile.name,
    nativeObjectType: profile.name,
    attributes: [...defaultEntitlementSchema.attributes!, ...profile.attributes.map(name2Attribute)],
})

export const mergeProfileWithConfig = (profile: any, conf: any): any => ({
    ...profile,
    attributes: conf.attributes ?? [],
})

export const parents2children = (parents: SearchDocument[], type: string): Map<string, Set<string>> => {
    const childrenMap: Map<string, Set<string>> = new Map()
    const parent_type = parents[0] ? (parents[0] as any)._type : undefined

    if (!parent_type) return childrenMap

    const attribute = PARENTCHILD_ATTRIBUTES[parent_type]?.[type]
    if (!attribute) return childrenMap

    for (const parent of parents as any[]) {
        const children = parent[attribute]
        for (const child of children) {
            if (attribute === 'access') {
                const accessType = TYPES[type] || ACCESSTYPE_MAPPING[type]
                if (child.type !== accessType) continue
            }

            if (childrenMap.has(child.id)) {
                childrenMap.get(child.id)?.add(parent.id)
            } else {
                childrenMap.set(child.id, new Set([parent.id]))
            }
        }
    }

    return childrenMap
}

// ⚡ Bolt: Optimize property extraction. Replaced allocation-heavy split().reduce() with iterative parts loop.
export const getAttribute = (object: { [key: string]: any }, attributePath: string): any => {
    if (object == null) return undefined
    const parts = attributePath.split('.')
    let obj = object
    for (let i = 0, len = parts.length; i < len; i++) {
        if (obj == null) return undefined
        obj = obj[parts[i]]
    }
    return obj
}

export const entity2profile = (entity: SearchDocument, profile_type_id: string, conf: Mapping): any => {
    const searchDoc = entity as any
    const status = searchDoc?.enabled || !searchDoc?.inactive ? 'Active' : 'Inactive'

    const attributes: { [key: string]: string } = {}
    Object.entries(conf.mapping).forEach(([targetAttr, sourcePath]) => {
        attributes[targetAttr] = getAttribute(entity, sourcePath)
    })
    attributes[conf.id] = entity.id as string

    return {
        profile_type_id,
        status,
        name: getAttribute(entity, 'name'),
        attributes,
    }
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
