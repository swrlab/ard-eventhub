/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const logger = require('../logger')
const pubSubClient = require('./_client')
const config = require('../../../config')

// set local config
const source = 'pubsub.publishMessage'

module.exports = async (topic, message) => {
	logger.log({
		level: 'info',
		message: `sending message > ${topic}`,
		source,
		data: { topic },
	})

	// initialize output
	let output

	// prepare buffer object
	const messageBuffer = Buffer.from(JSON.stringify(message))

	// add runtime information as attributes
	const customAttributes = {
		stage: config.stage,
		version: config.version,
	}

	// send message for each topic
	try {
		// attempt to send message
		output = await pubSubClient.topic(topic).publish(messageBuffer, customAttributes)
	} catch (error) {
		if (error?.code === 5) {
			output = 'TOPIC_NOT_FOUND'

			logger.log({
				level: 'warning',
				message: `topic not found > ${topic}`,
				source,
				error,
				data: { topic },
			})
		} else {
			output = 'TOPIC_ERROR'

			logger.log({
				level: 'error',
				message: `failed sending message > ${topic}`,
				source,
				error,
				data: { topic, message },
			})
		}
	}

	return Promise.resolve(output)
}
