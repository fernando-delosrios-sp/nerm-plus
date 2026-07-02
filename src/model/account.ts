import { Attributes, StdAccountListOutput } from '@sailpoint/connector-sdk'

export type AccountAttributes = {
    [key: string]: string | number | boolean | null | undefined
}

export class ProfileAccount implements StdAccountListOutput {
    identity: string
    uuid: string
    disabled?: boolean | undefined
    attributes: Attributes

    constructor(input: any) {
        this.disabled = input.status !== 'Active'
        this.identity = input.id
        this.uuid = input.name ?? ''
        this.attributes = {
            id: input.id,
            name: input.name,
            types: ['Profile'],
        }
    }
}

export class NeprofileUserAccount implements StdAccountListOutput {
    identity: string
    uuid: string
    disabled?: boolean | undefined
    attributes: Attributes

    constructor(input: any) {
        this.disabled = input.status !== 'Active'
        this.identity = input.id
        this.uuid = input.name ?? ''
        this.attributes = { types: ['NeprofileUser'] }
    }
}

export class NeaccessUserAccount implements StdAccountListOutput {
    identity: string
    uuid: string
    disabled?: boolean | undefined
    attributes: Attributes

    constructor(input: any) {
        this.disabled = input.status !== 'Active'
        this.identity = input.id
        this.uuid = input.name ?? ''
        this.attributes = { types: ['NeaccessUser'] }
    }
}
