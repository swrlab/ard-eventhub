/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import { DateTime } from 'luxon'
import type UserTokenRequest from '@/src/ingest/auth/middleware/userTokenRequest.ts'

import type { EventhubService } from '@/types.eventhub.ts'
import { getPublisherById } from '../ard-core.ts'
import datastore from '../datastore'
import pubsub from '../pubsub'

const source = 'utils.events.createNewTopic'

export default async (service: EventhubService, req: UserTokenRequest) => {
	// check if user is present
	if (!req.user?.email) {
		logger.log({
			level: 'notice',
			message: 'user not found',
			source,
			data: { ...req.headers, authorization: 'hidden' },
		})
		throw new Error('User not found')
	}

	// check if topic is present
	if (!service.topic) {
		logger.log({
			level: 'notice',
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
		logger.log({
			level: 'notice',
			message: 'publisher not found',
			source,
			data: { service },
		})
		throw new Error('Publisher not found')
	}

	// try creating new topic
	const newTopic = {
		id: undefined as string | undefined,
		created: DateTime.now().toISO(),
		creator: req.user.email,

		coreId: service.topic.id,
		externalId: service.externalId,
		name: service.topic.name,

		institution: {
			id: req.user.institutionId,
			title: publisher.institution.title,
		},

		publisher: {
			id: service.publisherId,
			title: publisher.title,
		},
	}

	// save topic to datastore
	await datastore.save(newTopic, 'topics', null)
	newTopic.id = newTopic.id?.toString()

	// create topic
	const [result] = await pubsub.createTopic(newTopic)

	// handle feedback
	if (result?.name?.indexOf(service.topic.name) !== -1) {
		// update api result that topic was created
		service.topic.status = 'TOPIC_CREATED'

		logger.log({
			level: 'notice',
			message: `topic created > ${service.topic.name}`,
			source,
			data: { service, result },
		})
	} else {
		// update api result that topic was not created
		service.topic.status = 'TOPIC_NOT_CREATED'

		logger.log({
			level: 'error',
			message: `failed creating topic > ${service.topic.name}`,
			source,
			data: { service, result },
		})
	}

	// insert empty id
	service.topic.messageId = null

	return Promise.resolve(service.topic)
}
