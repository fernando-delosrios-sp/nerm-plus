export const REQUESTSPERSECOND = 10
export const TOKEN_URL_PATH = '/oauth/token'
export const PROCESSINGWAIT = 60 * 1000
export const RETRIES = 5
export const QUERYLIMIT = 100
export const QUERYORDER = 'created_at'
export const PROFILEONLY_ATTRIBUTES = ['user_id']
export const PROFILE_ROOTATTRIBUTES = [
    'id',
    'uid',
    'name',
    'profile_type_id',
    'status',
    'id_proofing_status',
    'updated_at',
    'created_at',
]
export const USERONLY_ATTRIBUTES = [
    'type',
    'email',
    'title',
    'login',
    'last_login',
    'cookies_accepted_at',
    'preferred_language',
    'locale',
    'group_strings',
    'avatar_url',
]
export const PROFILETYPE_ATTRIBUTES = ['ProfileSearchAttribute', 'ProfileSelectAttribute']
export const WORKFLOW_PENDINGSTATUSES = ['pending request', 'pending set attribute']
export const ENTITLEMENT_ATTRIBUTES = ['types', 'workflows', 'roles']
export const BATCH_SIZE = 100
export const TYPES: { [key: string]: string } = {
    roles: 'ROLE',
    accessprofiles: 'ACCESS_PROFILE',
    entitlements: 'ENTITLEMENT',
}
