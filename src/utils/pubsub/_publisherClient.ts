import { v1 } from '@google-cloud/pubsub'
import { projectId } from '#env'

export default new v1.PublisherClient({
	projectId,
})
