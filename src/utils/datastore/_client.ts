/*

	ard-eventhub
	by SWR Audio Lab

*/

// load pubsub for internal queues
import { Datastore } from '@google-cloud/datastore'

export default new Datastore({
	projectId: process.env.GCP_PROJECT_ID,
})
