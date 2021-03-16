/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

// load eventhub utils
const datastore = require('../../utils/datastore');
const pubsub = require('../../utils/pubsub');
const response = require('../../utils/response');
const config = require('../../../config');

// TODO: check IDs in ARD Core-API instead of dump
const coreApi = require('../../data/coreApi.json');

module.exports = async (req, res) => {
	try {
		// generate subscription name
		const subIdent = 'subscription';
		const prefix = `${config.pubsubPrefix}.${subIdent}.${config.stage}`;

		// check existence of user institution
		const institutionExists = coreApi.some((entry) => {
			return req.user.institution.id === entry.institution.id;
		});

		if (!institutionExists) {
			const orgId = req.user.institution.id;
			const orgName = req.user.institution.name;
			// return 401 error
			return response.badRequest(req, res, {
				status: 401,
				message: `New subscriptions are not allowed for user '${req.user.email}'`,
				errors: `The institution '${orgId}' (${orgName}) wasn't found in ARD Core-API`,
			});
		}

		// map inputs
		let subscription = {
			name: `${prefix}.${req.user.institution.name}.${uuidv4()}`,
			type: req.body.type,
			method: req.body.method,
			url: req.body.url,
			contact: req.body.contact,
			topic: req.body.topic,

			owner: req.user.email,
			institution: req.user.institution,
			created: moment().toISOString(),
		};

		// save to datastore
		subscription = await datastore.save(subscription, 'subscriptions');

		// check existence of topic
		try {
			await pubsub.getTopic(subscription.topic);
		} catch (topicErr) {
			// log error
			console.error(
				'ingest/subscription/post',
				'failed to find desired topic',
				JSON.stringify({
					subscription,
					error: topicErr.stack || topicErr,
				})
			);

			// delete datastore object
			await datastore.delete('subscriptions', subscription.id);

			// return 404 error
			return response.notFound(req, res, {
				status: 404,
				message: `Topic '${subscription.topic}' not found`,
			});
		}

		// request creation of subscription
		const createdSubscription = await pubsub.createSubscription(subscription);

		// return data
		return res.status(201).json(createdSubscription);
	} catch (err) {
		console.error(
			'ingest/subscriptions/post',
			'failed to create subscription',
			JSON.stringify({
				body: req.body,
				error: err.stack || err,
			})
		);
		return response.internalServerError(req, res, err);
	}
};
