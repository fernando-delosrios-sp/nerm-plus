import { entity2profile } from '../src/utils'
import { Mapping } from '../src/model/config'

describe('utils', () => {
    describe('entity2profile', () => {
        it('should correctly map entity to profile with status Active', () => {
            const entity = {
                id: 'entity-id',
                name: 'Entity Name',
                enabled: true,
                custom_attributes: {
                    nested: {
                        field: 'nested-value'
                    }
                }
            } as any;

            const conf: Mapping = {
                id: 'profile_id',
                mapping: {
                    'customAttr1': 'custom_attributes.nested.field',
                    'name': 'name'
                },
                index: 'identities',
                search: '',
                profile: 'profile_type_1',
                sync: false
            };

            const result = entity2profile(entity, 'profile_type_1', conf);

            expect(result).toEqual({
                profile_type_id: 'profile_type_1',
                status: 'Active',
                name: 'Entity Name',
                attributes: {
                    customAttr1: 'nested-value',
                    name: 'Entity Name',
                    profile_id: 'entity-id'
                }
            });
        });

        it('should correctly map entity to profile with status Inactive (inactive: true)', () => {
            const entity = {
                id: 'entity-id',
                name: 'Entity Name',
                enabled: false,
                inactive: true,
            } as any;

            const conf: Mapping = {
                id: 'profile_id',
                mapping: {
                    'name': 'name'
                },
                index: 'identities',
                search: '',
                profile: 'profile_type_1',
                sync: false
            };

            const result = entity2profile(entity, 'profile_type_1', conf);

            expect(result).toEqual({
                profile_type_id: 'profile_type_1',
                status: 'Inactive',
                name: 'Entity Name',
                attributes: {
                    name: 'Entity Name',
                    profile_id: 'entity-id'
                }
            });
        });

        it('should correctly map entity to profile with status Active when both enabled: false and inactive: false', () => {
            const entity = {
                id: 'entity-id',
                name: 'Entity Name',
                enabled: false,
                inactive: false,
            } as any;

            const conf: Mapping = {
                id: 'profile_id',
                mapping: {
                    'name': 'name'
                },
                index: 'identities',
                search: '',
                profile: 'profile_type_1',
                sync: false
            };

            const result = entity2profile(entity, 'profile_type_1', conf);

            expect(result).toEqual({
                profile_type_id: 'profile_type_1',
                status: 'Active',
                name: 'Entity Name',
                attributes: {
                    name: 'Entity Name',
                    profile_id: 'entity-id'
                }
            });
        });

        it('should fail with type error when intermediate attribute does not exist', () => {
            const entity = {
                id: 'entity-id',
                name: 'Entity Name',
                enabled: true,
            } as any;

            const conf: Mapping = {
                id: 'profile_id',
                mapping: {
                    'customAttr1': 'custom_attributes.nested.field',
                },
                index: 'identities',
                search: '',
                profile: 'profile_type_1',
                sync: false
            };

            expect(() => entity2profile(entity, 'profile_type_1', conf)).toThrow(TypeError);
        });

        it('should gracefully handle empty mapping', () => {
            const entity = {
                id: 'entity-id',
                name: 'Entity Name',
                enabled: true,
            } as any;

            const conf: Mapping = {
                id: 'profile_id',
                mapping: {},
                index: 'identities',
                search: '',
                profile: 'profile_type_1',
                sync: false
            };

            const result = entity2profile(entity, 'profile_type_1', conf);

            expect(result).toEqual({
                profile_type_id: 'profile_type_1',
                status: 'Active',
                name: 'Entity Name',
                attributes: {
                    profile_id: 'entity-id'
                }
            });
        });
    });
});
