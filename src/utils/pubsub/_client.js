/*

	ard-eventhub
	by SWR Audio Lab

*/

// load pubsub for internal queues
const { PubSub } = require('@google-cloud/pubsub')

module.exports = new PubSub({
	projectId: process.env.GCP_PROJECT_ID,
})
