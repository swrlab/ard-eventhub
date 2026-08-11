import { v1 } from '@google-cloud/pubsub'
import { projectId } from '#env'

export const pubSubSubscriberClient = new v1.SubscriberClient({
	projectId,
})
