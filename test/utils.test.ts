import { getStatus } from '../src/utils';
import { AccountType } from '../src/model/config';

describe('getStatus', () => {
    it('should map Profile statuses correctly', () => {
        expect(getStatus('Disabled', 'Profile')).toBe('Inactive');
    });

    it('should map NeprofileUser statuses correctly', () => {
        expect(getStatus('Inactive', 'NeprofileUser')).toBe('Disabled');
        expect(getStatus('On Leave', 'NeprofileUser')).toBe('Disabled');
        expect(getStatus('Terminated', 'NeprofileUser')).toBe('Disabled');
    });

    it('should map NeaccessUser statuses correctly', () => {
        expect(getStatus('Inactive', 'NeaccessUser')).toBe('Disabled');
        expect(getStatus('On Leave', 'NeaccessUser')).toBe('Disabled');
        expect(getStatus('Terminated', 'NeaccessUser')).toBe('Disabled');
    });

    it('should return the original status if not found in the mapping', () => {
        expect(getStatus('Active', 'Profile')).toBe('Active');
        expect(getStatus('Active', 'NeprofileUser')).toBe('Active');
        expect(getStatus('Active', 'NeaccessUser')).toBe('Active');
        expect(getStatus('Unknown', 'Profile')).toBe('Unknown');
    });

    it('should return the original status for unknown AccountType', () => {
        // We cast to AccountType to test what happens if an unexpected string is passed
        expect(getStatus('Disabled', 'UnknownType' as AccountType)).toBe('Disabled');
    });
});
