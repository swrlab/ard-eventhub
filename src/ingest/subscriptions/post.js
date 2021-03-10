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

//TODO: check IDs in ARD Core-API instead of dump
const coreApi = require('../../data/coreApi.json');

module.exports = async (req, res) => {
	try {
		// generate subscription name
		let subIdent = 'subscription';
		let prefix = `${global.PREFIX}.${subIdent}.${global.STAGE}`;

		// check existence of user organization
		let organizationExists = coreApi.some((entry) => {
			if (req.user.organization?.id == entry.institution.id) {
				return true;
			}
		});

		if (!organizationExists) {
			let orgId = req.user.organization?.id;
			let orgName = req.user.organization?.name;
			// return 401 error
			return response.badRequest(req, res, {
				status: 401,
				message: `New subscriptions are not allowed for user '${req.user.email}'`,
				errors: `The organization '${orgId}' (${orgName}) wasn't found in ARD Core-API`,
			});
		}

		// map inputs
		let subscription = {
			name: `${prefix}.${req.user.organization?.name}.${uuidv4()}`,
			type: req.body.type,
			method: req.body.method,
			url: req.body.url,
			contact: req.body.contact,
			topic: req.body.topic,

			owner: req.user.email,
			organization: req.user.organization,
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
			return res.sendStatus(404);
		}

		// request creation of subscription
		let createdSubscription = await pubsub.createSubscription(subscription);

		// return data
		res.status(201).json(createdSubscription);
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
