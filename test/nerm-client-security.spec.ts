import { NERMClient } from '../src/nerm-client'

describe('NERMClient security enhancements', () => {
    it('should URL encode path parameters to prevent injection', async () => {
        const mockConfig = {
            nerm_baseurl: 'https://example.com/api',
            nerm_token: 'dummy-token'
        } as any;

        const client = new NERMClient(mockConfig);
        const mockAxiosInstance = { request: jest.fn() } as any;
        (client as any).client = mockAxiosInstance;

        mockAxiosInstance.request.mockResolvedValueOnce({ data: { user: {} } });

        const maliciousId = '123/../../etc/passwd';
        await client.getUser(maliciousId);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/users/123%2F..%2F..%2Fetc%2Fpasswd'
            })
        );
    });
});
