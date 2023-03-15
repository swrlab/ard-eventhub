/*

	ard-eventhub
	by SWR Audio Lab

*/

// load pubsub for internal queues
const { Datastore } = require('@google-cloud/datastore')

module.exports = new Datastore({
	projectId: process.env.GCP_PROJECT_ID,
})
