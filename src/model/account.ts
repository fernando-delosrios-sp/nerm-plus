import { AccountSchema, Attributes, Schema, StdAccountListOutput } from '@sailpoint/connector-sdk'
import { AccountType } from './config'

export type AccountAttributes = {
    [key: string]: string | number | boolean | null | undefined
}

const processAttributes = (attrs: { [key: string]: any }, schema: AccountSchema): { [key: string]: any } => {
    const attributeNames: string[] = schema.attributes.map((x) => x.name)
    let attributes: { [key: string]: any } = {}
    attributeNames.forEach((x) => (attributes[x] = attrs[x]))

    return attributes
}

const updateTypes = (attributes: Attributes, type: AccountType) => {
    let types: Set<string> = new Set((attributes.types as string[]) ?? [])
    types.add(type)
    attributes.types = Array.from(types)
}

export class ProfileAccount implements StdAccountListOutput {
    identity: string
    uuid: string
    disabled?: boolean | undefined
    attributes: Attributes

    constructor(input: any) {
        // const attributes = { ...input, ...input.attributes }
        // delete attributes.attributes
        this.disabled = input.status === 'Active' ? false : true
        this.identity = input.id
        this.uuid = input.name
        this.attributes = {
            id: input.id,
            name: input.name,
        }
        updateTypes(this.attributes, 'Profile')
    }
}

export class NeprofileUserAccount implements StdAccountListOutput {
    identity: string
    uuid: string
    disabled?: boolean | undefined
    attributes: Attributes

    constructor(input: any) {
        this.disabled = input.status === 'Active' ? false : true
        this.identity = input.id
        this.uuid = input.name
        this.attributes = input
        updateTypes(this.attributes, 'NeprofileUser')
    }
}

export class NeaccessUserAccount implements StdAccountListOutput {
    identity: string
    uuid: string
    disabled?: boolean | undefined
    attributes: Attributes

    constructor(input: any) {
        this.disabled = input.status === 'Active' ? false : true
        this.identity = input.id
        this.uuid = input.name
        this.attributes = input
        updateTypes(this.attributes, 'NeaccessUser')
    }
}
