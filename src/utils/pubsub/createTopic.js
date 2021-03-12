/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const publisherClient = require('./_publisherClient');

module.exports = async (newTopic) => {
	// create new topic
	let prefix = 'projects/ard-eventhub/topics/';
	let topic = {
		name: prefix + newTopic.pubsub,
		labels: { name: newTopic.label },
	};

	return await publisherClient.createTopic(topic);
};
