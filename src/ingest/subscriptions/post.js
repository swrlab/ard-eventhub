/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const moment = require('moment')
const { v4: uuidv4 } = require('uuid')

// load eventhub utils
const datastore = require('../../utils/datastore')
const pubsub = require('../../utils/pubsub')
const response = require('../../utils/response')
const config = require('../../../config')

// TODO: check IDs in ARD Core-API instead of dump
const coreApi = require('../../data/coreApi.json')

const functionName = 'ingest/subscription/post'

module.exports = async (req, res) => {
	try {
		// generate subscription name
		const subIdent = 'subscription'
		const prefix = `${config.pubSubPrefix}${subIdent}.`
		const topicName = req.body.topic

		// check existence of user institution
		const institutionExists = coreApi.some((entry) => {
			return req.user.institution.id === entry.institution.id
		})

		// check if user has institution set
		if (!institutionExists) {
			const institutionId = req.user.institution.id
			const institutionName = req.user.institution.name

			// log action
			console.warn(
				functionName,
				'user attempted to create subscription without institution',
				JSON.stringify({
					topicName,
					stage: config.stage,
					email: req.user.email,
					institutionExists,
					userInstitution: req.user.institution,
				})
			)

			// return 401 error
			return response.badRequest(req, res, {
				status: 401,
				message: `New subscriptions are not allowed for user '${req.user.email}'`,
				errors: `The institution '${institutionId}' (${institutionName}) wasn't found in ARD Core-API`,
			})
		}

		// check if topic is from this stage
		if (topicName.indexOf(`.${config.stage}.`) === -1) {
			// log action
			console.warn(
				functionName,
				'user attempted to create subscription from other stage',
				JSON.stringify({
					topicName,
					stage: config.stage,
					email: req.user.email,
				})
			)

			// return 401 error
			return response.badRequest(req, res, {
				status: 400,
				message: `Topic is not from this stage environment`,
				errors: `The topic '${topicName}' does not belong to this stage (${config.stage})`,
			})
		}

		// map inputs
		let subscription = {
			name: `${prefix}.${req.user.institution.name}.${uuidv4()}`,
			type: req.body.type,
			method: req.body.method,
			url: req.body.url,
			contact: req.body.contact,
			topic: topicName,

			owner: req.user.email,
			institution: req.user.institution,
			created: moment().toISOString(),
		}

		// save to datastore
		subscription = await datastore.save(subscription, 'subscriptions')

		// check existence of topic
		try {
			await pubsub.getTopic(subscription.topic)
		} catch (topicErr) {
			// log error
			console.error(
				functionName,
				'failed to find desired topic',
				JSON.stringify({
					subscription,
					error: topicErr.stack || topicErr,
				})
			)

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
	} catch (err) {
		console.error(
			functionName,
			'failed to create subscription',
			JSON.stringify({
				body: req.body,
				error: err.stack || err,
			})
		)
		return response.internalServerError(req, res, err)
	}
}
