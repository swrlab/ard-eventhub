import { v1 } from '@google-cloud/pubsub'
import { projectId } from '#env'

export const publisherClient = new v1.PublisherClient({
	projectId,
})
