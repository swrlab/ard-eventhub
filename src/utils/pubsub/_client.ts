import { PubSub } from '@google-cloud/pubsub'
import { projectId } from '#env'

export const pubSubClient = new PubSub({
	projectId,
})
