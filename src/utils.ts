import { AccountSchema, Attributes, SchemaAttribute, StdEntitlementListOutput } from '@sailpoint/connector-sdk'
import { GenericEntitlement } from './model/entitlement'
import { Schema as ApiSchema, AttributeDefinition } from 'sailpoint-api-client'
import { defaultEntitlementSchema } from './data/schema'

const typesMap: Map<string, string> = new Map([['STRING', 'string']])

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
