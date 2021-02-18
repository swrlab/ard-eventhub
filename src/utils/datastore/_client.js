/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const { Datastore } = require('@google-cloud/datastore');
module.exports = new Datastore({
	projectId: process.env.GCP_PROJECT_ID,
	keyFilename: './keys/ingest.json',
});
