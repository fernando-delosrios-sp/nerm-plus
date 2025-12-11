export type AccountType = 'Profile' | 'NeprofileUser' | 'NeaccessUser'
type OperationType = 'create' | 'update' | 'enable' | 'disable' | 'delete'
type IndexType = 'identities' | 'roles' | 'accessprofiles' | 'entitlements'
export type RequesterType = 'admin' | 'user_id' | 'sponsor_user_id' | 'approver_user_id'
export type Operation = {
    operation: OperationType
    name?: string
    workflow: string
    requester_id: RequesterType
    wait: boolean
}
export type Profile = {
    name: string
    attribute: string
    workflow?: string
    requester_id: RequesterType
    wait: boolean
    attributes: string[]
}

export type Mapping = {
    index: IndexType
    search: string
    id: string
    profile: string
    mapping: { [key: string]: string }
    nested?: boolean
    parent_index?: IndexType
    attribute?: string
    sync: boolean
}

export type Workflow = {
    entitlement: string
    workflow: string
    requester_id: RequesterType
    wait?: boolean
    persistent?: boolean
}

export interface Config {
    spConnectorInstanceId: string
    spConnectorSpecId: string
    spConnectorSupportsCustomSchemas: boolean
    isc_baseurl: string
    isc_clientId: string
    isc_clientSecret: string
    nerm_baseurl: string
    nerm_token: string
    nerm_admin: string
    account_type: AccountType
    profile_name: string
    login_attribute: string
    operations?: Operation[]
    profiles?: Profile[]
    workflows?: Workflow[]
    push_mode: boolean
    mappings?: Mapping[]
}
