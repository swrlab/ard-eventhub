/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const { SubscriberClient } = require('@google-cloud/pubsub').v1;
module.exports = new SubscriberClient({
	projectId: process.env.GCP_PROJECT_ID,
	keyFilename: './keys/ingest.json',
});
