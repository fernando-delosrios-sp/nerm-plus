import { GenericEntitlement } from '../model/entitlement'

export const typeEntitlements: GenericEntitlement[] = [
    { id: 'Profile', name: 'Profile', description: 'The account has an associated profile' },
    { id: 'NeprofileUser', name: 'User', description: 'The account has an associated user' },
    { id: 'NeaccessUser', name: 'Portal user', description: 'The account has an associated portal user' },
]
