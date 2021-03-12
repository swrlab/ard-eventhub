/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const { PublisherClient } = require('@google-cloud/pubsub').v1;
module.exports = new PublisherClient({
	projectId: process.env.GCP_PROJECT_ID,
	keyFilename: './keys/ingest.json',
});
