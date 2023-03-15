/*

	ard-eventhub
	by SWR Audio Lab

*/

// load pubsub for internal queues
const { SubscriberClient } = require('@google-cloud/pubsub').v1

module.exports = new SubscriberClient({
	projectId: process.env.GCP_PROJECT_ID,
})
