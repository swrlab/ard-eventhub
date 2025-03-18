/*

	ard-eventhub
	by SWR Audio Lab

*/

// load node utils
const { DateTime } = require('luxon')
const ULID = require('ulid')

// load eventhub utils
const datastore = require('../../utils/datastore')
const logger = require('../../utils/logger')
const pubsub = require('../../utils/pubsub')
const response = require('../../utils/response')
const config = require('../../../config')

// load api feed
const feed = require('../../data')

const source = 'ingest/subscriptions/post'

module.exports = async (req, res) => {
	// check if env was set
	if (!process.env.ARD_FEED_URL)
		console.log('Feed-URL was not set')

	const coreApi = require('../../data/ard-core-livestreams.json')

	try {
		// generate subscription name
		const prefix = `${config.pubSubPrefix}subscription.`

		// check existence of user institution
		const institutionExists = coreApi.items.some((entry) => {
			return req.user.institutionId === entry.publisher.institution.id
		})

		// check if user has institution set
		if (!institutionExists) {
			const institutionId = req.user.institution.id
			const institutionName = req.user.institution.name

			// log action
			logger.log({
				level: 'warning',
				message: 'user attempted to create subscription without institution',
				source,
				data: {
					topic: req.body.topic,
					stage: config.stage,
					email: req.user.email,
					institutionExists,
					userInstitution: req.user.institution,
				},
			})

			// return 401 error
			return response.badRequest(req, res, {
				status: 401,
				message: `New subscriptions are not allowed for user '${req.user.email}'`,
				errors: `The institution '${institutionId}' (${institutionName}) wasn't found in ARD Core-API`,
			})
		}

		// map inputs
		let subscription = {
			name: `${prefix}${ULID.ulid()}`,
			type: req.body.type,
			method: req.body.method,
			url: req.body.url,
			contact: req.body.contact,
			topic: pubsub.buildId(req.body.topic),

			creator: req.user.email,
			institutionId: req.user.institutionId,
			created: DateTime.now().toISO(),
		}

		// save to datastore
		subscription = await datastore.save(subscription, 'subscriptions')

		// check existence of topic
		try {
			await pubsub.getTopic(subscription.topic)
		} catch (error) {
			// log error
			logger.log({
				level: 'warning',
				message: `failed to find desired topic > ${subscription.topic}`,
				source,
				error,
				data: { subscription },
			})

			// delete datastore object
			await datastore.delete('subscriptions', subscription.id)

			// return 404 error
			return response.notFound(req, res, {
				status: 404,
				message: `Topic '${subscription.topic}' not found`,
			})
		}

		// request creation of subscription
		const createdSubscription = await pubsub.createSubscription(subscription)

		// return data
		return res.status(201).json(createdSubscription)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to create subscription',
			source,
			error,
			data: { body: req.body },
		})

		return response.internalServerError(req, res, error)
	}
}
