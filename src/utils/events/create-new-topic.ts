import type { EventRequestContext } from '#types'
import type { EventhubService } from '../../schemas/events.ts'
import type { EventhubTopicDatastore } from '../../schemas/subscriptions.ts'
import { DateTime } from '@frytg/dates'
import logger from '@frytg/logger'
import { getPublisherById } from '../ard-core.ts'
import { datastoreSave } from '../datastore/save.ts'
import { getSafeHeaders } from '../get-safe-headers.ts'
import { pubsubCreateTopic } from '../pubsub/create-topic.ts'

const source = 'utils.events.createNewTopic'

/**
 * Create a new Pub/Sub topic and datastore record for an unknown service.
 * @param service - Service whose topic is missing
 * @param req - Event request context (user)
 * @returns Topic metadata attached to the service
 */
export const createNewTopic = async (service: EventhubService, req: EventRequestContext) => {
	// check if user is present
	if (!req.user?.email) {
		logger.notice({
			message: 'user not found',
			source,
			data: getSafeHeaders(req.headers),
		})
		throw new Error('User not found')
	}

	// check if topic is present
	if (!service.topic) {
		logger.notice({
			message: 'topic not found',
			source,
			data: { service },
		})
		throw new Error('Topic not found')
	}

	// fetch publisher
	const publisher = getPublisherById(service.publisherId)

	// check if publisher is present
	if (!publisher) {
		logger.notice({
			message: 'publisher not found',
			source,
			data: { service },
		})
		throw new Error('Publisher not found')
	}

	// try creating new topic
	const newTopic: EventhubTopicDatastore = {
		created: DateTime.now().toISO(),
		creator: req.user.email,

		coreId: service.topic.id,
		externalId: service.externalId,
		name: service.topic.name,

		institution: {
			id: req.user.institution.id,
			title: publisher.institution.title,
		},

		publisher: {
			id: service.publisherId,
			title: publisher.title,
		},
	}

	// save topic to datastore
	const topicId = await datastoreSave(newTopic, 'topics')
	const topic = { ...newTopic, id: topicId.toString() }

	// create topic
	const [result] = await pubsubCreateTopic(topic)

	// handle feedback
	// TODO: can we use the `topic` var instead of modifying `service.topic`?
	if (result?.name?.includes(service.topic.name)) {
		// update api result that topic was created
		service.topic.status = 'TOPIC_CREATED'

		logger.notice({
			message: `topic created > ${service.topic.name}`,
			source,
			data: { service, result },
		})
	} else {
		// update api result that topic was not created
		service.topic.status = 'TOPIC_NOT_CREATED'

		logger.error({
			message: `failed creating topic > ${service.topic.name}`,
			source,
			data: { service, result },
		})
	}

	// insert empty id
	service.topic.messageId = null

	return service.topic
}
