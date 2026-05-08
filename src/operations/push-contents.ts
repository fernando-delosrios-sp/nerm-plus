import { CommandHandler } from '@sailpoint/connector-sdk'
import { PushService } from '../services/push-service'
import { opEnd, opStart } from '../logging'

export function createPushContents(pushService: PushService): CommandHandler {
    return async (context, input, res) => {
        opStart('pushContents', input)
        await pushService.pushContents(context, input, res)
        opEnd('pushContents', 'done')
    }
}
