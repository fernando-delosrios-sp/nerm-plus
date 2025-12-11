import { AccountSchema } from '@sailpoint/connector-sdk'
import { Schema as ApiSchema } from 'sailpoint-api-client'

export const defaultAccountSchema: AccountSchema = {
    displayAttribute: 'name',
    identityAttribute: 'id',
    groupAttribute: 'types',
    attributes: [
        {
            name: 'id',
            type: 'string',
            description: 'ID',
        },
        {
            name: 'name',
            type: 'string',
            description: 'Name',
        },
        {
            name: 'status',
            type: 'string',
            description: 'Status',
        },
        {
            name: 'user_id',
            type: 'string',
            description: 'User ID',
        },
        {
            name: 'login',
            type: 'string',
            description: 'User login',
        },
        {
            name: 'types',
            description: 'Types',
            type: 'string',
            multi: true,
            entitlement: true,
            managed: true,
            schemaObjectType: 'type',
        },
        {
            name: 'roles',
            description: 'Roles',
            type: 'string',
            multi: true,
            entitlement: true,
            managed: true,
            schemaObjectType: 'role',
        },
        {
            name: 'workflows',
            description: 'Workflows',
            type: 'string',
            multi: true,
            entitlement: true,
            managed: true,
            schemaObjectType: 'workflow',
        },
    ],
}

export const defaultEntitlementSchema: ApiSchema = {
    identityAttribute: 'id',
    displayAttribute: 'name',
    attributes: [
        {
            name: 'id',
            type: 'STRING',
            description: 'ID',
        },
        {
            name: 'name',
            type: 'STRING',
            description: 'Name',
        },
        {
            name: 'description',
            type: 'STRING',
            description: 'Description',
        },
    ],
}
