/*

	ard-eventhub
	by SWR Audio Lab

*/

// load pubsub for internal queues
import { v1 } from '@google-cloud/pubsub'

export default new v1.SubscriberClient({
	projectId: process.env.GCP_PROJECT_ID,
})
