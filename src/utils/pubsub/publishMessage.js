/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const loggerDev = require('../loggerDev');
const pubSubClient = require('./_client');

module.exports = async (topics, message) => {
	loggerDev('log', ['utils/pubsub/publishMessage', 'triggered', JSON.stringify({ topics, message })]);

	// initialize output object
	let messageIds = {};

	// prepare buffer object
	let messageBuffer = Buffer.from(JSON.stringify(message));

	// add runtime information as attributes
	let customAttributes = {
		STAGE: global.STAGE,
		VERSION: global.VERSION,
	};

	// send message for each topic
	for (let topicName of topics) {
		try {
			// attempt to send message
			messageIds[topicName] = await pubSubClient
				.topic(topicName)
				.publish(messageBuffer, customAttributes);

			// log progress
			loggerDev('log', ['utils/pubsub/publishMessage', 'success', topicName, messageIds[topicName]]);
		} catch (err) {
			if (err && err.code && err.code == 5) {
				messageIds[topicName] = 'TOPIC_NOT_FOUND';
				loggerDev('error', [
					'utils/pubsub/publishMessage',
					'topic missing',
					topicName,
					messageIds[topicName],
				]);
			} else {
				messageIds[topicName] = 'TOPIC_ERROR';
				loggerDev('error', [
					'utils/pubsub/publishMessage',
					'other error',
					topicName,
					messageIds[topicName],
					JSON.stringify(err),
				]);
			}
		}
	}

	return Promise.resolve(messageIds);
};
