import { jest, expect, describe, it, beforeEach } from '@jest/globals'
import { AttributeService } from '../../src/services/attribute-service'
import { ConnectorContext } from '../../src/connector-context'
import { logger, StdAccountListOutput } from '@sailpoint/connector-sdk'

jest.mock('@sailpoint/connector-sdk', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}))

describe('AttributeService', () => {
    let mockContext: any
    let attributeService: AttributeService

    beforeEach(() => {
        jest.clearAllMocks()

        mockContext = {
            config: {
                account_type: 'Profile',
            },
            nerm: {
                setUserAttribute: jest.fn(),
                setProfileAttribute: jest.fn(),
                updateUser: jest.fn(),
                getProfile: jest.fn(),
                getAttributeRecursively: jest.fn(),
            },
        }

        attributeService = new AttributeService(mockContext as ConnectorContext)
    })

    describe('setAttribute', () => {
        it('should handle errors when setting user status attribute throws', async () => {
            const account: StdAccountListOutput = {
                identity: 'test_identity',
                uuid: 'test_uuid',
                attributes: {
                    user_id: 'test_user_id',
                },
            }

            const error = new Error('Test error')
            mockContext.nerm.setUserAttribute.mockRejectedValueOnce(error)

            await attributeService.setAttribute(account, 'status', 'Active')

            expect(mockContext.nerm.setUserAttribute).toHaveBeenCalledWith('test_user_id', 'status', 'Active')
            expect(logger.error).toHaveBeenCalledWith(error)
        })
    })
})
