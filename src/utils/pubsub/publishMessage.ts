import logger from '@frytg/logger'

import { version } from '#config'
import { stage } from '#env'
import pubSubClient from './_client.ts'

// set local config
const source = 'pubsub.publishMessage'

export default async (topic: string, message: object, attributes: Record<PropertyKey, string>) => {
	// initialize output
	let output: string

	// add runtime information as attributes
	const customAttributes = {
		...attributes,
		stage,
		version,
	}

	// send message for each topic
	try {
		// attempt to send message
		output = await pubSubClient.topic(topic).publishMessage({
			json: message,
			attributes: customAttributes,
		})
	} catch (error) {
		if (isCode5Error(error)) {
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

	return output
}

// TODO: move to separte util file (since it is reused in subscriptions/delete.ts)
function isCode5Error(e: unknown): e is { code: 5 } {
	return typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === 5
}
