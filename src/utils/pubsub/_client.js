/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const { PubSub } = require('@google-cloud/pubsub')

module.exports = new PubSub({
	projectId: process.env.GCP_PROJECT_ID,
})
