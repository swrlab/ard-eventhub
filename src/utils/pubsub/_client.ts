/*

	ard-eventhub
	by SWR Audio Lab

*/

// load pubsub for internal queues
import { PubSub } from '@google-cloud/pubsub'

export default new PubSub({
	projectId: process.env.GCP_PROJECT_ID,
})
