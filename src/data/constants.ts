export const REQUESTSPERSECOND = 50
export const TOKEN_URL_PATH = '/oauth/token'
export const PROCESSINGWAIT = 60 * 1000
export const RETRIES = 5
export const QUERYLIMIT = 100
export const QUERYORDER = 'created_at'
// ⚡ Bolt: Use Set for O(1) membership lookups in attribute/type hot paths instead of O(N) Array.includes()
export const PROFILEONLY_ATTRIBUTES = new Set(['user_id'])
export const PROFILE_ROOTATTRIBUTES = new Set([
    'id',
    'uid',
    'name',
    'profile_type_id',
    'status',
    'id_proofing_status',
    'updated_at',
    'created_at',
])
export const USERONLY_ATTRIBUTES = new Set([
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
])
export const PROFILETYPE_ATTRIBUTES = new Set(['ProfileSearchAttribute', 'ProfileSelectAttribute'])
export const USERTYPE_ATTRIBUTES = new Set([
    'ContributorSearchAttribute',
    'ContributorSelectAttribute',
    'OwnerSearchAttribute',
    'OwnerSelectAttribute',
])
export const WORKFLOW_PENDINGSTATUSES = new Set(['pending request', 'pending set attribute'])
export const ENTITLEMENT_ATTRIBUTES = new Set(['types', 'workflows', 'roles'])
export const BATCH_SIZE = 100
export const ACCOUNT_CONCURRENCY = 5
export const TYPES: { [key: string]: string } = {
    roles: 'ROLE',
    accessprofiles: 'ACCESS_PROFILE',
    entitlements: 'ENTITLEMENT',
}
export const ACCESSTYPE_MAPPING: { [key: string]: string } = {
    role: 'ROLE',
    accessprofile: 'ACCESS_PROFILE',
    entitlement: 'ENTITLEMENT',
}

export const PARENTCHILD_ATTRIBUTES: any = {
    role: {
        accessprofiles: 'accessProfiles',
        entitlements: 'entitlements',
    },
    accessprofile: {
        entitlements: 'entitlements',
    },
    identity: {
        roles: 'access',
        accessprofiles: 'access',
        entitlements: 'access',
    },
    entitlement: {},
}
