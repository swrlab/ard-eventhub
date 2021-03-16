/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const loggerDev = require('../loggerDev')
const pubSubClient = require('./_client')
const config = require('../../../config')

// set local config
const functionName = 'utils/pubsub/publishMessage'

module.exports = async (topics, message) => {
	loggerDev('log', [functionName, 'triggered', JSON.stringify({ topics, message })])

	// initialize output object
	let messageIds = {}

	// prepare buffer object
	const messageBuffer = Buffer.from(JSON.stringify(message))

	// add runtime information as attributes
	const customAttributes = {
		stage: config.stage,
		version: config.version,
	}

	// send message for each topic
	for await (const topicName of topics) {
		try {
			// attempt to send message
			messageIds[topicName] = await pubSubClient
				.topic(topicName)
				.publish(messageBuffer, customAttributes)

			// log progress
			loggerDev('log', [functionName, 'success', topicName, messageIds[topicName]])
		} catch (err) {
			if (err?.code === 5) {
				messageIds[topicName] = 'TOPIC_NOT_FOUND'
				loggerDev('error', [functionName, 'topic missing', topicName, messageIds[topicName]])
			} else {
				messageIds[topicName] = 'TOPIC_ERROR'
				loggerDev('error', [
					functionName,
					'other error',
					topicName,
					messageIds[topicName],
					JSON.stringify(err),
				])
			}
		}
	}

	return Promise.resolve(messageIds)
}
