/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const { PubSub } = require('@google-cloud/pubsub');
const pubsub = new PubSub({
	projectId: global.pubsubProject,
	keyFilename: './keys/ingest.json',
});

module.exports = async (topics, message) => {
	console.log('DEV publishPubSub >', JSON.stringify({ topics, message }));
};
