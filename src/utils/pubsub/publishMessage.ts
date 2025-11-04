/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'

import config from '../../../config'
import pubSubClient from './_client'

// set local config
const source = 'pubsub.publishMessage'

export default async (topic: string, message: any, attributes: any) => {
	// initialize output
	let output: string

	// add runtime information as attributes
	const customAttributes = {
		...attributes,
		stage: config.stage,
		version: config.version,
	}

	// send message for each topic
	try {
		// attempt to send message
		output = await pubSubClient.topic(topic).publishJSON(message, customAttributes)
	} catch (error: any) {
		if (error.code === 5) {
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
