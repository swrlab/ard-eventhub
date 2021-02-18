/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const pubSubClient = require('./_client');

module.exports = async () => {
	// fetch topic list
	let [topics] = await pubSubClient.getTopics();

	// DEV filter topics by prefix

	// map values
	topics = topics.map((topic) => {
		return {
			type: 'PUBSUB',
			name: topic.name.split('/').pop(),
			path: topic.name,
			labels: topic.metadata.labels,
		};
	});

	// return data
	return Promise.resolve(topics);
};
