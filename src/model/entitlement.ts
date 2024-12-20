import { Attributes, Key, Permission, StdEntitlementListOutput } from '@sailpoint/connector-sdk'
import { Workflow as WorkflowType } from './config'

export type GenericEntitlement = {
    id: string
    name: string
    description?: string
}

export class Type implements StdEntitlementListOutput {
    identity: string
    uuid: string
    type: string = 'type'
    attributes: Attributes

    constructor(input: any) {
        this.identity = input.id
        this.uuid = input.name
        this.attributes = {
            id: this.identity,
            name: this.uuid,
            description: input.description,
        }
    }
}

export class Role implements StdEntitlementListOutput {
    identity: string
    uuid: string
    key?: Key | undefined
    type: string = 'role'
    deleted?: boolean | undefined
    attributes: Attributes
    permissions?: Permission[] | undefined

    constructor(input: any) {
        this.identity = input.id
        this.uuid = input.name
        this.attributes = {
            id: this.identity,
            name: this.uuid,
            groups: input.groups,
        }
    }
}

export class Workflow implements StdEntitlementListOutput {
    identity: string
    uuid: string
    type: string = 'workflow'
    attributes: Attributes

    constructor(input: WorkflowType) {
        this.identity = input.workflow
        this.uuid = input.entitlement
        this.attributes = {
            id: this.identity,
            name: this.uuid,
            requester_id: input.requester_id,
        }
    }
}

export class Profile implements StdEntitlementListOutput {
    identity: string
    uuid: string
    key?: Key | undefined
    type: string
    deleted?: boolean | undefined
    attributes: Attributes
    permissions?: Permission[] | undefined

    constructor(input: any, type: string, attrs: string[]) {
        const { id, name } = input
        let attributes: Attributes = { id, name }
        attrs.forEach((x) => (attributes[x] = input.attributes[x]))
        let description
        try {
            description = attrs.find((x) => /.*description/.test(x))
        } catch (error) {}
        if (description) {
            attributes.description = input.attributes[description]
        }
        this.type = type
        this.identity = id
        this.uuid = name
        this.attributes = attributes
    }
}
