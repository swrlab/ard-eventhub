import { PubSub } from '@google-cloud/pubsub'
import { projectId } from '#env'

export default new PubSub({
	projectId,
})
